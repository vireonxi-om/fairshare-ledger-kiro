# Design — FairShare Ledger

## 1. Architecture overview
Three layers with a hard dependency direction: UI → persistence/domain, and
persistence → domain. Domain depends on nothing.

```
┌──────────────────────────────────────────────┐
│ src/ui + src/App.tsx  (React, formatting, I/O) │
└───────────────┬───────────────┬───────────────┘
                │               │
                ▼               ▼
       ┌────────────────┐  ┌──────────────────────┐
       │ src/persistence │  │ src/domain (pure)     │
       │ localStorage,   │─▶│ money, split,         │
       │ import/export,  │  │ balances, settlement, │
       │ sample, reset   │  │ types, validation     │
       └────────────────┘  └──────────────────────┘
```

- **Domain** is pure and deterministic: no `window`, `localStorage`, `Date`, or
  React. This is the surface the later property tests target.
- **Persistence** is the only module that touches `localStorage` and performs
  (de)serialization and full-document validation.
- **UI** renders state, formats paise→INR at the edge, and dispatches actions.

## 2. Data model (`src/domain/types.ts`)
```ts
type Currency = "INR";

interface Participant {
  id: string;      // stable opaque id, e.g. "p_<counter|uuid>"
  name: string;    // trimmed, 1–40 chars
}

interface Expense {
  id: string;            // stable opaque id
  title: string;         // trimmed, 1–60 chars
  payerId: string;       // references Participant.id
  amountPaise: number;   // positive integer
  dateISO: string;       // "YYYY-MM-DD"
  splitIds: string[];    // >= 1 participant ids, subset of participants
}

interface Ledger {
  currency: Currency;    // "INR"
  participants: Participant[];
  expenses: Expense[];
}

const SCHEMA_VERSION = 1;
interface PersistedDoc {
  schemaVersion: number; // === SCHEMA_VERSION
  ledger: Ledger;
}
```

## 3. Money (`src/domain/money.ts`)
- `parseMoneyToPaise(text: string): number | null`
  - Trim input. Accept pattern `^\d+(\.\d{1,2})?$`.
  - Reject empty, signs, exponents, > 2 fractional digits, non-numeric.
  - Compute paise = `rupees * 100 + fractional-padded-to-2`, using integer
    operations on the digit strings (no float multiplication of the parsed
    decimal). Return `null` on invalid, and `0` is parseable but treated as
    non-positive by callers that require positivity.
- `formatPaise(paise: number): string` → `"₹1,234.05"` using
  `Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" })` applied to
  `paise/100` only for display. Rounding is exact because paise is integer and we
  divide by 100 at the very end for formatting; formatting always shows 2
  fractional digits.

### Parsing detail (avoid float error)
Given `^(\d+)(?:\.(\d{1,2}))?$`, let `intPart` and `fracPart`.
`frac2 = (fracPart + "00").slice(0, 2)`. `paise = Number(intPart) * 100 +
Number(frac2)`. All operands are safe integers for realistic amounts.

### Explicit money bounds (exact-integer guarantee)
JavaScript numbers are exact integers only up to `Number.MAX_SAFE_INTEGER`.
Beyond that, integer addition silently loses precision, which would break the
conservation invariant (P5) even when every individual expense is representable.
To keep **all** aggregates exact (totals, per-participant paid/share/net, and
settlement transfers), two explicit bounds (in `types.ts`) are enforced:
- `MAX_EXPENSE_PAISE = 1e15` — maximum for a single expense amount. Enforced in
  `parseMoneyToPaise`, `splitEqualPaise`, `addExpense`, and `validateLedger`.
- `MAX_LEDGER_TOTAL_PAISE = 9e15` (`< MAX_SAFE_INTEGER`) — maximum for the sum of
  all expense amounts. Enforced in `addExpense` (running total) and
  `validateLedger` (import/stored docs). Because no derived aggregate can exceed
  the grand total, keeping the total below `MAX_SAFE_INTEGER` keeps every balance
  and transfer exact.
The parser agrees with a BigInt oracle for every value in the accepted range;
values that would exceed a safe integer or the bound are rejected (returns null),
never silently rounded.

## 4. Splitting (`src/domain/split.ts`)
`splitEqualPaise(amountPaise: number, memberIds: string[]): Map<string, number>`
1. Precondition (enforced, throws on violation): `amountPaise` is a safe
   non-negative integer `<= MAX_EXPENSE_PAISE`; `memberIds.length >= 1` with no
   duplicate ids. Duplicates are rejected rather than silently collapsed, since
   collapsing would break conservation (P2).
2. `sorted = [...memberIds].sort()` (lexicographic on stable IDs → deterministic).
3. `base = Math.floor(amountPaise / k)`, `rem = amountPaise % k`.
4. Assign `base` to each; add `1` to the first `rem` members of `sorted`.
5. Return a map keyed by participant ID.

Invariants: sum of values === amountPaise (P2); max−min share ≤ 1 (P3);
independent of input order (P4).

## 5. Balances (`src/domain/balances.ts`)
`computeBalances(ledger): Map<string, { paid; share; net }>` (all paise)
- For each participant start at `paid=0, share=0`.
- For each expense: add `amountPaise` to payer's `paid`; call `splitEqualPaise`
  over `expense.splitIds` and add each share to that participant's `share`.
- `net = paid − share`.
- Because each expense's shares sum to its amount and its full amount is credited
  to exactly one payer, the global sum of nets is exactly 0 (P5).

## 6. Settlement (`src/domain/settlement.ts`)
`planSettlement(balances): Transfer[]` where `Transfer = { fromId; toId;
amountPaise }`.

Greedy two-pointer algorithm on net balances:
1. Build `debtors` (net < 0) and `creditors` (net > 0), each sorted by stable ID
   (deterministic ordering, P8). Work on copies of the net amounts.
2. Pointer `i` over debtors, `j` over creditors.
3. `amount = min(−debtor[i].net, creditor[j].net)`; if `amount > 0`, emit
   transfer `{ from: debtor[i].id, to: creditor[j].id, amount }`.
4. Decrease both running balances by `amount`; advance whichever side reached 0.
5. Stop when either list is exhausted.

Properties: each emitted amount > 0 and integer (P7); from ≠ to since debtors and
creditors are disjoint sets (P7); at most n−1 transfers because each step zeroes
at least one participant and there are at most n non-zero participants, with the
last step zeroing two (P7, Req 5.3); applying transfers zeroes all nets because
total debt equals total credit, which follows from P5 (P6). We make **no**
minimality claim (Req 5.6).

### n−1 bound argument
Each iteration advances at least one pointer (the side that hit zero). With `d`
debtors and `c` creditors (`d + c = n` non-zero), the number of advances needed to
exhaust both is at most `d + c − 1 = n − 1`, and each advance corresponds to at
most one emitted transfer. Hence ≤ n−1 transfers.

## 7. Ledger operations (`src/domain/ledger.ts`)
Pure helpers returning new `Ledger` values (immutable updates):
- `addParticipant`, `deleteParticipant` (guard: not referenced by any expense),
  with name validation and 2–12 bounds surfaced via result types.
- `addExpense` (validates payer ∈ participants, splitIds ⊆ participants, amount >
  0, title length, date format), `deleteExpense`.
- `validateLedger(value): Ledger | null` — structural + referential validation.
- `sampleLedger()` — a fixed valid demo ledger (deterministic IDs/dates).

Validation returns a discriminated result so the UI can show accessible errors:
`type Result<T> = { ok: true; value: T } | { ok: false; error: string }`.

## 8. Persistence (`src/persistence/storage.ts`)
- Key: `fairshare.ledger.v1`; recovery key: `fairshare.ledger.v1.corrupt`.
- `loadLedgerResult(): { ledger, status, corruptRaw? }` — read, `JSON.parse`,
  `validatePersistedDoc`. Returns `status`:
  - `"empty"` (nothing stored) / `"loaded"` (valid) / `"unavailable"` (storage
    not accessible) / `"recovered"` (data present but corrupt/invalid).
  On `"recovered"` the raw payload is copied to the recovery key and the
  original is **left in place** so the next save does not destroy it (Req 7.2 is
  satisfied by returning an empty ledger without discarding user data).
  `loadLedger()` is a thin wrapper returning just the ledger.
- `saveLedger(ledger): Result<void>` — wrap in `{ schemaVersion, ledger }`,
  stringify, write; returns an error Result on quota/serialization failure or
  unavailable storage so the UI can surface it instead of losing writes
  silently.
- `getRecoveryCopy()` / `clearRecoveryCopy()` expose the preserved corrupt
  payload so the UI can offer download or discard.
- `exportDoc(ledger): string` — pretty JSON of `PersistedDoc` (Req 7.3).
- `importDoc(text): Result<Ledger>` — parse + full validation; never mutates
  storage itself (caller applies only on success → import atomicity P9/Req 7.5).
- `clearStorage()` and `sampleLedger()` are explicit actions invoked from UI with
  confirmation.

## 9. UI (`src/ui/*`, `src/App.tsx`)
- `App` loads once on mount via `loadLedgerResult`; it saves on change via an
  effect but **skips the first save after a `"recovered"` load** so corrupt data
  is preserved until the user makes a deliberate change. Save failures and the
  recovered/unavailable states are rendered in an accessible `role="alert"`.
- Components:
  - `ParticipantsPanel` — add/delete participants, inline validation errors.
  - `ExpenseForm` — title, payer select, amount text, date, split checkboxes;
    disabled with guidance while < 2 participants.
  - `ExpenseList` — history with delete.
  - `Dashboard` — total spent, per-participant paid/share/net, settlement list,
    empty state.
  - `DataControls` — export (download), import (file read), sample, reset, each
    with confirmation where destructive.
- Formatting via `formatPaise` only in components. All money math stays in domain.
- Accessibility: `<label htmlFor>` for every control, `role="alert"` for errors,
  `aria-live="polite"` for status, buttons reachable and operable by keyboard,
  semantic landmarks (`header`, `main`, `section` with headings).

## 10. Error handling strategy
- Domain returns `Result<T>`; never throws for expected validation failures.
- Persistence treats malformed storage/import as recoverable: load → empty,
  import → rejected with message, current ledger preserved.
- UI renders the error text in an accessible alert region.

## 11. Testing strategy
- **Phase 1 (now):** Vitest example tests for `money`, `split`, `balances`,
  `settlement`, and `validateLedger`, covering normal, boundary, and remainder
  cases, plus a representative import-atomicity example.
- **Later (IDE phase):** `fast-check` property tests implementing P1–P9. Not
  included in phase 1.

## 12. Determinism checklist
- Sorting by stable ID before any result-affecting iteration (split, settlement).
- No `Date.now()`/`Math.random()` inside domain; IDs generated in the UI/persist
  layer and passed in.
- No reliance on object key order for computations.
