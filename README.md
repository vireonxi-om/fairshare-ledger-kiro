# FairShare Ledger

A local-first web app for roommates and small trip groups (2–12 people) to track
shared expenses and settle up. Money is stored and computed in **integer paise**,
one currency per ledger (INR). Everything runs in the browser — no account, no
server, no tracking.

## Features
- Manage 2–12 participants with stable IDs and validated, unique names.
- Record expenses with title, payer, positive amount (decimal text parsed to
  exact paise), date, and the set of participants who share the cost.
- Deterministic equal splitting: indivisible remainder paise are assigned by
  sorted stable participant ID, so results never depend on input order.
- Dashboard: total spent, per-participant paid / share / net, expense history,
  and a settlement plan of who pays whom.
- Versioned local persistence with safe JSON **import/export**. Import validates
  the entire document before applying and can never partially overwrite a valid
  ledger. Explicit **reset** and **sample data** actions.
- Responsive layout, dark-mode aware, keyboard operable, semantic labels and
  accessible empty/error states. No remote API or analytics.

## Money and correctness model
- Amounts are integer paise end to end. Decimal text is parsed to paise with
  string operations (no floating-point money math); INR formatting happens only
  at the display edge via `Intl.NumberFormat("en-IN")`.
- **Balances** sum to exactly zero. **Settlement** produces positive-integer
  transfers, no self-transfers, and at most `n − 1` transfers for `n`
  participants with non-zero balances, and clears every balance to zero.
- The settlement plan is correct and bounded; it is **not** claimed to be the
  globally minimal number of transfers.

The spec lives under [`.kiro/specs/fairshare-ledger/`](.kiro/specs/fairshare-ledger/)
(requirements in EARS format, design, tasks). Correctness properties P1–P9 are
documented there; their property-based tests are implemented in a later phase.

## Project layout
```
src/
  domain/       pure logic: money, split, balances, settlement, ledger, types
  persistence/  versioned localStorage, import/export, ids
  ui/           React components
  App.tsx       app shell
```

## Getting started
Requires Node 20.19+ or 22.12+ (Vite 8 / Vitest 5 toolchain) and npm.

```bash
npm install
npm run dev        # start the dev server
```

## Scripts
```bash
npm run dev        # Vite dev server
npm run build      # type-check (tsc --noEmit) then production build to dist/
npm run preview    # preview the production build
npm run test       # run example (unit) tests once with Vitest
npm run typecheck  # tsc --noEmit
```

## Testing
Phase 1 ships example (unit) tests for the domain and persistence layers under
`src/**/*.test.ts`. Property-based tests (fast-check) implementing the P1–P9
correctness properties are scheduled for a later phase and are not included here.

## Privacy
All ledger data stays in your browser's localStorage. The app makes no network
calls for ledger data and includes no analytics or tracking.
