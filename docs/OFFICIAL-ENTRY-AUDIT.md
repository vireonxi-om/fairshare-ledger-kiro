# Official Kiro University entry audit

Reviewed live official challenge, complete embedded lessons, terms and submission-form copy on October 4, 2026. Organizer acceptance is separate from development evidence.

Official sources:
- https://kiro.dev/2026/university/
- https://kiro.dev/2026/university/terms/
- https://kiro.dev/2026/university/submit/

Deadline: October 5, 2026, 23:59 Pacific daylight time = October 6, 2026, 12:29 p.m. IST. Potential maximum: 5,250 credits.

## Development and lesson requirements

| Requirement | Audit result | Evidence |
|---|---|---|
| Functional original project; Kiro primary tool | Implemented through actual Kiro CLI/IDE/cloud sessions; reviewed repairs through Kiro | README and docs/evidence |
| Public repository owned by entrant | Public repository under authenticated entrant GitHub handle | Repository owner and public link verified via GitHub API |
| First commit during challenge, no earlier commits | First commit October 4; complete history has no pre-challenge commits | Authentic git history |
| Relevant .kiro configuration | Specs, steering, hook, agent and MCP files committed | .kiro/ |
| Specs, steering, hooks, powers, MCP, custom agent | Real configured/use/result evidence present | docs/LESSON-EVIDENCE.md |
| IDE-only property testing | Actual Kiro IDE tasks 11/14, seeded generated checks and passing results | docs/evidence/04-ide-properties.md |
| Paid Web/cloud/configuration bonus | Actual paid cloud session, Configuration Sync/local consumption and useful cloud work | docs/evidence/08-cloud-session.md and 11-configuration-sync.md |
| Original packaged power bonus | Valid plugin.json, reusable skill/references/auditor and actual installation/use | powers/exact-money/ |

## Remaining submission requirements

| Requirement | Current status |
|---|---|
| 30-second-to-3-minute public demo, app working and lesson coverage | **Pending final recording/publication** |
| Video explicitly shows local-versus-cloud engineering/config sync | **Pending video evidence**, actual workflow already completed |
| Public X/LinkedIn post | **Pending**; requires repository, public demo, identical 2–3 sentence description, #KiroUniversity #BuildWithKiro and correct tag |
| Entrant age/residence/exclusions/account ownership | Entrant directly confirmed age18+, eligible Indian residence, no AWS employee/family/household exclusion and owns Kiro account; detailed personal form fields kept private |
| GitHub account at least 3 months old | Account created July 5; reaches 3 calendar months October 5 22:08:35 IST. Rules do not clarify calendar-vs-day count or whether development before that point is eligible. **Unresolved organizer interpretation** |
| Single individual entry, consistent GitHub/social identity | Chosen X profile authenticated and matched to entrant name; single-entry attestation still required |
| Correct Kiro email/userID and personal fields | Collect accurately in private form preparation |
| Terms and broad AWS submission license/rights attestations | User review required before final legal acceptance |
| Successful submitted form confirmation before deadline | **Not submitted** |

## After cutoff

No repository commits after October 6 12:29 p.m. IST until an award email arrives or judging concludes (October 20 12:29 p.m. IST), whichever earlier. The workflow creates no scheduled commits. Credits, if awarded, are non-transferable and subject to official redemption/expiry conditions.

Completing seven lesson demonstrations does not mean the entry is submitted or eligible. No maximum award is guaranteed; reviewer judgment controls acceptance and scoring.

## Repair verification from this audit

Concrete source/packaging gaps were reproduced and repaired through Kiro CLI: empty/reused domain IDs, local expense-date default, stale payer/split state, incomplete power schema checks, missing license files and incorrect Node requirements. Final suite 101 tests/14 files; typecheck/build clean; zero npm vulnerabilities; original IDE properties unchanged. Power manifest validates; 1 accepted and 11 rejected fixtures have exact expected exit codes and agree with JSON Schema. See 13-final-project-audit.md for authentic chronology, including the second pass that closed remaining date-pattern/schemaVersion mismatches.
