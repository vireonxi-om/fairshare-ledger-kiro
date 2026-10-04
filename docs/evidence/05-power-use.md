# Evidence — Phase: Exact Money power activation and verification

This document records the real actions performed in a single authorized,
noninteractive turn: activating the installed cloud-synced **Exact Money**
power, reading its `money-audit` skill through the Kiro Powers interface, and
running the power's `verify.mjs` script. It records only what happened.

## Context

A previous noninteractive run had its tools blocked by automatic CLI denials
caused by incompatible trust-tool names in the coordinator — those were not
human rejections. This turn was explicitly authorized to perform the actions
below and nothing else.

## Scope boundaries (observed)

Permitted and performed:
- Activate the `exact-money` power via the Kiro Powers interface.
- Read the `money-audit` skill via the Kiro Powers interface.
- Run `node powers/exact-money/verify.mjs`.
- Write this evidence file.

Explicitly not done (no such actions were taken):
- No other file mutations beyond this evidence file.
- No network services started.
- No account or settings changes.
- No public posting.
- No git commits or pushes.
- The configured Stop hook was left to run automatically; its wrapper was not
  invoked manually.

## Actions and outcomes

### 1. Activate the power (Kiro Powers interface)
`action=activate`, `powerName=exact-money`.

Outcome: the power activated and reported its available skill:
- `money-audit`

### 2. Read the money-audit skill (Kiro Powers interface)
`action=readSkill`, `powerName=exact-money`, `skillName=money-audit`.

Outcome: the full skill content was returned. It defines an Exact Money audit
covering nine core invariants — integer minor units, exact decimal parsing,
deterministic remainder allocation, conservation, fairness bound, balances
netting to zero, settlement validity, bounds/overflow safety, and import
integrity — plus a five-step review procedure (learn the model, audit
arithmetic/representation, audit determinism, verify with an independent oracle,
report) and instructions for running the dependency-free auditor at
`skills/money-audit/scripts/audit-ledger.mjs`.

### 3. Run the verify script
Command (run from the workspace root):
```
node powers/exact-money/verify.mjs
```

Observed output:
```
OK   valid-ledger.json accepted (exit 0)
OK   invalid-ledger.json rejected (exit 1)

VERIFY PASS: auditor accepts valid and rejects invalid.
```

Process exit code: `0`.

`verify.mjs` runs the independent auditor against two fixtures and requires both
expectations to hold: the valid ledger (`fixtures/valid-ledger.json`) is accepted
with exit 0, and the invalid ledger (`fixtures/invalid-ledger.json`) is rejected
with a non-zero exit. Both held, so the verifier passed.

## Result

All three authorized actions completed successfully. The Exact Money power is
installed and functional: it activates through the Kiro Powers interface, its
`money-audit` skill content is readable, and its self-verification passes
(auditor accepts the valid fixture and rejects the invalid one).

## Honest limitations and non-claims
- This run verified only that the power's own fixtures behave as expected
  (valid accepted, invalid rejected). It did not audit the FairShare domain code
  itself and makes no new claim about that code's correctness.
- No property-based tests were run or added here.
- The configured Stop hook, if any, runs automatically after this turn; nothing
  in this document was produced by invoking it manually.
