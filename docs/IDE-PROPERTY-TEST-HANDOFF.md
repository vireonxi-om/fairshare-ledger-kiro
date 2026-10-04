# Your one Kiro IDE task — property-based testing

Status: COMPLETED AND VERIFIED. The entrant executed the supplied prompt and follow-up through Kiro IDE 1.2.4. Tasks 11 and 14 are complete; 92 tests, TypeScript, production build and npm audit pass. The original instructions below are preserved as the actual handoff, not an outstanding task. See docs/evidence/04-ide-properties.md.

## Steps
1. Open `/home/vixa/Desktop/CODEX SESSIONS/kiro` in your signed-in Kiro IDE.
2. Start a Spec conversation and attach `.kiro/specs/fairshare-ledger/requirements.md`, `design.md`, `tasks.md`.
3. Use the prompt below. Allow Kiro IDE to derive/refine correctness properties, implement property tests and run them. Follow any spec task approval prompts.
4. Preserve the actual passing terminal/test output and at least one screenshot showing the Kiro IDE property workflow. Keep private account identifiers out of screenshots you intend to publish.
5. Tell the operator when done and provide the actual outcome. Do not claim success if generation or execution failed. The operator can inspect the resulting tests and run output afterward.

## Paste into Kiro IDE

> Continue the existing FairShare Ledger spec in this workspace. This phase is specifically property-based testing in Kiro IDE. Read the project steering and requirements/design/tasks. Derive/refine the spec correctness properties and implement substantive fast-check tests using Vitest, with explicit reproducible seeds and at least 500 generated inputs per property (configure BigInt-compatible fast-check generators or the documented app bounds; current test runner has separate domain/node and ui/jsdom projects). Use independent oracles, not tests that merely call the same implementation twice. Cover exact decimal-to-paise parsing against BigInt, conservation and fairness of equal splits, participant-order invariance, ledger balances sum exactly zero, settlement simulation clears every net with positive safe integer transfers and no self-transfers within n-1 transfers, deterministic settlement, valid export/import roundtrip, and rejection of malformed/overflowing imports without changing the current ledger. Generate valid varied ledgers, boundary values and invalid mutations. Run the properties through the IDE spec workflow, fix any genuine counterexamples and run again. Record actual tool versions, commands, seed/runs and real output in docs/evidence/04-ide-properties.md. Mark task 11 complete only after passing execution. Do not invent prior IDE usage or mark the lesson complete merely because files exist. Keep .execution private. Do not commit/publish or change accounts.

## Evidence the operator will check
- Actual property test source, generators, seeds and meaningful assertions.
- Connection of each property to the spec requirement.
- Actual IDE-origin generation and run evidence.
- Counterexamples and fixes if any occurred.
- Passing output and final source, with accurate limitations.

The challenge reviewer decides whether the demonstration qualifies. This handoff is preparation, not proof of completion.
