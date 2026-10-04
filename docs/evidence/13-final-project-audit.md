# Final project audit — concrete repairs

Scope: five concrete gaps the operator identified by reviewing source. Each was
reproduced before fixing. Meaningful example/integration regression tests were
added. No existing property tests were rewritten. This pass did **not** happen
in the earlier Kiro IDE property phase; the authentic IDE history under
`docs/evidence/04-ide-properties.md` is left intact. No commits, pushes,
accounts, social posts, forms, or GUI actions were performed. Public entry still
requires video/social/identity approval; full eligibility and any credit award
remain unconfirmed.

Environment: Node `v24.16.0`, npm, local run on 2026-10-04.

---

## Issue 1 — domain helpers emitted ledgers `validateLedger` rejects

**Reproduced.** `addParticipant` accepted an empty or duplicate `id`, and
`addExpense` accepted an empty or duplicate expense `id`, even though
`validateLedger` rejects empty/duplicate ids. A throwaway test confirmed all
three helpers returned `{ ok: true }` for inputs that produce a ledger
`validateLedger` then returns `null` for. The domain API could therefore emit an
invalid ledger.

**Fix** (`src/domain/ledger.ts`):
- `addParticipant` now rejects a non-string / empty / whitespace-only `id` and a
  duplicate `id` before constructing the participant.
- `addExpense` now rejects a non-string / empty / whitespace-only `id` and a
  duplicate expense `id`, and requires `participants.length >= MIN_PARTICIPANTS`
  (2), matching the product/spec requirement and the existing `ExpenseForm` UI
  gate.
- Harmless display names and the caller's original input objects are preserved;
  helpers return a new ledger and never mutate their arguments.

**Regression tests** (`src/domain/ledger.test.ts`, new `describe` block):
- empty/whitespace participant id rejected; frozen input unchanged.
- duplicate participant id rejected; ledger unchanged.
- empty and duplicate expense id rejected; frozen input unchanged.
- `addExpense` requires two participants.
- a ledger built only through helpers always passes `validateLedger`.

---

## Issue 2 — `ExpenseForm` date default + stale selections

**Reproduced (date).** `todayISO` used `new Date().toISOString().slice(0,10)`,
which formats in UTC. At the India midnight boundary this defaults to the wrong
calendar day:

```
instant 2026-03-14T19:00:00Z  (== 2026-03-15 00:30 IST)
UTC slice (buggy):  2026-03-14
local components:   2026-03-15
```

**Reproduced (stale selections).** `ExpenseForm` kept `payer`/`splitIds` in local
state with no reconciliation, so replacing the ledger (import/sample/reset) or
removing a participant left a selected id that no longer exists in the ledger.

**Fix** (`src/ui/ExpenseForm.tsx`):
- `todayISO` now builds `YYYY-MM-DD` from `getFullYear`/`getMonth`/`getDate`
  (local calendar components), so the default matches the user's local day.
- Added a reconciliation `useEffect` that clears a selected payer and prunes any
  split members not present in the current `ledger.participants`.

**Regression tests** (`src/ui/ExpenseForm.test.tsx`, new jsdom file):
- fake-time test pins system time to `2026-03-14T19:00:00Z` and asserts the Date
  field shows the **local** day (and, when local != UTC, is not the UTC day).
- selecting a payer then replacing the ledger clears the stale payer to `""`.
- selecting split members then removing a participant prunes the stale selection
  without crashing.

---

## Issue 3 — Exact Money auditor ignored structural schema fields

**Reproduced.** The bundled auditor claimed structural schema validation but
accepted documents that:
- omit `schemaVersion` entirely,
- carry additional/unexpected top-level, participant, or expense keys,
- omit or wrongly type `title` and `date`.

Two throwaway docs (missing `schemaVersion` + extra key + no title/date; and
bad-typed `schemaVersion`/`title`/`date` + extra participant key) both exited `0`
("passed all exact-money checks") before the fix. The README normalized example
also listed only participant `p1` yet referenced `p1,p2,p3` in `splitMemberIds`.

**Fix** (dependency-free):
- `skills/money-audit/scripts/audit-ledger.mjs` now enforces its own schema:
  `schemaVersion` required integer >= 1; `title` and `date` required non-empty
  strings; `additionalProperties: false` on ledger root, participants, and
  expenses (unexpected keys rejected). No FairShare-specific limits were imposed
  on the generic power.
- `skills/money-audit/references/ledger-schema.json` gained safe-integer
  `maximum` (`9007199254740991`) on `schemaVersion` and `amountPaise`, and a
  `YYYY-MM-DD` `pattern` + `minLength` on `date`.
- Added `fixtures/invalid-schema.json` (money-consistent but structurally
  invalid) and extended `verify.mjs` to assert it is rejected.
- Fixed the README normalized example to define `p1,p2,p3`.
- `BUILD-NOTES.md` gained a dated "Update" section recording these changes
  without altering the original recorded output.

**Results.** Runtime auditor on the new fixture:

```
FAIL  schemaVersion  — expected an integer >= 1, got undefined
FAIL  structure      — unexpected top-level key(s): bogusTopLevelKey
FAIL  participant    — participant p1 has unexpected key(s): nickname
FAIL  expense.title  — expense e1 title must be a non-empty string, got undefined
FAIL  expense.date   — expense e1 date must be a non-empty string, got undefined
exit=1
```

Independent JSON Schema (`jsonschema` Draft 2020-12) agrees, and prior fixtures
keep their expectations:

```
fixtures/valid-ledger.json:    SCHEMA-VALID
fixtures/invalid-ledger.json:  1 schema error  (['expenses',1,'amountPaise'] 12.5 is not of type 'integer')
fixtures/invalid-schema.json:  5 schema error(s)  (schemaVersion required; additionalProperties; title/date required; participant extra key)
```

---

## Issue 4 — power claimed MIT with no license file

**Reproduced.** `powers/exact-money/plugin.json` declares `"license": "MIT"` and
the README ends with "License: MIT", but no `LICENSE` file existed in the power
or at the repo root.

**Fix.** Added an MIT `LICENSE` at the repository root and inside
`powers/exact-money/`. Copyright line:
`FairShare Ledger project (github: vireonxi-om)` — the project's GitHub handle
only; no private personal identity.

---

## Issue 5 — inaccurate documentation claims

**Node version requirement (corrected).** `README.md` said "Node 20.19+ or
22.12+". The actually installed toolchain's `engines` are stricter:
`vitest@5.0.3` -> `^22.12 || ^24 || >=26`; `jsdom@30.1.2` -> `^22.22.2 ||
^24.15 || >=26`. The intersection (jsdom governs) is **Node 22.22+, 24.15+, or
26+**. README now states this and explains the derivation. The prompt's
parenthetical (">=20.19 or >=22.12") reflected a looser/older jsdom range; the
installed `jsdom@30.1.2` requires the higher floors above. Verified by reading
each package's `engines`.

**"Exhaustive" PBT wording (corrected).** `powers/exact-money/README.md` and
`skills/money-audit/references/oracle-patterns.md` described lifting invariants
into "exhaustive property tests". Property-based tests sample inputs and are not
an exhaustive proof. Both now say "bounded randomized property tests" and note
they are not an exhaustive proof. The project's own test docs already stated
"bounded randomized checks, not proof"; those were left intact.

---

## Full verification (exact commands and results)

```
$ node --version
v24.16.0

$ npm run typecheck
> tsc --noEmit
(exit 0, no output)

$ npm test
 Test Files  14 passed (14)
      Tests  101 passed (101)
(was 92 across 13 files; +9: 6 domain identity + 3 ExpenseForm UI)

$ npm run build
> tsc --noEmit && vite build
✓ 28 modules transformed.
dist/index.html                   0.45 kB
dist/assets/index-*.css           6.69 kB
dist/assets/index-*.js          161.95 kB
✓ built (exit 0)

$ node powers/exact-money/verify.mjs
OK   valid-ledger.json accepted (exit 0)
OK   invalid-ledger.json rejected (exit 1)
OK   invalid-schema.json rejected (exit 1)
VERIFY PASS: auditor accepts valid and rejects invalid.   (exit 0)

$ npm audit
found 0 vulnerabilities

# schema validation (jsonschema Draft 2020-12)
ledger-schema.json: valid=SCHEMA-VALID, invalid=1 err, invalid-schema=5 errs
```

## Files changed

- `src/domain/ledger.ts` — identity + min-participant guards in `addParticipant`
  / `addExpense`; `MIN_PARTICIPANTS` import.
- `src/ui/ExpenseForm.tsx` — local-day `todayISO`; stale-selection reconciliation.
- `src/domain/ledger.test.ts` — identity-validation regression block.
- `src/ui/ExpenseForm.test.tsx` — new UI regressions (date boundary + stale).
- `powers/exact-money/skills/money-audit/scripts/audit-ledger.mjs` — structural
  schema enforcement.
- `powers/exact-money/skills/money-audit/references/ledger-schema.json` — safe
  maxima + date pattern.
- `powers/exact-money/fixtures/invalid-schema.json` — new rejection fixture.
- `powers/exact-money/verify.mjs` — assert new fixture rejected.
- `powers/exact-money/README.md` — normalized example fix + wording.
- `powers/exact-money/skills/money-audit/references/oracle-patterns.md` — wording.
- `powers/exact-money/BUILD-NOTES.md` — appended dated update section.
- `LICENSE`, `powers/exact-money/LICENSE` — MIT license files.
- `README.md` — corrected Node version requirement.

## Non-claims

- No property tests were rewritten; the authentic IDE phase evidence is intact.
- These repairs were done in this CLI pass, not the prior IDE phase.
- No network publishing, commits, pushes, account changes, social posts, forms,
  or GUI interaction were performed.

---

## Follow-up correction — final-review residual mismatches (2026-10-04)

A final review found two residual auditor/schema mismatches not caught by the
first pass. Both were reproduced before fixing.

### 6 — `date` shape not enforced by the runtime auditor

**Reproduced.** `date: "today"` exited the auditor `0` (accepted) while the JSON
Schema rejected it on the `^\d{4}-\d{2}-\d{2}$` pattern. The first pass only
checked `date` was a non-empty string.

**Fix.** The auditor now enforces the exact `^\d{4}-\d{2}-\d{2}$` shape via a
`DATE_RE` constant. It keeps **no** calendar-validity promise beyond the pattern
(it does not reject e.g. `2026-02-31`), matching the schema (pattern only) and
the "not used in money math" note.

### 7 — `schemaVersion` upper bound not enforced by the runtime auditor

**Reproduced.** `schemaVersion: 9007199254740992` (2^53, beyond
`Number.MAX_SAFE_INTEGER`) exited the auditor `0` while the JSON Schema rejected
it on `maximum`. The first pass only checked `>= 1`.

**Fix.** The auditor now requires `schemaVersion` to be an integer in
`[1, 9007199254740991]`, so values that are not exactly representable are
rejected rather than coerced.

### Per-fault fixtures + stricter verify exit codes

- Removed the single combined `fixtures/invalid-schema.json` (a combined fixture
  can mask a missing check: it passes as long as *any one* fault is caught).
- Added `fixtures/reject/` with ten fixtures, each otherwise valid with exactly
  ONE structural fault: `no-schema-version`, `schema-version-overflow`,
  `schema-version-zero`, `extra-root-key`, `extra-participant-key`,
  `extra-expense-key`, `missing-title`, `bad-title-type`, `missing-date`,
  `bad-date-pattern`. Each independently proves one rule.
- `verify.mjs` now requires accepted fixtures to exit **exactly 0** and every
  rejection fixture to exit **exactly 1**. A `null` status (spawn failure) or
  exit `2` (usage/IO error) no longer counts as a rejection. It iterates every
  file in `fixtures/reject/` automatically.

### README / engines precision

- README Node floor made precise: **22.22.2+, 24.15.0+, or >=26** (jsdom@30.1.2
  floor), with a note that `package.json` `engines` declares the same.
- Added `engines.node = "^22.22.2 || ^24.15.0 || >=26.0.0"` to `package.json`,
  matching the installed jsdom/vitest intersection.

### Follow-up verification (TZ=Asia/Kolkata)

```
$ TZ=Asia/Kolkata npm run typecheck      -> exit 0
$ TZ=Asia/Kolkata npm test               -> 14 files, 101 tests passed
$ TZ=Asia/Kolkata npm run build          -> built, exit 0
$ TZ=Asia/Kolkata npm audit              -> found 0 vulnerabilities
$ node powers/exact-money/verify.mjs     -> VERIFY PASS: 1 accepted (exit 0), 11 rejected (exit 1)
```

Runtime auditor vs JSON Schema (`jsonschema` Draft 2020-12) now **agree on every
fixture**: valid accepted by both; all 11 rejection fixtures rejected by both.
Under `TZ=Asia/Kolkata` the ExpenseForm date-boundary test exercises the real
divergence (local `2026-03-15` vs UTC `2026-03-14`) and passes, confirming the
fix at the India midnight boundary rather than vacuously. No property tests were
rewritten; no GUI, account, publishing, or commit actions were performed.
