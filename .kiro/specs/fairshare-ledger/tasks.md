# Tasks — FairShare Ledger

Status legend: [ ] not started, [~] in progress, [x] done.

## Phase 1 — Core implementation (this phase)

- [x] 1. Project setup
  - [x] 1.1 Scaffold Vite React + TypeScript project; configure strict TS.
  - [x] 1.2 Add Vitest; add `test`, `typecheck`, `build` scripts.
  - _Requirements: Tech steering, Req 8.1 (no remote/tracking)._

- [x] 2. Domain types and money
  - [x] 2.1 `types.ts`: Participant, Expense, Ledger, PersistedDoc, Result.
  - [x] 2.2 `money.ts`: `parseMoneyToPaise`, `formatPaise`.
  - _Requirements: 2.2, 6.5._

- [x] 3. Splitting
  - [x] 3.1 `split.ts`: `splitEqualPaise` with sorted-ID remainder distribution.
  - _Requirements: 3.1–3.4. Properties: P2, P3, P4._

- [x] 4. Balances
  - [x] 4.1 `balances.ts`: `computeBalances` (paid/share/net).
  - _Requirements: 4.1–4.3. Properties: P5._

- [x] 5. Settlement
  - [x] 5.1 `settlement.ts`: `planSettlement` greedy two-pointer, bounded.
  - _Requirements: 5.1–5.6. Properties: P6, P7, P8._

- [x] 6. Ledger operations and validation
  - [x] 6.1 `ledger.ts`: add/delete participant & expense with validation.
  - [x] 6.2 `validateLedger` structural + referential checks; `sampleLedger`.
  - _Requirements: 1.x, 2.x, 7.4._

- [x] 7. Persistence
  - [x] 7.1 `storage.ts`: versioned load/save, export, import (atomic), reset.
  - _Requirements: 7.1–7.7. Properties: P9._

- [x] 8. UI
  - [x] 8.1 ParticipantsPanel, ExpenseForm, ExpenseList.
  - [x] 8.2 Dashboard with totals, per-participant breakdown, settlement, empty state.
  - [x] 8.3 DataControls (export/import/sample/reset) with confirmations.
  - [x] 8.4 Accessibility: labels, alert/live regions, keyboard, landmarks.
  - _Requirements: 6.x, 7.6–7.7, 8.2–8.4._

- [x] 9. Example tests
  - [x] 9.1 money/split/balances/settlement/import example tests (Vitest).
  - _Requirements: 2.2, 3.x, 4.3, 5.x, 7.5._

- [x] 10. Verify
  - [x] 10.1 Run `npm run test`, `npm run typecheck`, `npm run build`.
  - [x] 10.2 README + docs/evidence/01-core-development.md (honest results).

## Phase 1b — Money correctness review and hardening

Findings were reproduced against the actual phase-1 code before any fix (see
`docs/evidence/07-money-guardian.md`).

- [x] R1. Verify money parser near Number.MAX_SAFE_INTEGER against an
  independent BigInt oracle. Finding: the existing `isSafeInteger` guard already
  prevented silent per-value rounding; added an explicit `MAX_EXPENSE_PAISE`
  bound and oracle-based boundary regression tests.
- [x] R2. Impose explicit aggregate bounds so valid ledger totals/balances stay
  exact. Added `MAX_LEDGER_TOTAL_PAISE`; enforced in `addExpense` and
  `validateLedger`. Reproduced the pre-fix aggregate-overflow conservation
  break first.
- [x] R3. Harden `splitEqualPaise`: use `Number.isSafeInteger`, enforce the
  expense bound, and reject duplicate member ids (previously collapsed silently,
  breaking conservation).
- [x] R4. Persistence recovery: preserve corrupt stored data instead of
  overwriting it on first save; surface storage-read and save failures to the
  UI. Added `loadLedgerResult`, `RECOVERY_KEY`, and Result-returning
  `saveLedger`; gated the mount save in `App.tsx`.
- [x] R5. Upgrade vulnerable pinned dev dependencies (vite, vitest, and the
  coupled `@vitejs/plugin-react`) to current stable versions; re-run typecheck,
  tests, build, and `npm audit` (0 vulnerabilities).
- [x] R6. Add meaningful example regression tests for all of the above.
- [x] R7. Update spec/steering/README honestly and record evidence in
  `docs/evidence/07-money-guardian.md`.

## Deferred to later phases (not phase 1)
- [ ] 11. Property-based tests (fast-check) implementing P1–P9 — **IDE phase**.
- [ ] 12. Hook configuration/trigger — later phase.
- [ ] 13. Power / MCP / custom agent work — later phases.
