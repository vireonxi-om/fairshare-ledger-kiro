# Design notes — exact money

Rationale behind each invariant the `money-audit` skill checks. These are
general principles; map them onto the user's actual types during review.

## 1. Integer minor units

Store money as an integer count of the smallest indivisible unit of the
currency: paise for INR, cents for USD, etc. A value of ₹12.34 is `1234`.

Why: binary floating point cannot represent most decimal fractions exactly.
`0.1 + 0.2 === 0.30000000000000004` in IEEE-754. Any accumulation, equality
check, or division on float money leaks error that eventually surfaces as a
cent that does not reconcile. Integers in the minor unit are exact for addition,
subtraction, comparison, and integer division.

Trade-off: you must track the currency's fractional-digit count (its *exponent*)
separately — 2 for INR/USD, 0 for JPY, 3 for some others. One currency per
ledger keeps this simple.

## 2. Exact decimal parsing

Parse text to minor units without ever constructing a float:

1. Trim. Reject empty.
2. Match a strict grammar: optional integer part, optional `.` with 1–2
   fractional digits. No signs if only non-negative amounts are valid, no
   thousands separators unless you explicitly strip them first.
3. Split on `.`. Left-pad/right-pad the fractional part to exactly the
   currency's digit count.
4. Combine as integers: `integerPart * 100 + fractionalPart` for 2-digit
   currencies.

Anti-pattern: `Math.round(parseFloat(text) * 100)`. For inputs like
`"1.005"` or large values this rounds the already-lossy float and produces the
wrong minor-unit value. Parse the *digits*, not a float.

Format back only at the display edge: `whole = n / 100`, `frac = n % 100`,
zero-pad `frac` to 2 digits. The integer is the source of truth.

## 3. Deterministic remainder allocation

To split `A` minor units among `k` parts:

- base share `q = floor(A / k)`;
- remainder `r = A mod k` (`0 ≤ r < k`);
- give `q + 1` to the first `r` parts and `q` to the rest.

"First `r`" must be defined by a **stable, sorted key** — ascending participant
ID is the canonical choice. If you instead iterate a hash map or rely on
insertion order, the same ledger can produce different (though still
conserving) allocations on different runs or machines, breaking reproducibility
and tests.

This guarantees: sum of shares `= k·q + r = A` (conservation), and max share −
min share `≤ 1` (fairness).

## 4. Overflow and bounds

JavaScript numbers are IEEE-754 doubles; integers are exact only up to
`Number.MAX_SAFE_INTEGER = 2^53 − 1 = 9_007_199_254_740_991`. That is about
₹90 trillion in paise — comfortably large for a roommate ledger, but code that
sums many large expenses, or that handles currencies with 3+ fractional digits
and large principals, can exceed it. Past that limit, `n + 1 === n` can be true
and conservation silently breaks.

Checks:

- individual amounts are non-negative integers (`Number.isInteger`) within a
  sane maximum;
- running sums are asserted `≤ Number.MAX_SAFE_INTEGER`;
- if the domain can legitimately exceed the safe range, use `BigInt` end to end
  rather than `number`.

## 5. Balances

Per participant: `paid = Σ amounts of expenses they paid`,
`share = Σ their assigned share across all expenses`, `net = paid − share`.
Because every expense's shares sum to its amount, and every amount is counted
once on the paid side, `Σ net = Σ paid − Σ share = 0` exactly. A non-zero total
net is a conservation bug upstream (usually a bad split or float money).

## 6. Settlement: correct and bounded, not minimal

Given nets that sum to zero, a simple greedy plan clears everyone:

- separate debtors (`net < 0`) and creditors (`net > 0`), each sorted by stable
  ID;
- repeatedly transfer `min(|debtor|, creditor)` from the current debtor to the
  current creditor, advancing whichever side reaches zero.

Properties:

- every transfer is a positive integer;
- no self-transfers (debtor and creditor are different people);
- at most `n − 1` transfers for `n` non-zero participants, because each step
  zeroes at least one party;
- applying all transfers returns every net to zero.

This is **not** guaranteed to be the globally minimal number of transfers (that
problem is NP-hard in general). Do not advertise minimality — advertise
correctness and the `n − 1` bound.

## 7. Import integrity

Validate the entire imported document — schema, referential integrity (every
`payerId` and split member is a known participant), amount ranges, conservation
— *before* mutating any live state. On any failure, abort with the existing
data unchanged. Never apply a document field-by-field such that a later failure
leaves a half-updated ledger.
