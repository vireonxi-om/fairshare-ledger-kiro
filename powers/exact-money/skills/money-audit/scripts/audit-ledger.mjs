#!/usr/bin/env node
// audit-ledger.mjs — Exact Money auditor.
//
// Independent oracle for a normalized Exact-Money ledger (see
// ../references/ledger-schema.json). Dependency-free: Node standard library only.
//
// It re-derives equal-split shares, balances, and a greedy settlement from the
// raw integer-paise amounts, then checks:
//   - structural validity (types, required fields, unique ids);
//   - safe-integer bounds on every amount and on running sums;
//   - referential integrity (payer and split members are known participants);
//   - split conservation (shares sum to each amount; fairness bound <= 1);
//   - balances sum to exactly zero;
//   - settlement validity: positive integer transfers, no self-transfers,
//     <= n-1 transfers for n non-zero participants, and clearing to zero.
//
// Usage:   node audit-ledger.mjs <ledger.json>
// Exit 0 = all checks passed. Exit 1 = at least one failed. Exit 2 = bad usage.

import { readFileSync } from "node:fs";

const MAX_SAFE = Number.MAX_SAFE_INTEGER;

/** Collected problems; empty means the ledger passed. */
class Report {
  constructor() {
    this.errors = [];
    this.checks = [];
  }
  pass(name) {
    this.checks.push({ name, ok: true });
  }
  fail(name, detail) {
    this.checks.push({ name, ok: false, detail });
    this.errors.push(`${name}: ${detail}`);
  }
  get ok() {
    return this.errors.length === 0;
  }
}

function isPlainObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isSafePositiveInt(v) {
  return Number.isInteger(v) && v >= 1 && v <= MAX_SAFE;
}

/**
 * Equal split of `amountPaise` across the given member ids.
 * Base floor share to all; remainder distributed one paisa each to the first
 * `r` members by ascending id. Returns a Map<id, paise>.
 */
function splitShares(amountPaise, memberIds) {
  const ids = [...memberIds].sort();
  const k = ids.length;
  const base = Math.floor(amountPaise / k);
  const remainder = amountPaise - base * k; // exact; avoids % on huge values
  const shares = new Map();
  for (let i = 0; i < k; i++) {
    shares.set(ids[i], base + (i < remainder ? 1 : 0));
  }
  return shares;
}

/**
 * Greedy settlement over net balances (Map<id, net paise>, summing to 0).
 * Returns an array of { debtor, creditor, amountPaise }.
 */
function planSettlement(nets) {
  const debtors = [];
  const creditors = [];
  for (const id of [...nets.keys()].sort()) {
    const n = nets.get(id);
    if (n < 0) debtors.push({ id, amount: -n });
    else if (n > 0) creditors.push({ id, amount: n });
  }
  const transfers = [];
  let di = 0;
  let ci = 0;
  while (di < debtors.length && ci < creditors.length) {
    const d = debtors[di];
    const c = creditors[ci];
    const amount = Math.min(d.amount, c.amount);
    if (amount > 0) {
      transfers.push({ debtor: d.id, creditor: c.id, amountPaise: amount });
    }
    d.amount -= amount;
    c.amount -= amount;
    if (d.amount === 0) di++;
    if (c.amount === 0) ci++;
  }
  return transfers;
}

function validateStructure(ledger, report) {
  if (!isPlainObject(ledger)) {
    report.fail("structure", "ledger root is not an object");
    return false;
  }
  if (ledger.currency !== "INR") {
    report.fail("currency", `expected "INR", got ${JSON.stringify(ledger.currency)}`);
  }
  if (!Array.isArray(ledger.participants) || ledger.participants.length < 1) {
    report.fail("participants", "must be a non-empty array");
    return false;
  }
  if (!Array.isArray(ledger.expenses)) {
    report.fail("expenses", "must be an array");
    return false;
  }

  const ids = new Set();
  for (const p of ledger.participants) {
    if (!isPlainObject(p) || typeof p.id !== "string" || p.id.length < 1) {
      report.fail("participant.id", `invalid participant entry ${JSON.stringify(p)}`);
      return false;
    }
    if (ids.has(p.id)) {
      report.fail("participant.id", `duplicate participant id ${JSON.stringify(p.id)}`);
    }
    ids.add(p.id);
    if (typeof p.name !== "string" || p.name.length < 1) {
      report.fail("participant.name", `participant ${p.id} has invalid name`);
    }
  }

  const expenseIds = new Set();
  for (const e of ledger.expenses) {
    if (!isPlainObject(e) || typeof e.id !== "string" || e.id.length < 1) {
      report.fail("expense.id", `invalid expense entry ${JSON.stringify(e)}`);
      return false;
    }
    if (expenseIds.has(e.id)) {
      report.fail("expense.id", `duplicate expense id ${JSON.stringify(e.id)}`);
    }
    expenseIds.add(e.id);

    if (!isSafePositiveInt(e.amountPaise)) {
      report.fail(
        "expense.amountPaise",
        `expense ${e.id} amountPaise must be a positive safe integer, got ${JSON.stringify(e.amountPaise)}`,
      );
    }
    if (typeof e.payerId !== "string" || !ids.has(e.payerId)) {
      report.fail("expense.payerId", `expense ${e.id} payerId ${JSON.stringify(e.payerId)} is not a known participant`);
    }
    if (!Array.isArray(e.splitMemberIds) || e.splitMemberIds.length < 1) {
      report.fail("expense.splitMemberIds", `expense ${e.id} must split among at least one participant`);
    } else {
      const seen = new Set();
      for (const m of e.splitMemberIds) {
        if (typeof m !== "string" || !ids.has(m)) {
          report.fail("expense.splitMemberIds", `expense ${e.id} references unknown member ${JSON.stringify(m)}`);
        }
        if (seen.has(m)) {
          report.fail("expense.splitMemberIds", `expense ${e.id} has duplicate split member ${JSON.stringify(m)}`);
        }
        seen.add(m);
      }
    }
  }
  return report.ok;
}

function auditLedger(ledger) {
  const report = new Report();
  if (!validateStructure(ledger, report)) {
    return report; // cannot safely run arithmetic on a malformed ledger
  }

  const participantIds = ledger.participants.map((p) => p.id).sort();
  const paid = new Map(participantIds.map((id) => [id, 0]));
  const share = new Map(participantIds.map((id) => [id, 0]));

  // Split conservation + accumulate paid/share, with overflow guards.
  let total = 0;
  let conservationOk = true;
  let fairnessOk = true;
  for (const e of ledger.expenses) {
    total += e.amountPaise;
    if (total > MAX_SAFE) {
      report.fail("overflow", `cumulative total exceeds Number.MAX_SAFE_INTEGER at expense ${e.id}`);
      return report;
    }
    const shares = splitShares(e.amountPaise, e.splitMemberIds);

    let sum = 0;
    let min = Infinity;
    let max = -Infinity;
    for (const [id, amt] of shares) {
      sum += amt;
      if (amt < min) min = amt;
      if (amt > max) max = amt;
      share.set(id, share.get(id) + amt);
    }
    if (sum !== e.amountPaise) {
      conservationOk = false;
      report.fail("conservation", `expense ${e.id}: shares sum to ${sum}, expected ${e.amountPaise}`);
    }
    if (max - min > 1) {
      fairnessOk = false;
      report.fail("fairness", `expense ${e.id}: share spread ${max - min} exceeds 1 paisa`);
    }
    paid.set(e.payerId, paid.get(e.payerId) + e.amountPaise);
  }
  if (conservationOk) report.pass("conservation");
  if (fairnessOk) report.pass("fairness");

  // Balances net to zero.
  const nets = new Map();
  let netSum = 0;
  for (const id of participantIds) {
    const net = paid.get(id) - share.get(id);
    nets.set(id, net);
    netSum += net;
  }
  if (netSum === 0) report.pass("balances-zero-sum");
  else report.fail("balances-zero-sum", `participant nets sum to ${netSum}, expected 0`);

  // Settlement validity + clearing.
  const nonZero = [...nets.values()].filter((n) => n !== 0).length;
  const plan = planSettlement(new Map(nets));

  let transfersOk = true;
  for (const t of plan) {
    if (!isSafePositiveInt(t.amountPaise)) {
      transfersOk = false;
      report.fail("settlement-amount", `transfer ${t.debtor}->${t.creditor} amount ${t.amountPaise} is not a positive safe integer`);
    }
    if (t.debtor === t.creditor) {
      transfersOk = false;
      report.fail("settlement-self", `self-transfer on ${t.debtor}`);
    }
  }
  if (transfersOk) report.pass("settlement-transfers");

  if (plan.length <= Math.max(0, nonZero - 1)) {
    report.pass("settlement-bound");
  } else {
    report.fail("settlement-bound", `plan has ${plan.length} transfers, exceeds n-1 = ${Math.max(0, nonZero - 1)}`);
  }

  // Apply plan and confirm every balance clears to zero.
  const cleared = new Map(nets);
  for (const t of plan) {
    cleared.set(t.debtor, cleared.get(t.debtor) + t.amountPaise);
    cleared.set(t.creditor, cleared.get(t.creditor) - t.amountPaise);
  }
  const residual = [...cleared.entries()].filter(([, n]) => n !== 0);
  if (residual.length === 0) {
    report.pass("settlement-clears");
  } else {
    report.fail("settlement-clears", `non-zero residual balances after settlement: ${JSON.stringify(residual)}`);
  }

  return report;
}

function main() {
  const path = process.argv[2];
  if (!path) {
    console.error("usage: node audit-ledger.mjs <ledger.json>");
    process.exit(2);
  }
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch (err) {
    console.error(`cannot read ${path}: ${err.message}`);
    process.exit(2);
  }
  let ledger;
  try {
    ledger = JSON.parse(raw);
  } catch (err) {
    console.error(`invalid JSON in ${path}: ${err.message}`);
    process.exit(1);
  }

  const report = auditLedger(ledger);
  for (const c of report.checks) {
    console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name}${c.ok ? "" : "  — " + c.detail}`);
  }
  if (report.ok) {
    console.log(`\nOK: ${path} passed all exact-money checks.`);
    process.exit(0);
  } else {
    console.error(`\nFAILED: ${path} has ${report.errors.length} problem(s).`);
    process.exit(1);
  }
}

main();
