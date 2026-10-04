# Independent oracle patterns

An *oracle* is a second, independent way to decide whether an output is correct.
For money code, the strongest oracles are the universal invariants: they must
hold for *every* input, so they can be checked by property-based tests
(fast-check, Hypothesis, QuickCheck) or by the bundled auditor against real
data, without duplicating the production algorithm.

Keep oracles independent: do not call the production function to compute the
"expected" value and then compare it to itself. Re-derive the expected property
from first principles.

## P1 — Parse/format round-trip

For any non-negative amount text with ≤ 2 fractional digits:
`format(parse(text))` equals the canonical form of `text`, and `parse(text)` is
a non-negative integer.

```
forall text in validAmountTexts:
  p = parse(text)
  assert Number.isInteger(p) && p >= 0
  assert format(p) === canonical(text)   // canonical: trim, pad to 2 dp
```

## P2 — Split conservation

Shares always sum back to the amount.

```
forall A in positiveInts, k in 1..12:
  shares = split(A, k)
  assert sum(shares) === A
```

## P3 — Fairness bound

Equal-split shares differ by at most one minor unit.

```
forall A, k:
  shares = split(A, k)
  assert max(shares) - min(shares) <= 1
```

## P4 — Split determinism

Shuffling the participant order yields identical per-ID shares.

```
forall A, participants:
  a = splitByIds(A, participants)
  b = splitByIds(A, shuffle(participants))
  assert a == b   // compared per stable ID, not positionally
```

## P5 — Balances sum to zero

```
forall ledger:
  assert sum(net(p) for p in participants) === 0
```

## P6 — Settlement clears balances

```
forall balances summing to 0:
  plan = settle(balances)
  applied = apply(plan, balances)
  assert all(applied[p] === 0 for p)
```

## P7 — Settlement transfer validity

```
forall balances:
  plan = settle(balances)
  assert all(t.amount > 0 && Number.isInteger(t.amount) for t in plan)
  assert all(t.debtor !== t.creditor for t in plan)
  nNonZero = count(p where net(p) != 0)
  assert plan.length <= max(0, nNonZero - 1)
```

## P8 — Settlement determinism

```
forall balances:
  assert settle(balances) deepEquals settle(balances)   // and across runs
```

## P9 — Import atomicity

```
forall invalidDoc:
  before = snapshot(ledger)
  result = import(invalidDoc)
  assert result.rejected
  assert snapshot(ledger) deepEquals before
```

## Generators

Useful input generators when wiring these into a PBT framework:

- amounts: non-negative integers, biased to include `0`, `1`, large values near
  the safe-integer boundary, and values that produce non-zero remainders;
- participant counts: `1..12`, including the `k = 1` edge (whole amount to one
  share) and `k > A` (many zero or one-paisa shares);
- ledgers: random participants with stable IDs, random expenses whose payer and
  split members are drawn from the participants, mixing single- and
  multi-member splits.

The bundled `scripts/audit-ledger.mjs` applies P2, P5, P6, P7 (and basic
integer/membership checks) to a concrete fixture; the generators above let you
extend the same invariants to bounded randomized property tests in the user's
code. Such tests sample many cases per run but are not an exhaustive proof over
all inputs.
