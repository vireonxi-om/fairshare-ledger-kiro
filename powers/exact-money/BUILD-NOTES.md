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

## Update — final audit repairs (2026-10-04)

The sections above record the original packaging run and are left unchanged as
historical evidence. A later final-audit pass hardened the auditor and schema;
the current state differs from the original recorded output as follows:

- The auditor (`skills/money-audit/scripts/audit-ledger.mjs`) now enforces the
  full structural contract from `references/ledger-schema.json`: `schemaVersion`
  (required integer ≥ 1), `title` (required non-empty string), `date` (required
  non-empty string), and `additionalProperties: false` on the ledger root,
  participants, and expenses (unexpected keys are rejected). Previously these
  were silently ignored, so a document missing `schemaVersion`/`title`/`date` or
  carrying extra keys could pass. Reproduced before fixing.
- Added fixture `fixtures/invalid-schema.json` — a document that is internally
  consistent for money math but violates the structural contract (no
  `schemaVersion`, an extra top-level key, an extra participant key, and missing
  `title`/`date`). The auditor rejects it with 5 structural failures (exit 1).
- `verify.mjs` now also asserts `invalid-schema.json` is rejected. Current
  output:

  ```
  OK   valid-ledger.json accepted (exit 0)
  OK   invalid-ledger.json rejected (exit 1)
  OK   invalid-schema.json rejected (exit 1)

  VERIFY PASS: auditor accepts valid and rejects invalid.
  ```

- `references/ledger-schema.json` gained explicit safe-integer `maximum`
  (`9007199254740991`) on `schemaVersion` and `amountPaise`, and a
  `YYYY-MM-DD` `pattern` plus `minLength` on `date`. The previously valid and
  invalid fixtures keep their expectations (valid passes; invalid rejected).
- Added an MIT `LICENSE` file to this power directory to back the `MIT` license
  declared in `plugin.json`; previously no license file existed.
- Corrected the "exhaustive property tests" wording in `README.md` and
  `references/oracle-patterns.md` to "bounded randomized property tests"
  (property-based tests sample inputs; they are not an exhaustive proof).
- Fixed the normalized-ledger example in `README.md`, which listed only `p1`
  but referenced `p1,p2,p3` in `splitMemberIds`; it now defines all three
  participants.

## Update — final-review follow-up (2026-10-04)

A final review found two residual auditor/schema mismatches, reproduced before
fixing:

- `date: "today"` passed the auditor (exit 0) but the JSON Schema rejected it on
  the `YYYY-MM-DD` pattern. The auditor now enforces the exact
  `^\d{4}-\d{2}-\d{2}$` shape (no calendar-validity promise beyond the pattern,
  matching the schema and the "not used in money math" note).
- `schemaVersion: 9007199254740992` (2^53, beyond `Number.MAX_SAFE_INTEGER`)
  passed the auditor but the JSON Schema rejected it on `maximum`. The auditor
  now requires `schemaVersion` to be an integer in `[1, 9007199254740991]`.

Fixture layout changed to prevent a combined fixture from masking a missing
check:

- Removed the single combined `fixtures/invalid-schema.json`.
- Added `fixtures/reject/` with ten fixtures, each otherwise valid and carrying
  exactly ONE structural fault: `no-schema-version`, `schema-version-overflow`,
  `schema-version-zero`, `extra-root-key`, `extra-participant-key`,
  `extra-expense-key`, `missing-title`, `bad-title-type`, `missing-date`,
  `bad-date-pattern`.
- `verify.mjs` now requires accepted fixtures to exit **exactly 0** and every
  rejection fixture to exit **exactly 1** — a `null` status (spawn failure) or
  exit `2` (usage/IO) no longer counts as a rejection. It iterates every file in
  `fixtures/reject/`. Current output:

  ```
  OK   valid-ledger.json accepted (exit 0)
  OK   invalid-ledger.json rejected (exit 1)
  OK   reject/bad-date-pattern.json rejected (exit 1)
  OK   reject/bad-title-type.json rejected (exit 1)
  OK   reject/extra-expense-key.json rejected (exit 1)
  OK   reject/extra-participant-key.json rejected (exit 1)
  OK   reject/extra-root-key.json rejected (exit 1)
  OK   reject/missing-date.json rejected (exit 1)
  OK   reject/missing-title.json rejected (exit 1)
  OK   reject/no-schema-version.json rejected (exit 1)
  OK   reject/schema-version-overflow.json rejected (exit 1)
  OK   reject/schema-version-zero.json rejected (exit 1)

  VERIFY PASS: 1 accepted (exit 0), 11 rejected (exit 1).
  ```

Runtime auditor and the JSON Schema (`jsonschema` Draft 2020-12) now agree on
every fixture: the valid fixture is accepted by both, and all 11 rejection
fixtures are rejected by both.
