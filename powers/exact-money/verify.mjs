#!/usr/bin/env node
// verify.mjs — proves the auditor accepts the valid fixtures and rejects every
// invalid one. Dependency-free (Node standard library only).
//
// Exit 0 only if ALL expectations hold:
//   - each accepted fixture   -> auditor exit code EXACTLY 0
//   - each rejected fixture    -> auditor exit code EXACTLY 1
//
// Exit code 1 means "a check failed" (the correct rejection signal). We require
// exactly 1 so that a null status (spawn failure), a crash, or a usage/IO error
// (exit 2) can never be mistaken for a successful rejection.
//
// Each rejection fixture under fixtures/reject/ is otherwise valid and carries
// exactly ONE structural fault, so a single combined fixture cannot hide a
// missing check: every structural rule is proven independently.
//
// Usage: node verify.mjs

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readdirSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const auditor = join(here, "skills", "money-audit", "scripts", "audit-ledger.mjs");
const fixturesDir = join(here, "fixtures");
const rejectDir = join(fixturesDir, "reject");

function runAuditor(fixture) {
  const result = spawnSync(process.execPath, [auditor, fixture], { encoding: "utf8" });
  // result.status is null if the process was killed/failed to spawn.
  return { code: result.status, out: (result.stdout || "") + (result.stderr || "") };
}

let failures = 0;

// --- Accepted fixtures: must exit EXACTLY 0 -------------------------------
const accepted = ["valid-ledger.json"];
for (const name of accepted) {
  const r = runAuditor(join(fixturesDir, name));
  if (r.code === 0) {
    console.log(`OK   ${name} accepted (exit 0)`);
  } else {
    console.log(`FAIL ${name} should pass but exited ${JSON.stringify(r.code)}`);
    console.log(r.out);
    failures++;
  }
}

// --- Rejected fixtures: must exit EXACTLY 1 -------------------------------
// The hand-written invalid-ledger.json (referential + non-integer faults) plus
// every single-fault structural fixture under fixtures/reject/.
const rejected = ["invalid-ledger.json"];
for (const name of readdirSync(rejectDir).sort()) {
  if (name.endsWith(".json")) rejected.push(join("reject", name));
}

for (const rel of rejected) {
  const r = runAuditor(join(fixturesDir, rel));
  if (r.code === 1) {
    console.log(`OK   ${rel} rejected (exit 1)`);
  } else {
    const got =
      r.code === null
        ? "null (spawn failure / killed)"
        : r.code === 2
          ? "2 (usage/IO error, not a check failure)"
          : String(r.code);
    console.log(`FAIL ${rel} should be rejected with exit 1 but exited ${got}`);
    console.log(r.out);
    failures++;
  }
}

if (failures === 0) {
  console.log(
    `\nVERIFY PASS: ${accepted.length} accepted (exit 0), ${rejected.length} rejected (exit 1).`,
  );
  process.exit(0);
} else {
  console.error(`\nVERIFY FAIL: ${failures} expectation(s) not met.`);
  process.exit(1);
}
