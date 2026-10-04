# Money review — Exact Money power ↔ FairShare domain

This document maps the **Exact Money** power's audit model (its normalized
ledger fixtures, auditor script, and the nine money invariants in its
`money-audit` skill) onto the **actual** FairShare Ledger domain code, so a
reviewer can see exactly which production function enforces each invariant,
where the two models' shapes differ, and what the audit does **not** cover.

It is a review artifact only. It makes no claim that the production code is
proven correct — the auditor and example tests check concrete values, not
universal properties (see [Limitations](#limitations-and-non-claims)).

## 1. Two models, one shape difference

The power ships a *normalized* ledger shape (its auditor's input) that is close
to, but not identical to, the production `Ledger` type. The invariants are
shape-independent; only the field access differs. The mapping:

| Concept | Power normalized shape (`references/ledger-schema.json`) | Production domain (`src/domain/types.ts`) |
| --- | --- | --- |
| Root wrapper | `{ schemaVersion, currency, participants, expenses }` (flat) | `PersistedDoc { schemaVersion, ledger: Ledger }`; `Ledger { currency, participants, expenses }` (nested) |
| Participant | `{ id, name }` | `Participant { id, name }` |
| Expense amount | `amountPaise` (positive safe integer) | `amountPaise` (positive safe integer) |
| Expense date | `date` ("YYYY-MM-DD", carried, not used in math) | `dateISO` ("YYYY-MM-DD") |
| Split members | `splitMemberIds: string[]` | `splitIds: string[]` |
| Currency | `const "INR"` | `type Currency = "INR"` |

**Normalization needed to run the bundled auditor against production data:** the
production export (a `PersistedDoc`) must be flattened (`doc.ledger` lifted to
the root) and two fields renamed — `dateISO → date`, `splitIds → splitMemberIds`.
No value transformation is required: `amountPaise` is already integer paise in
both. This renaming/flattening is exactly the "write a small adapter to the
normalized shape" path the skill's Step 4 calls for.

The production `sampleLedger()` (`src/domain/ledger.ts`), normalized this way,
was run through the auditor during this review and **passed all six checks**
(see `docs/evidence/08-cloud-session.md` for the command and output).

## 2. Invariant → production function map

The skill defines nine invariants (SKILL.md "Core invariants"; the
`oracle-patterns.md` labels P1–P9). For each: where it lives in production, and
how the auditor exercises it.

### Inv. 1 — Integer minor units
- **Production:** `amountPaise: number` is documented as "always an integer" in
  `src/domain/types.ts`; every money field (`paid`, `share`, `net`,
  `Transfer.amountPaise`) is integer paise. No `float` ever holds a money value.
- **Auditor:** `isSafePositiveInt` rejects any non-integer `amountPaise`
  (the invalid fixture's `12.5` is caught here).
- **Status in this review:** holds. Grep for float-money smells
  (`parseFloat`, `* 100` / `/ 100` on money, `toFixed`, `Math.round` on money)
  found only the two legitimate edge operations noted in Inv. 2.

### Inv. 2 — Exact parsing
- **Production:** `parseMoneyToPaise` (`src/domain/money.ts`) matches
  `^(\d+)(?:\.(\d{1,2}))?$`, pads the fraction to two digits as a **string**,
  and computes `rupees * 100 + frac2` on integer operands. It never does
  `parseFloat(text) * 100`. The only `/ 100` in the codebase is inside
  `formatPaise`, at the display edge (see Inv. formatting below).
- **Auditor:** out of scope — the auditor validates already-parsed integer
  paise and does **not** re-parse text (README "Not a parser"). Parsing
  correctness is covered by `money.test.ts` (BigInt-oracle agreement across the
  accepted range).
- **Status:** holds (by code + example tests); not exercised by the auditor.

### Inv. 3 — Deterministic remainder allocation
- **Production:** `splitEqualPaise` (`src/domain/split.ts`) sorts member ids
  lexicographically (`[...memberIds].sort()`), gives each `floor(amount / k)`,
  and hands the remainder `amount % k` one paisa at a time to the first `r`
  **sorted** ids. Order does not depend on insertion or map iteration order.
- **Auditor:** `splitShares` independently re-derives the same allocation
  (sort by id, base + 1 for `i < remainder`) and checks it per expense.
- **Status:** holds. Determinism is also asserted in `split.test.ts`.

### Inv. 4 — Conservation
- **Production:** shares from `splitEqualPaise` sum to the amount by
  construction (`base * k + r === amount`); `computeBalances`
  (`src/domain/balances.ts`) credits each expense's full amount to one payer and
  distributes exactly those shares.
- **Auditor:** `conservation` check — sums the re-derived shares per expense and
  asserts `sum === amountPaise`. **PASS** on valid + normalized sample fixtures.
- **Status:** holds. (The `90001`-paise sample expense split 3 ways exercises a
  non-zero remainder: `30001 / 30000 / 30000`.)

### Inv. 5 — Fairness bound
- **Production:** by construction any two shares differ by at most 1 paisa (only
  the first `r` sorted members get the `+1`).
- **Auditor:** `fairness` check — asserts `max(share) - min(share) <= 1` per
  expense. **PASS**.
- **Status:** holds.

### Inv. 6 — Balances net to zero
- **Production:** `computeBalances` sets `net = paid - share`; since every
  expense's full amount is credited to one payer and its shares sum to that same
  amount, the global sum of nets is exactly 0. The exact-integer bounds
  (`MAX_EXPENSE_PAISE`, `MAX_LEDGER_TOTAL_PAISE` in `types.ts`, enforced in
  `addExpense`/`validateLedger`) keep this exact rather than silently rounding.
- **Auditor:** `balances-zero-sum` check — recomputes `paid - share` per
  participant and asserts the sum is `0`. **PASS**.
- **Status:** holds.

### Inv. 7 — Settlement validity
- **Production:** `planSettlement` (`src/domain/settlement.ts`) is a greedy
  two-pointer over debtors/creditors, both sorted by stable id. It emits only
  positive integer amounts, never a self-transfer (debtor and creditor sets are
  disjoint), and at most `n − 1` transfers for `n` non-zero participants.
- **Auditor:** three checks — `settlement-transfers` (positive safe-int, no
  self-transfer), `settlement-bound` (`plan.length <= n − 1`),
  `settlement-clears` (applying the plan zeroes every balance). All **PASS**.
- **Status:** holds. Minimality is **not** claimed (see Limitations).

### Inv. 8 — Bounds / overflow
- **Production:** `MAX_EXPENSE_PAISE = 1e15` caps a single expense;
  `MAX_LEDGER_TOTAL_PAISE = 9e15 (< Number.MAX_SAFE_INTEGER)` caps the running
  total, enforced in `addExpense` (running sum) and `validateLedger`
  (import/stored docs). This keeps every derived aggregate exact.
- **Auditor:** guards the cumulative `total` against `Number.MAX_SAFE_INTEGER`
  and rejects non-safe-integer amounts, but uses the raw `MAX_SAFE_INTEGER`
  ceiling, **not** the stricter production application bounds (`1e15` / `9e15`).
- **Status:** holds, with a **coverage gap**: the auditor would accept amounts
  between the production bounds and `MAX_SAFE_INTEGER` that production rejects.
  Those application-bound rejections are covered by `money.test.ts` /
  `ledger.test.ts`, not by the auditor.

### Inv. 9 — Import integrity
- **Production:** `validateLedger` / `validatePersistedDoc`
  (`src/domain/ledger.ts`) fully validate an untrusted value and return `null`
  on any structural or referential problem; `importDoc` in persistence applies
  only on success, so a rejected import never partially overwrites existing data.
- **Auditor:** `validateStructure` performs structural + referential checks and
  bails before any arithmetic on a malformed ledger (the invalid fixture is
  rejected: unknown split member `p9-ghost` and fractional `amountPaise 12.5`).
  This mirrors — but is independent of — the production validator.
- **Status:** holds. The auditor confirms the *shape* of atomic rejection on
  concrete data; the no-partial-write guarantee itself is a persistence-layer
  property covered by `storage.test.ts`, not by the auditor.

## 3. Fixtures ↔ production behavior

| Auditor fixture | What it exercises | Production analogue |
| --- | --- | --- |
| `valid-ledger.json` (3 participants; `457` split 2 ways → `229/228`; `99900` split 3 ways → `33300` each) | conservation, fairness, zero-sum, bounded clearing settlement | Same math as `splitEqualPaise` + `computeBalances` + `planSettlement`; the `457/2` case mirrors the sample's `90001/3` remainder case |
| `invalid-ledger.json` (`p9-ghost` not a participant; `amountPaise: 12.5`) | referential integrity + integer-minor-unit rejection, before any arithmetic | `validateLedger` rejects both: unknown split id, and `amountPaise` failing `Number.isSafeInteger` / `> 0` |
| normalized `sampleLedger()` (this review) | end-to-end on real production demo data (incl. `90001`-paise remainder) | the exact object returned by `sampleLedger()` in `src/domain/ledger.ts` |

## 4. Where production is stricter than the auditor

The production domain enforces several constraints the bundled auditor does
**not** model. These are not auditor failures — the auditor is deliberately a
minimal independent oracle — but a reviewer should not read an auditor PASS as
covering them:

- **Application money bounds** (`1e15` / `9e15`) vs the auditor's
  `MAX_SAFE_INTEGER` ceiling (Inv. 8 gap above).
- **Participant count bounds** (`MIN_PARTICIPANTS = 2`, `MAX_PARTICIPANTS = 12`)
  — the auditor accepts any non-empty participant list.
- **Name/title length and case-insensitive duplicate-name rules** in
  `addParticipant` / `validateLedger`.
- **Calendar-date validity** (`isValidDateISO` round-trips the date; the auditor
  carries `date` without checking it).
- **Positive-amount rule at entry** — `addExpense` rejects `amount <= 0`; the
  auditor's `amountPaise` minimum is `1` for structural validity but it does not
  model the entry-time `> 0` message path.

## 5. Equal-split-only scope

Both the power and the production app model **equal** splits with deterministic
remainder allocation only. Weighted / percentage / share-based splits are not
implemented in either; the invariants still apply conceptually but are untested
here because the feature does not exist.

## Limitations and non-claims

- **No property-based tests.** The auditor and `*.test.ts` files check concrete
  values; they do not prove the universal properties P1–P9. Property-based
  testing (fast-check) remains the user's Kiro IDE task per the project's tech
  steering and `docs/IDE-PROPERTY-TEST-HANDOFF.md`.
- **The auditor is an independent oracle, not the production code path.** A PASS
  means the invariant held for the specific fixture values fed in, re-derived
  independently; it is not a proof over all inputs.
- **No minimality claim** for settlement — only correctness and the `≤ n − 1`
  bound, consistent with the product's explicit non-goal.
- **No source changed.** This review modified no application source or package
  files; it only ran the bundled auditor, the project's existing
  typecheck/test/build, and wrote documentation.
