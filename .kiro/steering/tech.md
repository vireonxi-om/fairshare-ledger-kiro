# Tech steering — FairShare Ledger

## Stack
- **Build/dev:** Vite.
- **Language:** TypeScript, strict mode. No `any` in domain code.
- **UI:** React 18 with function components and hooks. No UI framework beyond
  React; plain CSS (hand-written, no runtime CSS-in-JS).
- **Tests:** Vitest for example (unit) tests. Property-based tests use
  `fast-check` and are developed in a later phase; do not add them in phase 1.
- **Package manager:** npm.

## Architecture
Keep a hard boundary between a pure domain core and the React shell.

- `src/domain/` — pure, side-effect-free functions and types. No `window`, no
  `localStorage`, no `Date.now()`, no React. Everything is deterministic given
  its arguments. This is the layer property tests will target.
- `src/persistence/` — versioned localStorage read/write, import validation,
  export serialization, sample ledger, reset. The only module allowed to touch
  `localStorage`.
- `src/ui/` + `src/App.tsx` — React components and hooks. Rendering, input
  handling, formatting. Calls into domain and persistence; contains no money
  math of its own beyond calling domain helpers.

## Money rules (non-negotiable)
- Represent money as integer **paise** (`number`, always an integer).
- Parse decimal user text to paise exactly; reject anything that is not a
  non-negative amount with at most two fractional digits.
- Never use floating-point arithmetic for money. Division for splitting uses
  integer division plus explicit deterministic remainder distribution.
- Format paise back to INR strings only at the UI edge.

## Determinism rules
- Any iteration that affects results must be over a **sorted** collection of
  stable participant IDs, not object key order or insertion order.
- Remainder paise from equal splits are handed out one per participant in
  ascending sorted-ID order until exhausted.

## Testing conventions
- Domain functions get example tests covering normal, boundary, and remainder
  cases. Co-locate as `*.test.ts` next to the module or under `src/domain`.
- Build must pass `tsc` with no errors and produce a production bundle.

## Commands
- `npm run dev` — local dev server.
- `npm run build` — typecheck (`tsc`) + production build.
- `npm run test` — run Vitest once.
- `npm run typecheck` — `tsc --noEmit`.
