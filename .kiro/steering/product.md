# Product steering — FairShare Ledger

## What this is
FairShare Ledger is a local-first web app for roommates and small trip groups to
track shared expenses and settle up. A group creates a ledger, adds participants,
records who paid for what and who shares each cost, then sees balances and a
deterministic plan of transfers that clears everyone to zero.

## Who it is for
- Roommates splitting rent-adjacent costs (groceries, utilities, supplies).
- Small trip groups (2–12 people) splitting travel costs.

## Core promises
- **Exact money.** All amounts are stored and computed in integer paise. No
  floating-point money arithmetic. One currency per ledger (INR to start).
- **Deterministic.** The same ledger always produces the same splits, balances,
  and settlement plan. Remainder paise are assigned by sorted stable participant
  IDs so results never depend on insertion order or map iteration order.
- **Local-first.** Data lives in the browser via versioned localStorage. No
  remote API, no account, no tracking, no network calls for app data.
- **Safe data handling.** JSON import validates fully before applying and can
  never partially overwrite an existing valid ledger. Reset and sample-data
  actions are explicit and confirmed.

## Explicit non-goals
- No bank integrations, no real payments, no payment rails.
- Not an accounting system; makes no accounting, tax, or legal claims.
- No multi-currency within a single ledger.
- No multi-user sync or cloud storage in this product.
- Does not claim globally minimal settlement transfers — only a correct,
  bounded plan (≤ n−1 transfers) that clears all balances.

## Scope guardrails for contributors
When extending the app, preserve the core promises above. Any feature that
introduces floating-point money, nondeterminism, silent partial writes, or
network transmission of ledger data is out of scope.
