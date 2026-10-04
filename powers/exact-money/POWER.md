---
name: exact-money
description: Audit and design exact integer money handling — minor-unit (paise/cents) representation, deterministic remainder allocation, overflow/bounds safety, precise decimal parsing, split conservation, import integrity, and bounded deterministic settlement for ledger and splitting code. Routes Exact Money keywords to the money-audit skill and a dependency-free Node auditor.
keywords:
  - exact money
  - money
  - paise
  - cents
  - minor-unit
  - integer money
  - rounding
  - remainder
  - split
  - settlement
  - ledger
  - overflow
  - determinism
  - currency
  - decimal parsing
  - property testing
---

# Exact Money

Legacy-format (`POWER.md`) wrapper for the **exact-money** power. The
authoritative packaging is the Agent Plugins 1.0.0 manifest in
[`plugin.json`](./plugin.json); this file exists so loaders that read the legacy
`POWER.md` format (which require YAML frontmatter with a `description`) can
discover the same power. The two describe the **same** power — keep their
`name`, `description`, and `keywords` in sync.

> This wrapper only *describes and routes* the power. It does not assert that
> the power is installed or active in any client; activation happens in Kiro
> when the keywords above appear in a conversation.

## What this power does

Exact Money reviews code and data that stores, parses, splits, or settles
currency so that no paise (or cent) is silently **created, lost, or made
dependent on map/iteration order**. It bundles a skill with the invariants of
correct money code, a review procedure, and a dependency-free Node auditor that
acts as an independent oracle over a normalized ledger JSON.

## Routing — where keywords go

When a request mentions the Exact Money keywords above (e.g. "audit the money
split", "check paise rounding", "review the settlement plan", "is this decimal
parser exact?"), route the work as follows:

1. **Primary: the `money-audit` skill.** Follow
   [`skills/money-audit/SKILL.md`](./skills/money-audit/SKILL.md). It defines the
   core invariants (integer minor units, exact parsing, deterministic remainder
   allocation, conservation, fairness bound, zero-sum balances, settlement
   validity, overflow/bounds, import integrity) and a five-step review procedure.
   Start at Step 1 — learn the user's actual money model — before applying any
   check.

2. **Verification: actual Node execution.** Do not claim correctness from reading
   alone. Confirm the invariants on concrete data by running the bundled,
   dependency-free tools (Node standard library only):

   - Independent auditor over a normalized ledger:
     ```
     node skills/money-audit/scripts/audit-ledger.mjs <ledger.json>
     ```
     Exit `0` = all checks passed; `1` = at least one failed (reasons printed);
     `2` = usage/IO error.

   - Self-check that the auditor accepts the valid fixture and rejects the
     invalid one:
     ```
     node verify.mjs
     ```

   For a user's own data whose shape differs from the normalized schema
   ([`skills/money-audit/references/ledger-schema.json`](./skills/money-audit/references/ledger-schema.json)),
   write a small adapter to that shape or port the specific check from
   [`skills/money-audit/references/oracle-patterns.md`](./skills/money-audit/references/oracle-patterns.md),
   as the skill describes.

## Reference material

- [`skills/money-audit/references/design-notes.md`](./skills/money-audit/references/design-notes.md)
  — rationale for integer minor units, parsing, remainder allocation, overflow,
  and settlement bounds.
- [`skills/money-audit/references/oracle-patterns.md`](./skills/money-audit/references/oracle-patterns.md)
  — independent property-oracle patterns (conservation, fairness, determinism,
  clearing).
- [`skills/money-audit/references/ledger-schema.json`](./skills/money-audit/references/ledger-schema.json)
  — the normalized ledger shape the auditor expects.
- [`README.md`](./README.md) — full description, usage, layout, and scope.

## Scope and limitations

Equal splits only in the bundled auditor; single currency (INR paise, 2
fractional digits) in the script; settlement is correct and bounded (≤ n−1
transfers) but **not** claimed globally minimal; the auditor validates
already-parsed integer paise rather than re-parsing text. The power reads local
JSON only — no network calls, no data transmission. See `README.md` for the full
limitations list.

## License

MIT.
