# Evidence — Phase 1b: Money correctness review and hardening

This document records a real correctness review of the finished phase-1 code,
the bugs that were reproduced against the actual implementation, the fixes
applied, and the verification that was actually run. It records only what
happened. Property-based tests remain the user's Kiro IDE task and were **not**
created here.

## Method
1. Read the steering docs, the spec (`requirements.md`, `design.md`,
   `tasks.md`), and every domain/persistence/UI source file.
2. Read the operator review notes (`.execution/review-core-notes.md`).
3. Reproduced each claimed problem against the actual code with small Node
   scripts and a BigInt oracle **before** changing anything.
4. Applied fixes in the pure domain / persistence layers only.
5. Added example regression tests and re-ran typecheck, tests, build, audit.

## Environment (observed)
- OS: Linux.
- Node `v24.16.0`; npm `11.13.0` (from `node --version` / `npm --version`).

## Findings (reproduced before fixing)

### F1 — Money parser near MAX_SAFE_INTEGER (review claim partially inaccurate)
Claim: "rupees*100 + fraction in Number ... check exact handling near
Number.MAX_SAFE_INTEGER; may silently round."

Reproduction: compared the production parser against a BigInt oracle
(`BigInt(intPart)*100n + BigInt(frac2)`) across the boundary. Result:

```
90071992547409      cur=9007199254740900  oracle=9007199254740900  agree=true   safe=true
90071992547409.91   cur=9007199254740991  oracle=9007199254740991  agree=true   safe=true
90071992547409.92   cur=null              oracle=9007199254740992  (rejected)
99999999999999.99   cur=null              oracle=9999999999999999  (rejected)
```

A targeted search for "parser returns a safe integer that disagrees with the
oracle" found **0 cases**. The existing `Number.isSafeInteger(paise)` guard
already prevents silent per-value rounding. So the parser was not silently
rounding. The real gap was the absence of an *explicit, documented* application
bound (the design claimed `MAX_EXPENSE_PAISE`/`MAX_LEDGER_TOTAL_PAISE` existed,
but the code did not enforce them).

### F2 — Aggregate overflow breaks conservation (REAL)
Reproduction:

```
a = 9_000_000_000_000_000  (safe)
b =     7_199_254_740_992  (safe)
a + b = 9_007_199_254_740_992   isSafeInteger(sum) = false
exact (BigInt) = 9_007_199_254_740_992
```

Two individually-safe expense amounts can sum past `MAX_SAFE_INTEGER`. Once that
happens, `computeBalances` accumulates in non-exact arithmetic and the sum of
nets is no longer guaranteed to be exactly 0 (P5). No code enforced an aggregate
bound in `addExpense`, `validateLedger`, or `computeBalances`.

### F3 — `splitEqualPaise` weak precondition + silent duplicate collapse (REAL)
Reproduction:

```
splitEqualPaise(900, ["a","a","b"]) -> Map{ a:300, b:300 }  sum=600 (expected 900)
Number.isInteger(2^53+1) = true   Number.isSafeInteger(2^53+1) = false
```

The guard used `Number.isInteger` (accepts unsafe integers) and the duplicate
`"a"` was silently collapsed by the `Map`, so the shares summed to 600 instead of
900 — a direct conservation (P2) violation.

### F4 — Persistence overwrites corrupt data on first save (REAL)
Code path: `App` did `useState(() => loadLedger())`; on corrupt storage
`loadLedger()` returned an empty ledger, then the mount `useEffect` immediately
called `saveLedger(ledger)`, overwriting the corrupt raw payload with an empty
document. Net effect: unreadable-but-present user data was destroyed silently,
with no error surfaced and no recovery copy. `saveLedger` also swallowed quota
failures silently.

### F5 — Vulnerable pinned dev stack (REAL)
`npm audit` on the pinned `vite@5.4.11` / `vitest@2.1.8` stack reported **4
vulnerabilities (2 moderate, 1 high, 1 critical)**:
- `vitest` critical — RCE / arbitrary file read via `@vitest/mocker` and the
  Vitest API/UI server (GHSA-82fw-gwwq-j7x9 and related).
- `vite` high — dev-server path-traversal / `server.fs.deny` bypass family.
- `esbuild` moderate — dev server can be made to send arbitrary requests.

## Fixes applied (domain + persistence only)

- `src/domain/types.ts`: added explicit, documented bounds
  `MAX_EXPENSE_PAISE = 1e15` and `MAX_LEDGER_TOTAL_PAISE = 9e15`
  (`< MAX_SAFE_INTEGER`).
- `src/domain/money.ts`: `parseMoneyToPaise` now rejects any value above
  `MAX_EXPENSE_PAISE` (in addition to the existing safe-integer guard), with a
  comment documenting BigInt equivalence over the accepted range.
- `src/domain/split.ts`: `splitEqualPaise` now requires a **safe** non-negative
  integer `<= MAX_EXPENSE_PAISE` and **throws on duplicate member ids** instead
  of collapsing them.
- `src/domain/ledger.ts`: `addExpense` enforces the per-expense bound and a
  running aggregate-total bound; `validateLedger` enforces the per-expense bound,
  switches to `Number.isSafeInteger`, and rejects documents whose aggregate total
  exceeds `MAX_LEDGER_TOTAL_PAISE`.
- `src/persistence/storage.ts`: added `loadLedgerResult` returning a status
  (`empty` / `loaded` / `recovered` / `unavailable`); on corrupt/invalid data it
  copies the raw payload to a `RECOVERY_KEY` and leaves the original in place.
  `saveLedger` now returns a `Result` so quota/unavailable failures surface.
  Added `getRecoveryCopy` / `clearRecoveryCopy`.
- `src/App.tsx`: loads via `loadLedgerResult`, **skips the first save after a
  `recovered` load** (so corrupt data is preserved until the user acts), and
  renders storage/recovery errors in an accessible `role="alert"`.

All money math remains in the pure domain modules; the UI still only formats.

## Regression tests added (example tests, not property tests)
- `money.test.ts`: BigInt-oracle agreement across the accepted range; exact
  acceptance at `MAX_EXPENSE_PAISE` and rejection one paisa above; rejection of
  values past `MAX_SAFE_INTEGER` (e.g. `90071992547409.92`). (10 tests total.)
- `split.test.ts`: duplicate-id rejection; unsafe-integer and over-bound
  rejection; exact boundary acceptance. (10 tests total.)
- `ledger.test.ts`: per-expense and aggregate-total rejection in both
  `addExpense` and `validateLedger`. (14 tests total.)
- `storage.test.ts`: an in-memory `localStorage` mock drives `loadLedgerResult`
  (`empty` / `loaded` / `recovered`), corrupt-data preservation + recovery copy,
  `clearRecoveryCopy`, and `saveLedger` success / quota-failure / unavailable
  results. (12 tests total.)

## Dependency upgrade (resolves F5)
`package.json` devDependencies changed to current stable versions compatible
with the project (Node 24, React 18, TypeScript 5.6):

| package | before | after |
| --- | --- | --- |
| `vite` | 5.4.11 | 8.3.2 |
| `vitest` | 2.1.8 | 5.0.3 |
| `@vitejs/plugin-react` | 4.3.4 | 6.1.1 |

`@vitejs/plugin-react@6` peer-requires `vite@^8`, so it moved in lockstep.
`react`, `react-dom`, `@types/react*`, and `typescript` were **not** changed:
they were not implicated by any advisory, and React 19 / TypeScript 7 are major
versions whose behavioural changes are out of scope for a security/correctness
repair.

## Verification (actually run after all changes)

### `npm audit`
```
found 0 vulnerabilities
```

### `npm run typecheck` (`tsc --noEmit`)
Exit 0, no output.

### `npm run test` (`vitest run`, v5.0.3)
```
 Test Files  6 passed (6)
      Tests  55 passed (55)
```
(Up from 37 tests in phase 1; +18 regression tests.)

### `npm run build` (`tsc --noEmit && vite build`, v8.3.2)
```
vite v8.3.2 building client environment for production...
✓ 28 modules transformed.
dist/index.html                   0.45 kB │ gzip:  0.28 kB
dist/assets/index-DlCNjBpf.css    3.15 kB │ gzip:  1.24 kB
dist/assets/index-T8UmOJjG.js   159.16 kB │ gzip: 51.46 kB
✓ built in 73ms
```

### Dev-server smoke check
`npx vite --port 5199` started on Vite 8 and served `HTTP 200` at `/`.

## Honest limitations and non-claims
- **No property-based tests were added.** fast-check / PBT implementing P1–P9
  remains the user's Kiro IDE task. The coverage here is example-based regression
  testing only and does not prove the universal properties.
- **No UI/component rendering tests** were added; the `App` recovery wiring was
  verified by typecheck, the storage-layer unit tests, and the build, not by a
  rendering harness.
- The `MAX_EXPENSE_PAISE` / `MAX_LEDGER_TOTAL_PAISE` values are deliberate,
  documented application limits chosen for exact-integer safety, not a claim
  about real-world currency maxima.
- This phase supersedes the "dependency advisories remain open (intentional)"
  limitation recorded in `01-core-development.md`; that note described the state
  at the end of phase 1 and is left as historical record.
- No git commits, pushes, publishing, account/settings changes, Powers, MCP, or
  external messages were performed. All work was local workspace repair.

## Reproduction
```bash
npm install
npm audit
npm run typecheck
npm run test
npm run build
```
