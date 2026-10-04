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
- Responsive layout, keyboard operable, semantic labels and
  accessible empty/error states. No remote API or analytics.

## Money and correctness model
- Amounts are integer paise end to end. Decimal text is parsed to paise with
  string operations (no floating-point money math); INR formatting happens only
  at the display edge with integer quotient/remainder and `Intl.NumberFormat("en-IN")` grouping.
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
npm ci
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
The current verified suite has 63 example and integration tests: domain and persistence suites under `src/**/*.test.ts`, plus a real App StrictMode regression under `src/App.test.tsx`. `npm run test` runs separate Node and jsdom projects. Property-based tests are still pending the entrant's Kiro IDE session; see [the exact handoff](docs/IDE-PROPERTY-TEST-HANDOFF.md).

## Privacy
All ledger data stays in your browser's localStorage. The app makes no network
calls for ledger data and includes no analytics or tracking.

## Kiro development and evidence

Kiro CLI created the specs, steering, application and tests, then the purpose-built money-guardian agent reproduced and fixed actual correctness/storage bugs. A real paid Kiro Web sandbox session audited the production sample data and produced a reviewed documentation PR. Codex coordinated research, prompts, browser setup, review, git and submission preparation.

See [lesson evidence map](docs/LESSON-EVIDENCE.md), [cloud sample audit](docs/MONEY-REVIEW.md), and the original [Exact Money power](powers/exact-money/README.md) with its [public manifest](powers/exact-money/plugin.json). The power includes a substantive audit skill, references, independent fixture auditor and verification runner.

The challenge entry is still in preparation. IDE property evidence, final demo, social post, entrant eligibility confirmation and final form submission remain pending. Reviewer acceptance and any credit award are not guaranteed.
