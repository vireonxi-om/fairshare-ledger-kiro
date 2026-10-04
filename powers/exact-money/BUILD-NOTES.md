# BUILD-NOTES — Exact Money power

Factual record of how this power was packaged and what was verified. This
document covers packaging and local verification only. It does not claim
installation into Kiro, registry acceptance, cloud usage, or credit consumption.

## Scope

- Task: package an original Kiro power under `powers/exact-money/`
  (per `.execution/prompts/02-power.md`).
- No application code, root `package.json`, steering, or app spec was modified.
  The power is self-contained under `powers/exact-money/`.
- References used: `.execution/research/create-power.txt` (Agent Plugins 1.0.0
  power creation guide) and `.execution/research/plugin-schema.json`
  (manifest schema). The assumed domain model was taken from
  `.kiro/specs/fairshare-ledger/requirements.md`.

## Environment

- Node.js: v24.16.0
- Python: 3.12.3
- jsonschema: 4.26.0

## Deliverables

```
powers/exact-money/
├─ plugin.json
├─ README.md
├─ BUILD-NOTES.md
├─ verify.mjs
├─ fixtures/
│  ├─ valid-ledger.json
│  └─ invalid-ledger.json
└─ skills/money-audit/
   ├─ SKILL.md
   ├─ scripts/audit-ledger.mjs
   └─ references/
      ├─ design-notes.md
      ├─ oracle-patterns.md
      └─ ledger-schema.json
```

The auditor and verification runner use the Node standard library only
(`node:fs`, `node:child_process`, `node:path`, `node:url`); no third-party
dependencies and no `package.json` were added.

## Manifest

- Format: Agent Plugins 1.0.0 (`$schema`
  `https://agent-plugins.org/schemas/1.0.0/plugin.schema.json`).
- Required fields present: `$schema`, `name` (`exact-money`), `version`
  (`1.0.0`), `description`, `author.name` (`FairShare Ledger project` —
  provisional, no entrant name invented), `keywords` (15 terms).
- Optional field `license` set to `MIT`.

## Verification results

All commands below were run from `powers/exact-money/`.

### 1. Auditor on the valid fixture

Command:
`node skills/money-audit/scripts/audit-ledger.mjs fixtures/valid-ledger.json`

Output:

```
PASS  conservation
PASS  fairness
PASS  balances-zero-sum
PASS  settlement-transfers
PASS  settlement-bound
PASS  settlement-clears

OK: fixtures/valid-ledger.json passed all exact-money checks.
```

Exit code: `0`.

### 2. Auditor on the invalid fixture

Command:
`node skills/money-audit/scripts/audit-ledger.mjs fixtures/invalid-ledger.json`

Output:

```
FAIL  expense.splitMemberIds  — expense e1 references unknown member "p9-ghost"
FAIL  expense.amountPaise  — expense e2 amountPaise must be a positive safe integer, got 12.5

FAILED: fixtures/invalid-ledger.json has 2 problem(s).
```

Exit code: `1`. The invalid fixture is rejected for two independent reasons:
a split member that is not a known participant, and a non-integer paise amount.

### 3. Verification runner

Command: `node verify.mjs`

Output:

```
OK   valid-ledger.json accepted (exit 0)
OK   invalid-ledger.json rejected (exit 1)

VERIFY PASS: auditor accepts valid and rejects invalid.
```

Exit code: `0`.

### 4. Manifest validation against the schema

Validated `plugin.json` against `.execution/research/plugin-schema.json` using
Python `jsonschema` (`Draft202012Validator`, with `check_schema` on the schema
first). Result: `MANIFEST VALID against plugin.schema.json (Draft 2020-12)`,
exit code `0`, no errors.

### 5. Fixture validation against the normalized ledger schema

Validated both fixtures against
`skills/money-audit/references/ledger-schema.json` with the same validator:

- `fixtures/valid-ledger.json` → VALID.
- `fixtures/invalid-ledger.json` → 1 schema error:
  `['expenses', 1, 'amountPaise'] 12.5 is not of type 'integer'`.

This confirms the invalid fixture is independently rejected both by the runtime
auditor and by the JSON Schema.

## Notes on correctness of the valid fixture

The valid fixture exercises deterministic remainder allocation:

- `e1`: 1000 paise split among `p1,p2,p3` → 334/333/333 (remainder 1 paisa to
  the first ID by ascending sort, `p1`).
- `e2`: 457 paise split among `p2,p3` → 229/228 (remainder 1 paisa to `p2`).
- `e3`: 99900 paise split among `p1,p2,p3` → 33300 each (no remainder).

Participant nets sum to zero and the greedy settlement clears all balances in at
most `n − 1` transfers, as reported by the `balances-zero-sum`,
`settlement-bound`, and `settlement-clears` checks above.

## Explicit non-claims

- This task packaged the power; installation and activation in Kiro happen
  later and are not asserted here.
- No claim of registry acceptance, cloud session usage, or credit consumption.
- No public publishing or commits were performed as part of this task.
