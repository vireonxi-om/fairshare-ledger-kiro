# Kiro lesson evidence map

Status on October 4, 2026: all seven required lessons have actual Kiro development evidence, including completed IDE property testing and its coverage follow-up. This is a factual evidence map, not organizer scoring approval.

| Item | Actual outcome | Inspect |
|---|---|---|
| 1 Specs | Requirements/design/tasks authored through Kiro CLI before core development; implementation and subsequent repairs traced to them | `.kiro/specs/fairshare-ledger/`, `docs/evidence/01-core-development.md` |
| 2 Steering | Applied architecture, integer-paise and stable-ID rules in actual Kiro work; real configuration sync | `.kiro/steering/`, `src/domain/`, `docs/evidence/08-cloud-session.md` |
| 3 Hooks | Supported custom-agent lowercase `stop` triggered automatically and ran clean typecheck; no synthetic event/manual invocation | `.kiro/agents/money-guardian.json`, `scripts/check-after-turn.mjs`, `docs/evidence/06-hook-run.json` |
| 4 IDE property testing | Actual IDE spec tasks 11 and 14 completed: 25 seeded properties × 500 cases, plus shape sampling; full 92-test suite passes | `docs/evidence/04-ide-properties.md`, `docs/evidence/04-operator-verification.md`, `src/**/*.property.test.ts` |
| 5 Power use | Installed cloud-synced Exact Money activated through Kiro Powers, skill read and verifier run; cloud used it on real sample | `docs/evidence/05-power-use.md`, `docs/MONEY-REVIEW.md` |
| 6 MCP | Kiro official-docs-fetch MCP retrieved fast-check arbitraries docs; Kiro page extraction partial, reported honestly | `.kiro/settings/mcp.json`, `docs/evidence/03-mcp-research.md` |
| 7 Custom agent | money-guardian reproduced aggregate overflow/duplicate split/storage loss, repaired code, upgraded dependencies and verified 55 tests; later integration repairs increased suite to 63 | `.kiro/agents/money-guardian.json`, `docs/evidence/07-money-guardian.md`, `docs/evidence/10-storage-integration.md` |
| Cloud bonus | Real Pro Web cloud sandbox, steering sync/local application, dependencies/tests/build and meaningful audit/docs task; video segment still pending | `docs/evidence/08-cloud-session.md`, public PR #1 |
| Package power bonus | Original valid Agent Plugins manifest + substantive reusable skill, oracle references, auditor, valid/invalid fixtures; installed and used | `powers/exact-money/` |

Public repository: https://github.com/vireonxi-om/fairshare-ledger-kiro
Public power manifest: https://github.com/vireonxi-om/fairshare-ledger-kiro/blob/main/powers/exact-money/plugin.json
Reviewed cloud PR: https://github.com/vireonxi-om/fairshare-ledger-kiro/pull/1

No private credentials, raw account session history or entrant eligibility details belong in this map. Final demo/social/form and account eligibility remain pending.
