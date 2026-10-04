# Requirements — FairShare Ledger

## Introduction
FairShare Ledger is a local-first React + TypeScript web application that lets a
small group (2–12 people) track shared expenses and compute how to settle up.
Money is stored and computed exclusively in integer paise, one currency per
ledger (INR). The application is deterministic, performs no network calls for
ledger data, and persists to versioned browser storage with safe import/export.

Requirements use EARS (Easy Approach to Requirements Syntax). "THE System"
refers to the FairShare Ledger application. "SHALL" denotes a mandatory
behavior.

---

## Requirement 1 — Participant management
**User story:** As a group organizer, I want to manage participants, so that
expenses can reference stable, named people.

### Acceptance criteria
1.1. WHEN the user adds a participant with a name whose trimmed length is between
1 and 40 characters, THE System SHALL create a participant with a unique stable
ID and the trimmed name.
1.2. IF the user attempts to add a participant whose trimmed name is empty, THEN
THE System SHALL reject the addition and SHALL display an accessible error.
1.3. IF the user attempts to add a participant whose trimmed name duplicates an
existing participant's name (case-insensitive), THEN THE System SHALL reject the
addition and SHALL display an accessible error.
1.4. WHILE a ledger has fewer than 2 participants, THE System SHALL indicate that
at least 2 participants are required before expenses can be added.
1.5. IF the user attempts to add a participant WHILE the ledger already has 12
participants, THEN THE System SHALL reject the addition and SHALL display an
accessible error.
1.6. WHEN the user deletes a participant who is not referenced by any expense (as
payer or split member), THE System SHALL remove that participant.
1.7. IF the user attempts to delete a participant referenced by any expense, THEN
THE System SHALL reject the deletion and SHALL explain that the participant is in
use.

## Requirement 2 — Expense entry
**User story:** As a group member, I want to record a shared expense, so that the
cost is attributed to a payer and divided among the people who shared it.

### Acceptance criteria
2.1. WHEN the user submits an expense with a non-empty title (trimmed length 1–60),
a payer that is an existing participant, a positive money amount, a valid date,
and at least one selected split participant, THE System SHALL add the expense with
a unique stable ID.
2.2. THE System SHALL parse the amount from decimal text to exact integer paise,
accepting an optional thousands-free integer part and at most two fractional
digits.
2.3. IF the amount text is not a positive number with at most two fractional
digits, THEN THE System SHALL reject the expense and SHALL display an accessible
error.
2.4. IF the selected payer is not an existing participant, THEN THE System SHALL
reject the expense.
2.5. IF no split participant is selected, THEN THE System SHALL reject the expense
and SHALL display an accessible error.
2.6. WHEN the user deletes an expense, THE System SHALL remove it and SHALL
recompute balances and settlement.

## Requirement 3 — Equal splitting (deterministic)
**User story:** As a group member, I want each expense divided fairly to the
paise, so that totals always reconcile exactly.

### Acceptance criteria
3.1. WHEN THE System splits an expense amount of `A` paise equally among `k`
selected participants, THE System SHALL assign each participant a base share of
`floor(A / k)` paise.
3.2. WHERE there is a remainder `r = A mod k`, THE System SHALL distribute one
extra paisa to each of the first `r` participants ordered by ascending stable
participant ID.
3.3. THE System SHALL guarantee that the sum of all assigned shares for an expense
equals the expense amount exactly (no paise created or lost).
3.4. THE System SHALL produce identical shares for identical inputs regardless of
the order in which participants were added or the iteration order of any map.

## Requirement 4 — Balances
**User story:** As a group member, I want to see what each person paid, owed, and
nets out to, so that I understand my position.

### Acceptance criteria
4.1. THE System SHALL compute, per participant, total paid (sum of amounts of
expenses they paid) and total share (sum of their assigned shares across all
expenses).
4.2. THE System SHALL compute each participant's net as `paid − share` in paise.
4.3. THE System SHALL guarantee that the sum of all participants' net balances is
exactly zero.

## Requirement 5 — Settlement plan (deterministic, bounded)
**User story:** As a group member, I want a concrete list of who pays whom, so
that we can settle up with the fewest practical transfers.

### Acceptance criteria
5.1. WHEN balances are non-trivial, THE System SHALL produce a list of transfers,
each with a distinct debtor, a creditor, and a positive integer paise amount.
5.2. THE System SHALL NOT produce any transfer whose debtor equals its creditor.
5.3. THE System SHALL produce at most `n − 1` transfers for `n` participants with
non-zero balances.
5.4. WHEN the settlement transfers are applied to the net balances, THE System
SHALL clear every participant's balance to exactly zero.
5.5. THE System SHALL produce the same settlement plan for the same balances
(deterministic ordering by stable participant ID).
5.6. THE System SHALL NOT claim the plan uses the globally minimal number of
transfers.

## Requirement 6 — Dashboard and formatting
**User story:** As a group member, I want a clear dashboard, so that I can read
totals and the settlement at a glance.

### Acceptance criteria
6.1. THE System SHALL display the total amount spent in the ledger formatted as
INR.
6.2. THE System SHALL display, per participant, paid, share, and net formatted as
INR, with negative nets clearly indicated.
6.3. THE System SHALL display the expense history and the settlement transfers.
6.4. WHILE the ledger has no expenses, THE System SHALL show an accessible empty
state rather than an error.
6.5. THE System SHALL format all monetary values from integer paise and SHALL NOT
display floating-point artifacts.

## Requirement 7 — Persistence and data safety
**User story:** As a user, I want my ledger saved locally and safe import/export,
so that I keep my data without risking corruption.

### Acceptance criteria
7.1. WHEN the ledger changes, THE System SHALL persist it to browser localStorage
under a versioned schema key.
7.2. WHEN the application starts, THE System SHALL load the stored ledger if it is
present and valid for the current schema version; otherwise THE System SHALL start
from an empty ledger.
7.3. WHEN the user exports, THE System SHALL produce a JSON document containing the
schema version and the full ledger.
7.4. WHEN the user imports a JSON document, THE System SHALL validate the entire
document before applying it.
7.5. IF an imported document fails validation, THEN THE System SHALL reject it,
SHALL leave the current ledger unchanged, and SHALL display an accessible error.
7.6. WHEN the user chooses reset, THE System SHALL clear the ledger after an
explicit confirmation.
7.7. WHEN the user loads sample data, THE System SHALL replace the current ledger
with a predefined valid sample ledger after an explicit confirmation.

## Requirement 8 — Local-first and accessibility
**User story:** As a privacy-conscious user, I want the app to work offline with no
tracking and to be usable with a keyboard and screen reader.

### Acceptance criteria
8.1. THE System SHALL NOT transmit ledger data to any remote endpoint and SHALL
NOT include analytics or tracking.
8.2. THE System SHALL provide semantic labels for all form controls.
8.3. THE System SHALL be operable using the keyboard for all primary actions.
8.4. THE System SHALL present error and empty states via text that is available to
assistive technologies.

---

## Correctness properties (for later property-based tests)
These universal properties restate the invariants above for the IDE property-test
phase. Implementation of the property tests is deliberately deferred.

- **P1 — Parse/format round-trip.** For any non-negative amount with ≤ 2 fractional
  digits, `formatPaise(parseMoneyToPaise(text))` equals the canonical INR
  representation of `text`, and `parseMoneyToPaise` returns a non-negative integer.
  (Req 2.2, 6.5)
- **P2 — Split conservation.** For any positive amount `A` and any 1–12
  participants, the sum of equal-split shares equals `A` exactly. (Req 3.3)
- **P3 — Split fairness bound.** For any such split, every pair of shares differs by
  at most 1 paisa. (Req 3.1–3.2)
- **P4 — Split determinism.** Shuffling participant input order yields identical
  per-ID shares. (Req 3.4)
- **P5 — Balances sum to zero.** For any ledger, the sum of all participant nets is
  exactly 0. (Req 4.3)
- **P6 — Settlement clears balances.** Applying the planned transfers to the nets
  zeroes every participant. (Req 5.4)
- **P7 — Settlement transfer validity.** Every transfer amount is a positive
  integer, no transfer is a self-transfer, and the plan has ≤ n−1 transfers for `n`
  participants with non-zero balance. (Req 5.1–5.3)
- **P8 — Settlement determinism.** The same balances always yield the same ordered
  plan. (Req 5.5)
- **P9 — Import atomicity.** For any invalid import document, the current ledger is
  unchanged. (Req 7.5)
