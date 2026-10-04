# Evidence — Phase 1: Core development

This document records the factual results of phase 1 (spec, steering, core
implementation, and example tests) for FairShare Ledger. It is intentionally
conservative: it records only what actually happened in this phase and lists
what did **not** happen.

## Scope of this phase
Phase 1 covered, through the Kiro CLI default agent:
1. Project steering under `.kiro/steering/` (`product.md`, `structure.md`, `tech.md`).
2. A `.gitignore` that ignores `node_modules/`, `dist/`, and the private `.execution/`.
3. An EARS spec under `.kiro/specs/fairshare-ledger/` (`requirements.md`,
   `design.md`, `tasks.md`) including correctness properties P1–P9.
4. A functional React + TypeScript + Vite implementation.
5. Example (unit) tests for the domain and persistence layers.
6. Typecheck + test + production build verification.

## Environment (observed)
- OS: Linux.
- Node: `v24.16.0`; npm: `11.13.0` (from `node --version` / `npm --version`).
- Package manager: npm.

## What was built
Source files created (from `find src -type f`):

```
src/App.tsx
src/main.tsx
src/styles.css
src/domain/types.ts
src/domain/money.ts
src/domain/split.ts
src/domain/balances.ts
src/domain/settlement.ts
src/domain/ledger.ts
src/persistence/ids.ts
src/persistence/storage.ts
src/ui/ParticipantsPanel.tsx
src/ui/ExpenseForm.tsx
src/ui/ExpenseList.tsx
src/ui/Dashboard.tsx
src/ui/DataControls.tsx
```

Example test files:

```
src/domain/money.test.ts
src/domain/split.test.ts
src/domain/balances.test.ts
src/domain/settlement.test.ts
src/domain/ledger.test.ts
src/persistence/storage.test.ts
```

Architecture: a pure, side-effect-free `src/domain/` core (no `window`,
`localStorage`, `Date.now`, or React); a `src/persistence/` layer that is the
only code touching `localStorage`; and a React `src/ui/` layer that formats paise
to INR only at the display edge.

## Dependency installation
`npm install` added 99 packages (exit 0). `npm audit` reported 4 vulnerabilities
(2 moderate, 1 high, 1 critical). The two detailed advisories are the Vite dev
server / esbuild request advisory and the `@vitest/mocker` path-traversal
advisory — both affect dev-time tooling (dev server and the test mocker), not the
built production bundle. Versions were left pinned as specified rather than
running `npm audit fix --force`, which would move `vite`/`vitest` outside the
stated ranges. This is a known, recorded limitation to revisit in a later phase.

## Verification results (observed, exit code 0 for each)

### Typecheck — `npm run typecheck` (`tsc --noEmit`)
Completed with no output and exit status 0 (clean).

### Tests — `npm run test` (`vitest run`)
```
 ✓ src/domain/balances.test.ts (4 tests)
 ✓ src/domain/settlement.test.ts (5 tests)
 ✓ src/domain/split.test.ts (7 tests)
 ✓ src/domain/money.test.ts (7 tests)
 ✓ src/persistence/storage.test.ts (4 tests)
 ✓ src/domain/ledger.test.ts (10 tests)

 Test Files  6 passed (6)
      Tests  37 passed (37)
   Duration  277ms
```

### Build — `npm run build` (`tsc --noEmit && vite build`)
```
vite v5.4.11 building for production...
✓ 44 modules transformed.
dist/index.html                   0.46 kB │ gzip:  0.29 kB
dist/assets/index-CZZmi22-.css    3.22 kB │ gzip:  1.27 kB
dist/assets/index-DcMfkYXW.js   159.00 kB │ gzip: 50.91 kB
✓ built in 4.82s
```

`dist/` contents confirmed on disk: `dist/index.html` (455 bytes),
`dist/assets/index-CZZmi22-.css` (3221 bytes),
`dist/assets/index-DcMfkYXW.js` (159006 bytes).

## Correctness properties coverage (phase 1 = examples only)
The spec defines nine properties (P1–P9). In phase 1 these are exercised by
**example-based** unit tests, not yet by property-based tests:

- P1 (parse/format round-trip) — `money.test.ts`.
- P2 (split conservation) — `split.test.ts` (incl. a sweep over k=1..12 and
  several amounts).
- P3 (split fairness, max−min ≤ 1) — `split.test.ts`.
- P4 (split order-independence) — `split.test.ts`.
- P5 (balances sum to zero) — `balances.test.ts`, `ledger.test.ts` (sample).
- P6 (settlement clears balances) — `settlement.test.ts` (applies transfers back).
- P7 (transfer validity + ≤ n−1 bound) — `settlement.test.ts`.
- P8 (settlement determinism) — `settlement.test.ts`.
- P9 (import atomicity: invalid import leaves ledger unchanged) —
  `storage.test.ts` (import validates and returns a Result without writing
  storage).

## Honest limitations and non-claims
- **No property-based tests yet.** fast-check / PBT implementing P1–P9 is
  deliberately deferred to the IDE phase per the brief. Current coverage is
  example-based only and does not prove the universal properties.
- **No UI/component tests.** React components were verified by typecheck and a
  successful production build, not by rendering tests. The dev server and
  in-browser behavior were not interactively exercised in this logged phase.
- **No accessibility audit tool was run.** Accessibility was addressed by
  construction (labels, `role="alert"`, `aria-live`, semantic landmarks,
  keyboard-operable controls), but no automated a11y audit (e.g. axe) was run.
- **Dependency advisories remain open** (see above), intentionally, to keep
  pinned versions.
- **No IDE, hooks, Powers, MCP, custom agents, or cloud/Web usage occurred** in
  this phase. All work was done with the Kiro CLI default agent and local npm
  tooling. Those capabilities are reserved for later phases and are not claimed
  here.
- **No git commits, pushes, publishing, account changes, or external messages**
  were performed in this phase.
- Settlement is correct and bounded (≤ n−1 transfers) but is **not** claimed to
  be the globally minimal number of transfers.

## Reproduction
```bash
npm install
npm run typecheck
npm run test
npm run build
```
