# Final demo narration and recording checklist

Target: 2 minutes 40 seconds. Use authentic live app footage and captured Kiro UI/result evidence. This is a script, not a claim that recording is completed.

## App workflow — 0:00–0:30

FairShare Ledger helps roommates and trip groups record shared expenses, split every paisa, and see who owes whom. The data stays in this browser. Here is a sample group; adding a hundred rupees and one paisa updates the exact balances and practical settlement plan. JSON export and validated import keep the ledger portable.

Show: load sample, add an expense with selected payer/group, changed totals and settlement, export/import or rejected import preserving data.

## Specs and steering — 0:30–0:50

I used Kiro as the primary development tool. Kiro created requirements, design and tasks before implementation. Steering kept money calculations in pure domain functions, persistence separate from UI, and indivisible paise allocation tied to sorted stable IDs.

Show real requirements/design/tasks and source examples.

## Hook, property tests — 0:50–1:20

The custom agent’s stop hook automatically runs TypeScript checks after a turn. Kiro IDE implemented and ran seeded property tests: twenty-five assertions with five hundred cases each, plus varied-ledger sampling. Independent BigInt oracles check exact money, balances and settlement; storage spies check rejected imports preserve stored bytes.

Show actual hook run, IDE task completion, property source seed/run settings and actual passing results. Say the current full test count only after final verification.

## Power, MCP and custom agent — 1:20–1:55

The installed Exact Money power loaded its reusable money-audit skill and ran an independent fixture verifier. Kiro used MCP to retrieve documentation about generated inputs. My money guardian agent reproduced and repaired aggregate overflow, duplicate IDs, storage recovery and date issues, then ran regression checks.

Show real power activation/readSkill, MCP call results and agent config/repair evidence.

## Cloud and power package bonuses — 1:55–2:30

I synced the local steering and configuration into Kiro Web and applied cloud configuration locally. A real paid cloud sandbox audited the app’s sample ledger, ran tests and build, and produced a reviewed documentation pull request. Exact Money is also an original packaged power with a valid plugin manifest, substantive skill, oracle references and dependency-free auditor.

Show actual Configuration Sync result and local-versus-cloud session/runtime/result; public cloud PR and packaged manifest/resources.

## Closing — 2:30–2:40

The public repository contains the functional app, Kiro configuration, tests and lesson evidence. This demonstrates what was actually used and verified; organizer review determines any award.

Before publishing: remove credentials/private emails/IDs/unrelated tabs from footage; ensure 30–180 second duration and public playback without permission requests. Keep the social description identical to the form description and include required links, tags and hashtags.
