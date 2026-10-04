# Exact Money — a Kiro power

Audit and design **exact integer money handling**. This power helps you review
code and data that stores, parses, splits, or settles currency so that no paise
(or cent) is ever silently created, lost, or made dependent on map iteration
order.

It bundles:

- a **`money-audit` skill** with the invariants of correct money code, a
  step-by-step review procedure, and reference material;
- a **dependency-free Node auditor** (`audit-ledger.mjs`) that acts as an
  independent oracle over a normalized ledger JSON;
- **fixtures** (one valid, one invalid) and a **`verify` command** that proves
  the auditor accepts the valid ledger and rejects the invalid one.

Built against the Agent Plugins 1.0.0 specification.

## What it checks

For a normalized ledger (integer paise, stable participant IDs, equal expense
splits) the auditor independently re-derives shares, balances, and a settlement
plan, then verifies:

- **Structure & bounds** — required fields, unique IDs, every amount a positive
  safe integer within `Number.MAX_SAFE_INTEGER`, running sums do not overflow.
- **Referential integrity** — every `payerId` and split member is a known
  participant; no duplicate split members.
- **Split conservation & fairness** — shares sum to each amount exactly; any two
  shares differ by at most one paisa.
- **Balances** — participant nets (`paid − share`) sum to exactly zero.
- **Settlement** — positive integer transfers, no self-transfers, at most
  `n − 1` transfers for `n` non-zero participants, and applying the plan clears
  every balance to zero.

The skill explains how to adapt these invariants to *your* actual domain model
(field names, money type, trust boundaries) rather than forcing your data into
one fixed shape.

## Install (local)

Installation and activation happen in Kiro; this repository only packages the
power. To import it:

1. Open **Kiro → Powers panel → Add Custom Power**.
2. Choose **Import power from a folder**.
3. Select this `exact-money` directory (the folder containing `plugin.json`).
4. Activate by using the power's keywords in a conversation — e.g. *"audit the
   money splitting"*, *"check paise rounding"*, *"review the settlement plan"*.

## Usage

### Invoke the skill

Once active, ask Kiro to apply the audit, for example:

- "Use the money-audit skill to review `src/domain/split.ts` for remainder
  determinism and conservation."
- "Audit my exported ledger JSON for split and settlement correctness."
- "Check this parser — does it convert decimal rupees to paise without floats?"

The skill will first learn your real model, then audit arithmetic,
determinism, and the invariants, and report per-invariant results with evidence.

### Run the auditor directly

The auditor needs only Node (no dependencies):

```
node skills/money-audit/scripts/audit-ledger.mjs <ledger.json>
```

- exit `0` — all checks passed;
- exit `1` — at least one check failed (reasons printed);
- exit `2` — usage/IO error.

Example against the bundled valid fixture:

```
node skills/money-audit/scripts/audit-ledger.mjs fixtures/valid-ledger.json
```

```
PASS  conservation
PASS  fairness
PASS  balances-zero-sum
PASS  settlement-transfers
PASS  settlement-bound
PASS  settlement-clears

OK: fixtures/valid-ledger.json passed all exact-money checks.
```

### Verify the power

The `verify` command proves the auditor accepts the valid fixture (exit exactly
0) and rejects every invalid fixture (exit exactly 1). Each fixture under
`fixtures/reject/` is otherwise valid and carries exactly one structural fault,
so each rule is proven independently:

```
node verify.mjs
```

```
OK   valid-ledger.json accepted (exit 0)
OK   invalid-ledger.json rejected (exit 1)
OK   reject/bad-date-pattern.json rejected (exit 1)
OK   reject/bad-title-type.json rejected (exit 1)
OK   reject/extra-expense-key.json rejected (exit 1)
OK   reject/extra-participant-key.json rejected (exit 1)
OK   reject/extra-root-key.json rejected (exit 1)
OK   reject/missing-date.json rejected (exit 1)
OK   reject/missing-title.json rejected (exit 1)
OK   reject/no-schema-version.json rejected (exit 1)
OK   reject/schema-version-overflow.json rejected (exit 1)
OK   reject/schema-version-zero.json rejected (exit 1)

VERIFY PASS: 1 accepted (exit 0), 11 rejected (exit 1).
```

## Normalized ledger shape

The auditor expects the shape documented in
`skills/money-audit/references/ledger-schema.json`:

```json
{
  "schemaVersion": 1,
  "currency": "INR",
  "participants": [
    { "id": "p1", "name": "Asha" },
    { "id": "p2", "name": "Bijay" },
    { "id": "p3", "name": "Chandni" }
  ],
  "expenses": [
    {
      "id": "e1",
      "title": "Groceries",
      "payerId": "p1",
      "amountPaise": 1000,
      "date": "2026-01-05",
      "splitMemberIds": ["p1", "p2", "p3"]
    }
  ]
}
```

If your export differs, write a small adapter to this shape, or port the
specific check you need from `references/oracle-patterns.md`.

## Layout

```
exact-money/
├─ plugin.json                         # Agent Plugins 1.0.0 manifest
├─ README.md
├─ BUILD-NOTES.md                      # factual packaging/verification results
├─ verify.mjs                          # proves accept-valid / reject-invalid
├─ fixtures/
│  ├─ valid-ledger.json
│  ├─ invalid-ledger.json
│  └─ reject/                          # one structural fault per fixture
└─ skills/
   └─ money-audit/
      ├─ SKILL.md
      ├─ scripts/
      │  └─ audit-ledger.mjs           # dependency-free auditor
      └─ references/
         ├─ design-notes.md
         ├─ oracle-patterns.md
         └─ ledger-schema.json
```

## Limitations and scope

- **Equal splits only.** The bundled auditor models equal splitting with
  deterministic remainder allocation. Weighted/percentage/share-based splits are
  not implemented in the script; the invariants in the skill still apply, and
  the design notes explain how to extend them.
- **Single currency, INR paise.** The script fixes `currency: "INR"` and 2
  fractional digits. The principles generalize to any minor-unit currency, but
  the script does not do multi-currency.
- **Settlement is correct and bounded, not minimal.** The greedy plan clears all
  balances in at most `n − 1` transfers but is not claimed to be the globally
  minimum number of transfers.
- **Not a parser.** The auditor validates already-parsed integer paise. The
  skill covers decimal-to-paise parsing, but the script does not re-parse text.
- **Not a substitute for property-based tests.** The auditor checks concrete
  fixtures/data; `references/oracle-patterns.md` shows how to lift the same
  invariants into bounded randomized property tests in your own codebase.
- **No external effects.** The power reads local JSON only; it makes no network
  calls and transmits no data.

## License

MIT.
