# Evidence — Phase 1c: Kiro cloud session documentation + power audit

This document records a real Kiro **cloud** session whose goal was a
documentation improvement and a power audit — not a code change. It records only
what actually happened: the observed cloud environment, the synced steering and
Exact Money power that were used, the commands run, and their real output. No
application source or package files were modified. No property-based tests were
created (that remains the user's Kiro IDE task).

## Environment (observed in this cloud session)
- Runtime: Linux sandbox, network mode `COMMON_DEPENDENCIES` (allowlisted
  package registries reachable; general internet restricted).
- Node `v22.23.3`; npm `11.4.2` (from `node --version` / `npm --version`).
  (This differs from the Node 24 / npm 11.13 recorded in `07-money-guardian.md`,
  which was a different, local session; recorded here as observed, not reconciled.)
- Repo remote is the Kiro connections gateway
  (`...gateway.connections.autonomous-agents.kiro.dev/github/...`), i.e. a real
  cloud-session clone, not a local checkout.
- Working branch for this task: `docs/money-review-cloud-session` (created off
  `main`; `main` was not committed to directly).

### One environment workaround (no app change)
`NODE_OPTIONS` was preset to `--require /opt/amazon/kiro-agent/proxy-bootstrap.js`,
a preload file that does not exist in this sandbox, so every raw `node`/`npm`
invocation initially aborted with `Cannot find module ... proxy-bootstrap.js`.
Resolved by exporting `NODE_OPTIONS=""` for the command invocations only. This
is a shell-environment workaround for running the tooling; it changed no
repository file.

## Synced steering and power actually used
- **Steering** (`.kiro/steering/product.md`, `tech.md`, `structure.md`) was read
  and governed the work: money-as-integer-paise, determinism-by-sorted-stable-ID,
  the pure-domain / persistence / UI boundary, and the "do not add property tests
  in phase 1" rule were all honored.
- **Exact Money power** (`powers/exact-money/`) was activated via its
  `money-audit` / exact-money / paise keywords. Its `money-audit` SKILL.md,
  `references/ledger-schema.json`, `references/oracle-patterns.md`, the
  `scripts/audit-ledger.mjs` auditor, `verify.mjs`, and both fixtures were read
  and run.

## Power audit — commands and real results

### Auditor on the bundled valid fixture
```
$ node skills/money-audit/scripts/audit-ledger.mjs fixtures/valid-ledger.json
PASS  conservation
PASS  fairness
PASS  balances-zero-sum
PASS  settlement-transfers
PASS  settlement-bound
PASS  settlement-clears

OK: fixtures/valid-ledger.json passed all exact-money checks.
exit=0
```

### Auditor on the bundled invalid fixture
```
$ node skills/money-audit/scripts/audit-ledger.mjs fixtures/invalid-ledger.json
FAIL  expense.splitMemberIds  — expense e1 references unknown member "p9-ghost"
FAIL  expense.amountPaise  — expense e2 amountPaise must be a positive safe integer, got 12.5

FAILED: fixtures/invalid-ledger.json has 2 problem(s).
exit=1
```

### Power verify command
```
$ node verify.mjs
OK   valid-ledger.json accepted (exit 0)
OK   invalid-ledger.json rejected (exit 1)

VERIFY PASS: auditor accepts valid and rejects invalid.
exit=0
```

### Auditor on the production `sampleLedger()` (normalized)
The production `sampleLedger()` from `src/domain/ledger.ts` was normalized to the
auditor's shape (flatten `PersistedDoc`, rename `dateISO → date` and
`splitIds → splitMemberIds`; `amountPaise` already integer paise) in a scratch
file under the gitignored `.execution/` directory, then audited and the scratch
file removed:
```
$ node powers/exact-money/skills/money-audit/scripts/audit-ledger.mjs .execution/sample-normalized.json
PASS  conservation
PASS  fairness
PASS  balances-zero-sum
PASS  settlement-transfers
PASS  settlement-bound
PASS  settlement-clears

OK: .execution/sample-normalized.json passed all exact-money checks.
exit=0
```
This exercises the real demo data, including the `90001`-paise expense split
three ways (remainder → `30001 / 30000 / 30000`).

## Project build/verify — commands and real results

### `npm ci`
```
added 71 packages, and audited 72 packages in 2s
found 0 vulnerabilities
exit=0
```

### `npm run typecheck` (`tsc --noEmit`)
Exit 0, no diagnostics.

### `npm run test` (`vitest run`, v5.0.3)
```
 ✓ src/domain/settlement.test.ts  (5 tests)
 ✓ src/domain/balances.test.ts    (4 tests)
 ✓ src/domain/split.test.ts       (10 tests)
 ✓ src/domain/ledger.test.ts      (14 tests)
 ✓ src/persistence/storage.test.ts (12 tests)
 ✓ src/domain/money.test.ts       (10 tests)

 Test Files  6 passed (6)
      Tests  55 passed (55)
exit=0
```

### `npm run build` (`tsc --noEmit && vite build`, v8.3.2)
```
vite v8.3.2 building client environment for production...
✓ 28 modules transformed.
dist/index.html                   0.45 kB │ gzip:  0.28 kB
dist/assets/index-DlCNjBpf.css    3.15 kB │ gzip:  1.24 kB
dist/assets/index-T8UmOJjG.js   159.16 kB │ gzip: 51.46 kB
✓ built in 92ms
exit=0
```

Package downloads were **not** blocked in this session: `npm ci` completed
against the allowlisted registry under `COMMON_DEPENDENCIES`.

## Documentation produced
- `docs/MONEY-REVIEW.md` — a substantive mapping of the Exact Money power's
  normalized audit fixtures and nine invariants onto the actual FairShare domain
  functions (`money.ts`, `split.ts`, `balances.ts`, `settlement.ts`,
  `ledger.ts`, `types.ts`), including the shape-adapter needed to run the
  auditor on production data, the places where production is *stricter* than the
  auditor, and explicit limitations.
- `docs/evidence/08-cloud-session.md` — this file.

## Honest limitations and non-claims
- **No application source or package files were changed** in this session. Only
  documentation under `docs/` was added.
- **No property-based tests were created.** The auditor and the existing
  example tests check concrete values; they do not prove universal properties.
  fast-check / PBT remains the user's Kiro IDE task.
- The auditor is an **independent oracle on concrete fixtures**, not a proof over
  all inputs; an auditor PASS does not establish production correctness for all
  ledgers, and does not cover production's stricter application bounds, participant
  limits, name/date rules (documented in `docs/MONEY-REVIEW.md`).
- No invented usage, eligibility, credits, or IDE properties are claimed. The
  Node/npm versions, network mode, remote, and command output above are as
  observed in this session.
- No social posts were published and no forms were submitted.
- Work is delivered on branch `docs/money-review-cloud-session` for review; it is
  **not** merged to `main`.
```

