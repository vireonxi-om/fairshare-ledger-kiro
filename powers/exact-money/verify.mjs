#!/usr/bin/env node
// verify.mjs — proves the auditor accepts the valid fixture and rejects the
// invalid one. Dependency-free (Node standard library only).
//
// Exit 0 only if BOTH expectations hold:
//   - valid-ledger.json   -> auditor exit code 0
//   - invalid-ledger.json -> auditor exit code non-zero
//
// Usage: node verify.mjs

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const auditor = join(here, "skills", "money-audit", "scripts", "audit-ledger.mjs");
const validFixture = join(here, "fixtures", "valid-ledger.json");
const invalidFixture = join(here, "fixtures", "invalid-ledger.json");

function runAuditor(fixture) {
  const result = spawnSync(process.execPath, [auditor, fixture], { encoding: "utf8" });
  return { code: result.status, out: (result.stdout || "") + (result.stderr || "") };
}

let failures = 0;

const valid = runAuditor(validFixture);
if (valid.code === 0) {
  console.log("OK   valid-ledger.json accepted (exit 0)");
} else {
  console.log(`FAIL valid-ledger.json should pass but exited ${valid.code}`);
  console.log(valid.out);
  failures++;
}

const invalid = runAuditor(invalidFixture);
if (invalid.code !== 0) {
  console.log(`OK   invalid-ledger.json rejected (exit ${invalid.code})`);
} else {
  console.log("FAIL invalid-ledger.json should be rejected but exited 0");
  console.log(invalid.out);
  failures++;
}

if (failures === 0) {
  console.log("\nVERIFY PASS: auditor accepts valid and rejects invalid.");
  process.exit(0);
} else {
  console.error(`\nVERIFY FAIL: ${failures} expectation(s) not met.`);
  process.exit(1);
}
