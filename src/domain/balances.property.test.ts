import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { computeBalances } from "./balances";
import { validLedger } from "./ledger.arbitrary";
import type { Ledger } from "./types";

/**
 * Property tests for balances — P5 (Req 4.1–4.3).
 *
 * Bounded randomized checks under explicit seeds; not formal proofs.
 *
 * Oracles:
 *  - zero-sum: BigInt sum of production nets is 0n.
 *  - per-participant recomputation (`oracleBalances`): independent BigInt
 *    recomputation from the RAW expenses. It does not call `splitEqualPaise`
 *    or `computeBalances`. It sorts splitIds lexicographically, computes
 *    q = amount / k and r = amount % k, gives the first r sorted ids q + 1 and
 *    the rest q, and credits the full amount to the payer. (It shares the
 *    lexicographic-sort convention with production by design: that convention
 *    is the specified behaviour.)
 */

const SEED_ZERO_SUM = 0x2c0de001;
const SEED_NET_DEF = 0x2c0de002;
const SEED_ORACLE = 0x2c0de003;
const SEED_ORACLE_SHUFFLED = 0x2c0de004;
const RUNS = 500;

interface OracleBalance {
  paid: bigint;
  share: bigint;
  net: bigint;
}

function oracleBalances(ledger: Ledger): Map<string, OracleBalance> {
  const result = new Map<string, OracleBalance>();
  for (const p of ledger.participants) {
    result.set(p.id, { paid: 0n, share: 0n, net: 0n });
  }
  for (const e of ledger.expenses) {
    const amount = BigInt(e.amountPaise);
    const sorted = [...e.splitIds].sort(); // default code-unit lexicographic order
    const k = BigInt(sorted.length);
    const q = amount / k;
    const r = amount % k;
    const payer = result.get(e.payerId);
    if (!payer) throw new Error(`oracle: unknown payer ${e.payerId}`);
    payer.paid += amount;
    sorted.forEach((id, i) => {
      const entry = result.get(id);
      if (!entry) throw new Error(`oracle: unknown member ${id}`);
      entry.share += BigInt(i) < r ? q + 1n : q;
    });
  }
  for (const b of result.values()) b.net = b.paid - b.share;
  return result;
}

function expectMatchesOracle(ledger: Ledger): void {
  const actual = computeBalances(ledger);
  const expected = oracleBalances(ledger);
  expect([...actual.keys()].sort()).toEqual([...expected.keys()].sort());
  expect(actual.size).toBe(ledger.participants.length);
  for (const [id, want] of expected) {
    const got = actual.get(id);
    expect(got).toBeDefined();
    if (!got) continue;
    expect(BigInt(got.paid)).toBe(want.paid);
    expect(BigInt(got.share)).toBe(want.share);
    expect(BigInt(got.net)).toBe(want.net);
  }
}

/** A ledger plus a copy with participants and every splitIds list reordered. */
const ledgerWithShuffledVariant: fc.Arbitrary<[Ledger, Ledger]> = validLedger().chain(
  (ledger) =>
    fc
      .tuple(
        fc.shuffledSubarray(ledger.participants, {
          minLength: ledger.participants.length,
          maxLength: ledger.participants.length,
        }),
        fc.tuple(
          ...ledger.expenses.map((e) =>
            fc.shuffledSubarray(e.splitIds, {
              minLength: e.splitIds.length,
              maxLength: e.splitIds.length,
            }),
          ),
        ),
      )
      .map(([participants, splits]): [Ledger, Ledger] => [
        ledger,
        {
          currency: ledger.currency,
          participants,
          expenses: ledger.expenses.map((e, i) => ({ ...e, splitIds: splits[i] })),
        },
      ]),
);

describe("computeBalances — properties (P5)", () => {
  it("sum of all participant nets is exactly zero (P5)", () => {
    fc.assert(
      fc.property(validLedger(), (ledger) => {
        const balances = computeBalances(ledger);
        let total = 0n;
        for (const b of balances.values()) total += BigInt(b.net);
        expect(total).toBe(0n);
        expect(balances.size).toBe(ledger.participants.length);
      }),
      { seed: SEED_ZERO_SUM, numRuns: RUNS },
    );
  });

  it("net === paid − share for every participant, and all are integers", () => {
    fc.assert(
      fc.property(validLedger(), (ledger) => {
        const balances = computeBalances(ledger);
        for (const b of balances.values()) {
          expect(Number.isSafeInteger(b.paid)).toBe(true);
          expect(Number.isSafeInteger(b.share)).toBe(true);
          expect(b.net).toBe(b.paid - b.share);
        }
      }),
      { seed: SEED_NET_DEF, numRuns: RUNS },
    );
  });

  it("paid/share/net per participant match an independent BigInt recomputation from raw expenses (P5)", () => {
    fc.assert(
      fc.property(validLedger(), (ledger) => {
        expectMatchesOracle(ledger);
      }),
      { seed: SEED_ORACLE, numRuns: RUNS },
    );
  });

  it("oracle match holds, and results are identical, under shuffled participant and splitIds order (P4/P5)", () => {
    fc.assert(
      fc.property(ledgerWithShuffledVariant, ([original, shuffled]) => {
        expectMatchesOracle(original);
        expectMatchesOracle(shuffled);
        const a = computeBalances(original);
        const b = computeBalances(shuffled);
        expect([...b.keys()].sort()).toEqual([...a.keys()].sort());
        for (const [id, bal] of a) expect(b.get(id)).toEqual(bal);
      }),
      { seed: SEED_ORACLE_SHUFFLED, numRuns: RUNS },
    );
  });
});
