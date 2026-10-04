# Evidence — Property-based tests (P1–P9), IDE phase, plus Task 14 strengthening

This document records the **actual** work for Task 11 (fast-check property
tests for P1–P9) and the Task 14 follow-up ("11b") that strengthened them. Only
results that were observed are recorded here.

## What was and was not verified (honesty note)

- These are **bounded, randomized checks**: each property runs **500 generated
  cases** (`numRuns: 500`) under an **explicit, distinct seed**, so runs are
  reproducible. They are **not formal proofs**.
- Oracles are **independent reimplementations** (BigInt / from-raw recomputation
  / independent transfer simulation), not "implementation === implementation".
- **No production source files were modified** in Task 11 or Task 14
  (`git diff` on `src/domain/ledger.ts`, `types.ts`, `src/persistence/storage.ts`
  was empty). Only test files, `src/domain/ledger.arbitrary.ts` and this
  document were edited in Task 14.
- **No genuine counterexample was found** by any property in either phase.

## Task 14 changes (what was strengthened)

1. **Storage rejection properties now use a mock `localStorage`.**
   `vi.stubGlobal("localStorage", …)` (restored by `vi.unstubAllGlobals()` in
   `afterEach`) with `vi.fn` spies on `getItem/setItem/removeItem/clear`,
   pre-seeded under `STORAGE_KEY` with a serialized valid sentinel ledger
   (`exportDoc(sampleLedger())`). For every generated case the spies are reset
   and the test asserts: `importDoc(...).ok === false`; `setItem`, `removeItem`
   and `clear` each called 0 times; the sentinel bytes are identical and the
   store still holds only that key; the caller's in-memory ledger is deep-equal
   to its pre-call clone.
2. **Varied rejection generators** (not only `fc.constant`): random mutations of
   a valid exported doc (wrong/odd `schemaVersion`, wrong `currency`,
   non-array `participants`/`expenses`, dropped `ledger`, invalid `amountPaise`
   values of many types/ranges, dropped expense fields, bad dates, blank name),
   referential faults (generated ghost payer/split ids, duplicate participant /
   expense / split ids, empty `splitIds`), and malformed text (truncated exports
   at random cut points, trailing garbage, random non-JSON strings, binary-unit
   strings, random JSON values that are not persisted docs).
3. **Aggregate-overflow imports.** Every `amountPaise` is in
   `[1, MAX_EXPENSE_PAISE]` and the BigInt sum is `> MAX_LEDGER_TOTAL_PAISE`;
   both preconditions are asserted inside the property. If random amounts do not
   exceed the bound, `MAX_EXPENSE_PAISE` amounts are appended until they do
   (deterministic top-up, nothing filtered). The docs are otherwise valid.
   **Positive controls** (property, 500 runs): the same doc shape reduced to a
   total of exactly `MAX_LEDGER_TOTAL_PAISE` is accepted (with the parsed
   amounts equal to the input), that doc plus one 1-paise expense
   (`LIMIT + 1`) is rejected, and a doc reduced to `LIMIT − 1` is accepted. An
   example test checks nine `MAX_EXPENSE_PAISE` expenses (== limit) accepted and
   one more paisa rejected.
4. **`src/domain/ledger.arbitrary.ts` rewritten** to build RAW `Ledger` objects
   directly; it no longer calls `addParticipant`/`addExpense`, and the
   `continue`-based silent skips are gone. Features: 2..12 participants;
   opaque ids in three styles (`p_N`, mixed case `p_N`/`PN`/`pXN`, random
   alphanumeric) in shuffled creation order so lexicographic order differs from
   creation order (e.g. `p_10` vs `p_2`); case-varied unique names; 0..12
   expenses; random payer; splitting subsets of shuffled order (full set
   weighted 1:3 against arbitrary non-empty subsets); amounts weighted toward
   remainder-dense `1..101`, mid-range, full `1..MAX_EXPENSE_PAISE`, and
   boundary constants (`1, 2, 3, MAX, MAX−1, MAX−2, MAX/3, MAX/7`). A
   deterministic budget clamp keeps the total within `MAX_LEDGER_TOTAL_PAISE`
   while leaving ≥ 1 paisa for each remaining expense (it never drops an
   expense). Every generated ledger is checked with `validateLedger` and the
   generator **throws** on rejection.
5. **`ledger.arbitrary.test.ts` (new):** every generated ledger passes
   `validateLedger` unchanged (deep-equal) with total ≤ limit; a shape-coverage
   test over 500 sampled ledgers asserts sizes 2 and 12, id order ≠ sorted order,
   mixed-case ids, partial-subset splits, remainder-producing amounts, amounts
   > 1e14, and empty-expense ledgers all occur.
6. **`balances.property.test.ts`:** new BigInt oracle recomputing
   paid/share/net per participant from raw expenses (splitIds sorted
   lexicographically, `q = amount / k`, `r = amount % k`, first `r` sorted ids
   get `q+1`, payer `paid += amount`; it does not call `splitEqualPaise` or
   `computeBalances`). Every participant and the participant set are compared
   with `computeBalances`. A second property repeats this with shuffled
   participant order and shuffled `splitIds` per expense, and also asserts the
   shuffled result equals the original per id.

## Harness self-check (test-local mutation sanity)

Test `sanity: the harness detects storage writes` runs the same
`assertRejectedUntouched` helper against deliberately faulty importers: one that
calls `localStorage.setItem`, one `removeItem`, one `clear`, one that changes
the stored bytes directly (bypassing spies), one that accepts a bad doc, and one
that mutates the caller's ledger. Each is required to make the helper throw, and
the real `importDoc` is required not to. This test passed. It validates the
assertions, not production code; production code was not mutated.

## Files changed in Task 14

| File | Change |
|------|--------|
| `src/persistence/storage.property.test.ts` | Mock localStorage, varied rejection generators, aggregate-overflow + controls, harness self-check; replaced the old node-only "no mutation" test |
| `src/domain/ledger.arbitrary.ts` | Rewritten: raw valid ledgers, no builders, no silent skips, throws on invalid |
| `src/domain/ledger.arbitrary.test.ts` | New: generator validity + shape coverage |
| `src/domain/balances.property.test.ts` | Added independent BigInt oracle properties (plain and shuffled) |
| `docs/evidence/04-ide-properties.md` | This document |

Earlier (Task 11) files unchanged by Task 14: `money.property.test.ts`,
`split.property.test.ts`, `settlement.property.test.ts`. `fast-check` is pinned
exactly at `4.10.2` (package.json unchanged in Task 14).

## Seeds and run counts

All properties use `numRuns: 500` (the shape-coverage test uses
`fc.sample(..., numRuns: 500)`).

| File | Property | Seed |
|------|----------|------|
| money.property | parse agrees w/ oracle | `0x1a2b3c01` |
| money.property | rejects malformed | `0x1a2b3c02` |
| money.property | rejects over-bound/unsafe | `0x1a2b3c03` |
| money.property | parse→format round-trip | `0x1a2b3c04` |
| split.property | conservation | `0x5b1c0001` |
| split.property | fairness bound | `0x5b1c0002` |
| split.property | remainder order | `0x5b1c0003` |
| split.property | order independence | `0x5b1c0004` |
| balances.property | zero-sum | `0x2c0de001` |
| balances.property | net definition | `0x2c0de002` |
| balances.property | BigInt per-participant oracle (new) | `0x2c0de003` |
| balances.property | oracle under shuffled order (new) | `0x2c0de004` |
| settlement.property | clears | `0x5e77e001` |
| settlement.property | transfer validity | `0x5e77e002` |
| settlement.property | determinism | `0x5e77e003` |
| ledger.arbitrary.test | every generated ledger valid (new) | `0x1ed9e001` |
| ledger.arbitrary.test | shape coverage sample (new) | `0x1ed9e002` |
| storage.property | roundtrip | `0x9a7e0001` |
| storage.property | reject malformed (legacy, no mock storage) | `0x9a7e0002` |
| storage.property | reject structural (legacy) | `0x9a7e0003` |
| storage.property | reject referential (legacy) | `0x9a7e0004` |
| storage.property | mutated structural faults + mock storage (new) | `0x9a7e0010` |
| storage.property | referential faults + mock storage (new) | `0x9a7e0011` |
| storage.property | malformed/truncated text + mock storage (new) | `0x9a7e0012` |
| storage.property | aggregate overflow + mock storage (new) | `0x9a7e0013` |
| storage.property | aggregate bound controls (new) | `0x9a7e0014` |

The seeds above were read from the test sources after the final edit.

## Requirement / property mapping

| Property test | Property IDs | Requirement(s) |
|---------------|--------------|----------------|
| money: parse agrees w/ oracle | P1 | 2.2, 6.5 |
| money: rejects malformed | P1 | 2.2, 2.3 |
| money: rejects over-bound/unsafe | P1 | 2.2 |
| money: parse→format round-trip | P1 | 2.2, 6.5 |
| split: conservation | P2 | 3.3 |
| split: fairness bound | P3 | 3.1, 3.2 |
| split: remainder order | P3 | 3.2 |
| split: order independence | P4 | 3.4 |
| balances: zero-sum | P5 | 4.3 |
| balances: net definition | P5 | 4.1, 4.2 |
| balances: BigInt per-participant oracle (plain + shuffled) | P5 (and P4 ordering) | 3.x, 4.1–4.3 |
| ledger.arbitrary: validity + shape coverage | supports P5/P9 | 7.4 (validator agreement) |
| settlement: clears | P6 | 5.4 |
| settlement: transfer validity | P7 | 5.1, 5.2, 5.3 |
| settlement: determinism | P8 | 5.5 |
| storage: roundtrip | — | 7.3, 7.4 |
| storage: legacy reject malformed/structural/referential | P9 | 7.4, 7.5 |
| storage: mutated/referential/malformed + mock storage | P9 | 7.4, 7.5 |
| storage: aggregate overflow + controls | P9 | 7.4, 7.5 (aggregate bound, R2) |

## Commands run and real results

Each command was run with output redirected to a file and the file read
afterwards (exit code captured via `echo EXIT=$?`; the shell tool's own exit
codes were unreliable).

```
npx vitest run --project domain <6 property/generator test files> --reporter=verbose
  → Test Files  6 passed (6)
    Tests  29 passed (29)            EXIT=0
npm run test            (both projects)
  → Test Files  13 passed (13)
    Tests  92 passed (92)            EXIT=0
npm run typecheck       (tsc --noEmit)
  → no errors                        EXIT=0
npm run build           (tsc --noEmit && vite build)
  → ✓ 28 modules transformed
    dist/index.html                 0.45 kB
    dist/assets/index-*.css         6.69 kB
    dist/assets/index-*.js        161.24 kB (gzip 52.13 kB)
    ✓ built in 63ms                  EXIT=0
npm audit
  → found 0 vulnerabilities          EXIT=0
```

Of the 29 tests in that run, 3 are plain example tests (empty-ledger
roundtrip, nine-at-limit example, harness self-check) and 26 use fast-check
(including the sampled shape-coverage test).

## Counterexamples / fixes

- **Counterexamples found: none.** No property failed for any generated case on
  the recorded seeds, and no production code was changed.
- **Test-support fix during development:** the first `npm run typecheck`/`build`
  run failed with `TS2769` because `ledger.arbitrary.ts` passed a non-existent
  `maxTries` option to `fc.uniqueArray`. Removing the option fixed it; the
  vitest run had already passed (vitest does not typecheck). This was a test
  code error, not a product bug.
- **Earlier (Task 11):** three settlement seeds were first written with an
  invalid hex literal (`0x5e77le01`) and corrected; also not a product bug.

## Coverage limits

- These are **bounded randomized checks, not proof**: 500 cases per property on
  fixed seeds. Other seeds or larger run counts could find cases these did not.
- The **mock `localStorage` is a stand-in**, not a real browser implementation
  (no quota, no events, no serialization limits).
- **`importDoc` never touches storage by design**, so the zero-write assertions
  are regression guards against a future change, not evidence of a bug being
  caught today. The harness self-check confirms the assertions would fail if a
  write happened, but no production mutation was performed.
- The generators cover a **finite shape space** (≤ 12 participants, ≤ 12
  expenses in valid ledgers, 2–20 expenses in overflow docs, a fixed set of
  mutation kinds, a fixed date month). Unmodelled shapes (e.g. unusual unicode
  names/ids, many expenses) are not sampled.
- The **balances oracle shares the lexicographic (code-unit) sort convention**
  with production; if that convention were wrongly specified both would agree.
  It does independently recompute quotient/remainder and all sums with BigInt.
- **Settlement is not claimed to be minimal**; only correctness (clears to zero),
  validity, the `≤ n−1` bound and determinism are tested.
- **UI / jsdom behaviour is not covered** by these property tests (import
  confirmation flows, rendering, and the real `localStorage` in a browser are
  outside their scope).
- The aggregate-overflow generator uses a deterministic top-up with
  `MAX_EXPENSE_PAISE` amounts, so overflow docs are biased toward containing
  some maximum-size expenses.

## Compliance with steering constraints

- TypeScript strict mode; no `any` in the test or generator code.
- No floating-point money math in oracles (BigInt). The only `number` sums in
  the generator clamp are over values ≤ 9e15 < `Number.MAX_SAFE_INTEGER`, so
  they are exact.
- Determinism: explicit distinct seeds; oracles iterate over sorted ids.
- Tooling: npm, Vite, Vitest + fast-check; property tests are `*.test.ts` in the
  node project; no commit or push was made.
