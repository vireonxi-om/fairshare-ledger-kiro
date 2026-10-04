# 06 — Hook verification note

Date: 2026-10-04
Scope: Verify finished money bounds and the normalized Exact Money fixture
assertions without changing app source. Record the custom agent's `stop`
hook configuration, initially left pending and then **verified by the operator** against the real automatic run record (see final section).

## Money bounds (verified by reading source, no edits)

`src/domain/types.ts` defines the finished bounds:

- `MAX_EXPENSE_PAISE = 1_000_000_000_000_000` (1e15) — per-expense cap.
- `MAX_LEDGER_TOTAL_PAISE = 9_000_000_000_000_000` (9e15) — ledger-total cap,
  strictly below `Number.MAX_SAFE_INTEGER` (9_007_199_254_740_991).

Both bounds sit below `MAX_SAFE_INTEGER` with headroom for per-participant
accumulation across up to `MAX_PARTICIPANTS = 12` participants, keeping every
derived aggregate (totals, paid/share, nets, transfers) exact.

`src/domain/split.ts` enforces these at runtime in `splitEqualPaise`:

- rejects non-safe or negative `amountPaise`;
- rejects `amountPaise > MAX_EXPENSE_PAISE`;
- rejects empty or duplicate member id sets;
- distributes the remainder deterministically by ascending sorted id, so shares
  sum exactly to the amount with a max spread of 1 paisa.

These match the invariants in
`powers/exact-money/skills/money-audit/references/design-notes.md`
(sections 1–6: integer minor units, exact parsing, deterministic remainder,
overflow bounds, zero-sum balances, bounded-but-not-minimal settlement).

## Normalized Exact Money fixture assertions (verified by running the power)

Re-run on 2026-10-04 for this correction. Both commands exited 0.

Command: `node powers/exact-money/verify.mjs`

```
OK   valid-ledger.json accepted (exit 0)
OK   invalid-ledger.json rejected (exit 1)

VERIFY PASS: auditor accepts valid and rejects invalid.
```

Per-assertion detail against the normalized valid fixture
(`node powers/exact-money/skills/money-audit/scripts/audit-ledger.mjs powers/exact-money/fixtures/valid-ledger.json`):

```
PASS  conservation
PASS  fairness
PASS  balances-zero-sum
PASS  settlement-transfers
PASS  settlement-bound
PASS  settlement-clears

OK: powers/exact-money/fixtures/valid-ledger.json passed all exact-money checks.
```

The independent auditor re-derives splits, balances, and a greedy settlement
from the raw integer-paise amounts and confirms: split conservation and the
≤1-paisa fairness bound, balances summing to exactly zero, positive-integer
transfers with no self-transfers, the ≤ n−1 transfer bound, and that applying
the plan clears every balance to zero.

No app source was modified during this verification. UI refinement is being
done concurrently and is out of scope for this note.

## Custom agent `stop` hook

The custom agent `money-guardian` (`.kiro/agents/money-guardian.json`) has a
`stop` hook configured (the supported agent JSON hook key is `stop`, not
`agentStop`; it is validated under that key):

```json
"hooks": {
  "stop": [
    { "command": "node scripts/check-after-turn.mjs", "timeout_ms": 120000 }
  ]
}
```

The corresponding hook definition `.kiro/hooks/typecheck-after-turn.json`
("Typecheck after turn") uses `"trigger": "Stop"` and runs
`node scripts/check-after-turn.mjs`, which per its own description runs
`npm run typecheck` (`tsc --noEmit`), skips while a guardian/concurrent-edit
lock is active, and records a privacy-safe run record under the gitignored
`.execution/hook-runs/`.

### Trigger status during agent turn: initially pending, now verified

The hook is **configured**, as confirmed above by reading the agent and hook
JSON. Whether it actually **fired** on turn completion is left **pending**:

- The hook wrapper (`scripts/check-after-turn.mjs`) was deliberately **not**
  executed manually, so no synthetic run record was produced.
- Confirmation of a genuine trigger requires an operator to inspect an authentic
  run record (e.g. under `.execution/hook-runs/`) produced by Kiro firing the
  hook naturally at end of turn.

This note records configuration only; the operator should verify the actual
trigger against a genuine record before marking trigger status as confirmed.

## Operator verification after turn completion

The configured custom-agent `stop` hook actually ran automatically after the corrected Kiro CLI turn. The operator found and read the genuine privacy-filtered run record `.execution/hook-runs/typecheck-2026-10-04T11-10-02-492Z.json`. It reports trigger `stop`, command `npm run typecheck`, status `passed`, exit code 0, duration 955 ms, and actual clean TypeScript output. The wrapper was not manually invoked for this run. The earlier simulated skip-path record was removed during setup and is not this evidence.

Run time: October 4, 2026, 4:40:02 p.m. IST. The raw private record is gitignored; a reviewed copy is saved beside this document. Lesson hook execution is now verified for the installed CLI custom agent. The standalone PascalCase `Stop` file is retained for current IDE/Web compatibility; actual local trigger evidence comes from the agent's lowercase `stop` configuration.
