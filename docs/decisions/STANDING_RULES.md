# Standing rules (from decisions)

**Read this before coding against a “finding.”** Full memos live under [decisions/](./README.md). Product locks stay in [IA_MAP](../IA_MAP.md) · [CALM_BUDGET](../CALM_BUDGET.md) · [CANON-VOCABULARY](../design/CANON-VOCABULARY.md).

## Measurement (evidence)

1. **If a check cannot state what it examined and at what commit, its output is not evidence.** Owned stack + HEAD + served bundle (every origin the test talks to) — or refuse, never green. ([milestone-density-pass](./milestone-density-pass.md), [calm-budget-r3-ox](./calm-budget-r3-ox.md) FG7)
2. **Never infer visibility from geometry.** Use `checkVisibility` + closed-`<details>` guard; assert both directions in the self-test. ([rule-visibility-not-geometry](./rule-visibility-not-geometry.md))
3. **Absence is not a pass.** Outcomes are PASS / FAIL / **NOT-MEASURED**; NOT-MEASURED fails the gate. ([rule-visibility-not-geometry](./rule-visibility-not-geometry.md), r3 M3)
4. **A selector that matches nothing is a failure**, not a quiet PASS. ([rule-visibility-not-geometry](./rule-visibility-not-geometry.md) M2)
5. **Assert on behaviour and state, never on a label you do not own.** Prefer roles, `data-*`, structure over marketing copy / aria substrings. ([milestone-density-pass](./milestone-density-pass.md), [copy-audit-task-t](./copy-audit-task-t.md))
6. **A fixture that changes the state under test is not a fixture.** Empty checks on empty; density/hierarchy on seeded. Forced-open companion is labeled and is not default-rail evidence. ([calm-budget-r3-ox](./calm-budget-r3-ox.md), [CALM_BUDGET](../CALM_BUDGET.md) r3)
7. **Verify a finding still describes the code before building against it.** Worktree ≠ truth; `git show origin/dev:path`. ([CODE_VERIFY](../CODE_VERIFY.md), [GIT_WORKFLOW](../GIT_WORKFLOW.md))

## Product chrome

8. **One solid primary per job in the viewport**, counted across regions. Same verb + destination = one job; second door demotes or hides. ([one-primary-door-per-job](./one-primary-door-per-job.md)) — check **B6-primary-per-job** not yet implemented.
9. **Build the control the current cardinality justifies.** One overflow target → plain control, not a one-item menu costume. Grow the menu when the second target exists. ([research-face-shape](./research-face-shape.md); APG full-menu greenlight **retracted**)
10. **Companion is one assistant doing one thing.** Global busy; no run-id parallel lanes; one busy word family; face shows this run’s outcome, not stale success. ([companion-one-assistant](./companion-one-assistant.md))
11. **Canon has exactly one write path and it is explicit** — Accept on a proposal, or Save on an author sheet edit (with leave guard). Never silent bible write; never Accept/Reject on author sheet edits. ([copy-audit-task-t](./copy-audit-task-t.md), [sheet-dirty-leave-guard](./sheet-dirty-leave-guard.md))
12. **User-facing bible → Canon is full sweep or none** (half-rename is revert-class). Graph kinds use `SHEET_KIND_LABEL`. ([pack-b-canon-dialect-complete](./pack-b-canon-dialect-complete.md), [design-review-l2](./design-review-l2.md))
13. **New project ≠ first boot.** Boot may seed Chapter One; New project stays empty. Same empty-door rules when empty. ([new-project-vs-first-boot](./new-project-vs-first-boot.md))
14. **Sheet = binder Level-3 stack**, not center stage. ([adjudication-d5-sheet-binder](./adjudication-d5-sheet-binder.md))
15. **Writing faces:** ≤3 primary peers (Chat·Write·Check) + Inbox badge + quiet Research/More — allow-list may be 5; not a ≤3 redesign gate. ([design-review-d6](./design-review-d6.md), [research-face-shape](./research-face-shape.md))

## Gate

Citable green = `npm run test:green` only (not a lone smoke, not an unproven calm row).

## Still open

See [README.md § Still open](./README.md#still-open).
