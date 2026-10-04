---
name: money-audit
description: Review and audit code and data that handles money for exactness — integer minor-unit representation, deterministic remainder allocation, overflow/bounds safety, precise decimal parsing, split conservation, import integrity, and deterministic settlement. Use when working on ledgers, expense splitting, invoicing, payouts, or any feature that moves or divides currency.
---

# Exact Money audit

This skill helps you review money-handling code and data for *exactness* and
*determinism*. It encodes a set of invariants that correct money code must
satisfy, a review procedure, and a runnable auditor for normalized ledger JSON.

The goal is not to rewrite the user's codebase to a fixed template. It is to
find places where money can be silently created, lost, or made
order-dependent, and to confirm the invariants hold for concrete data.

## When this applies

Apply this skill when the task touches any of:

- storing or computing currency amounts;
- splitting a cost among people or line items;
- computing balances, who-owes-whom, settlements, or payouts;
- parsing user-entered amounts from text;
- importing/exporting financial JSON.

## Core invariants

These are the properties correct money code should satisfy. Treat each as a
claim to verify against the actual code, not an assumption.

1. **Integer minor units.** Amounts are stored as integers in the smallest
   currency unit (paise for INR, cents for USD). No `float`/`double` ever holds
   a money value that will be added, divided, or compared for equality.
2. **Exact parsing.** Decimal text is converted to minor units exactly: split on
   the decimal separator, validate at most the currency's fractional-digit count
   (2 for INR/USD), reject anything else. Never `parseFloat(x) * 100` — that
   reintroduces binary floating error (e.g. `0.1 * 3`).
3. **Deterministic remainder allocation.** When dividing `A` minor units among
   `k` parts, each part gets `floor(A / k)` and the remainder `r = A mod k` is
   distributed one unit each to a **deterministically ordered** subset
   (e.g. the first `r` parts by ascending stable ID). The order must not depend
   on map/object iteration order or insertion order.
4. **Conservation.** The sum of allocated shares equals the original amount
   exactly. Nothing is created or lost. This holds per expense and in aggregate.
5. **Fairness bound.** For an equal split, any two shares differ by at most one
   minor unit.
6. **Balances net to zero.** Sum over participants of `(paid − share)` is exactly
   zero for any ledger.
7. **Settlement validity.** A settlement plan has: positive integer transfer
   amounts, no self-transfers, at most `n − 1` transfers for `n` participants
   with non-zero balance, and applying it zeroes every balance. It need not be
   globally minimal; do not claim minimality unless proven.
8. **Bounds / overflow.** Amounts and their sums stay within the language's safe
   integer range. In JavaScript that is `Number.MAX_SAFE_INTEGER`
   (2^53 − 1); flag code that could sum past it without `BigInt`.
9. **Import integrity.** Imported financial documents are fully validated before
   any state changes; a rejected import leaves existing data untouched (no
   partial writes).

## Review procedure

Work top-down from design to data. Do not skip step 1.

### Step 1 — Learn the user's actual model

Before applying any check, read the user's code to answer:

- What is the money type? Integer minor units, a decimal library, or floats?
- What are the field names and shapes? (e.g. `amountPaise` vs `amount_cents`
  vs a `{ currency, value }` object.) The auditor script assumes one concrete
  shape; the *invariants* are shape-independent. Adapt field access, do not
  force the user's data into the script's shape.
- Where is the trust boundary? (user input, imported JSON, API responses.)
- What currency and fractional-digit count applies?

Record these as explicit assumptions in your review. If the model already uses a
vetted decimal/money library correctly, say so and focus on parsing boundaries
and determinism rather than re-deriving arithmetic.

### Step 2 — Audit arithmetic and representation

- Grep for floating-point money smells: `parseFloat`, `* 100`, `/ 100`,
  `toFixed`, `Math.round(` on money, `0.01`, division of a money value.
- Confirm division for splitting uses integer division + explicit remainder,
  not rounding of a float.
- Confirm formatting to a decimal string happens only at the output edge and
  is derived from the integer, never the reverse.

### Step 3 — Audit determinism

- Any iteration whose result affects allocation must be over a **sorted** list
  of stable IDs, not `Object.keys`, `Map` insertion order, or `Set` order.
- Remainder recipients, settlement debtor/creditor ordering, and tie-breaks
  must all derive from stable IDs.

### Step 4 — Verify with the independent oracle

Use `scripts/audit-ledger.mjs` as an *independent* re-implementation of the
invariants. It recomputes splits, balances, and a settlement simulation from the
raw amounts and checks conservation and clearing. Running it against the user's
exported/normalized data confirms the invariants on real values, independent of
the production code path.

If the user's data shape differs from the auditor's expected shape, either:

- write a small adapter that maps their export to the normalized shape
  (`references/ledger-schema.json`), or
- port the specific check you need from `references/oracle-patterns.md` into a
  one-off script against their types.

Do not claim the code is correct from reading alone — exactness bugs hide in
boundary values (remainders, large sums, zero, single participant).

### Step 5 — Report

State, per invariant: holds / violated / not-applicable, with the evidence
(file+line or auditor output) for each. For violations, give the smallest
reproducing input you can.

## Running the auditor

The auditor is dependency-free (Node's standard library only):

```
node scripts/audit-ledger.mjs <ledger.json>
```

Exit code `0` means all checks passed; non-zero means at least one failed and
the reasons are printed. See the power README for fixtures and the
`verify` command that proves it passes a valid ledger and rejects an invalid one.

## References

- `references/design-notes.md` — rationale for integer minor units, parsing,
  remainder allocation, overflow, and settlement bounds.
- `references/oracle-patterns.md` — independent property-oracle patterns you can
  reuse in property-based tests (conservation, fairness, determinism, clearing).
- `references/ledger-schema.json` — the normalized ledger shape the auditor
  expects, with field documentation.
