# Standing rules (from decisions)

**Read this before coding against a “finding.”** Full memos live under [decisions/](./README.md). Product locks stay in [IA_MAP](../IA_MAP.md) · [CALM_BUDGET](../CALM_BUDGET.md) · [CANON-VOCABULARY](../design/CANON-VOCABULARY.md).

**Density-pass product map (conclusions, not incidents):** [density-pass-settled-positions](./density-pass-settled-positions.md).

## Measurement (evidence)

1. **If a check cannot state what it examined and at what commit, its output is not evidence.** Owned stack + HEAD + served bundle (every origin the test talks to) — or refuse, never green. ([milestone-density-pass](./milestone-density-pass.md), [calm-budget-r3-ox](./calm-budget-r3-ox.md) FG7)
2. **Never infer visibility from geometry.** Use `checkVisibility` + closed-`<details>` guard; assert both directions in the self-test. ([rule-visibility-not-geometry](./rule-visibility-not-geometry.md))
3. **Absence is not a pass.** Outcomes are PASS / FAIL / **NOT-MEASURED**; NOT-MEASURED fails the gate. ([rule-visibility-not-geometry](./rule-visibility-not-geometry.md), r3 M3)
4. **A selector that matches nothing is a failure**, not a quiet PASS. ([rule-visibility-not-geometry](./rule-visibility-not-geometry.md) M2)
5. **Assert on behaviour and state, never on a label you do not own.** Prefer roles, `data-*`, structure over marketing copy / aria substrings. ([milestone-density-pass](./milestone-density-pass.md), [copy-audit-task-t](./copy-audit-task-t.md))
6. **A fixture that changes the state under test is not a fixture.** Empty checks on empty; density/hierarchy on seeded. Forced-open companion is labeled and is not default-rail evidence. ([calm-budget-r3-ox](./calm-budget-r3-ox.md), [CALM_BUDGET](../CALM_BUDGET.md) r3)
7. **Verify a finding still describes the code before building against it.** Worktree ≠ truth; `git show origin/dev:path`. ([CODE_VERIFY](../CODE_VERIFY.md), [GIT_WORKFLOW](../GIT_WORKFLOW.md))
8. **A test may only interact with entities it created in that run.** Depending on a pre-existing project, file, or option the smoke did not create measures the machine, not the product. Create both sides of a switch test inside the check. (slice-j / ninth lie — [milestone-density-pass](./milestone-density-pass.md); ambient-gitignored-data mechanism **disproven**)
8a. **A diagnostic proven only on the happy path is not proven.** Step labels, timers and failure logs exist for the failure path — fault-inject once and watch the failure output name the thing. A log that fires when nothing is wrong tells you nothing when something is. (badger step timings, verified happy-path only; keep distinct from §3 — [standing-8a-vs-absence](./standing-8a-vs-absence.md))
8b. **State what you did not verify.** A verdict with no stated limits has unknown limits. Explicit non-claims are what make a PASS worth reading.
8c. **A check is evidence only if it can fail the product, is reached by a reporter, and was actually run before citation.** (1) Cannot-fail-when-product-breaks occupies the slot — name the production symbol or it is an isolated-copy proof. (2) Unwired check: green and red are equally uninformative; if not named in a runner it is a diagnostic, not a gate — label the file. (3) A green is only evidence if the artifact was executed (source grep / tripwire text is not a run). Remedy: drive shipped symbol, wire or delete, run before cite. Two impls agreeing need a pin test. ([check-occupies-slot](./check-occupies-slot.md))
8d. **A mutation survival is only evidence if the build succeeded, the mutated line executes, and the mutant actually removed the property under test.** Build-check and property-check every mutant before believing a survival. Nonzero BUILD_EXIT, dead-line, or property still present (e.g. partial .replace on multi-occurrence) = NOT-MEASURED. Type-safe equivalent when needed. §3 on the mutation instrument — guards 8a/8c. Coverage % thresholds rejected — they pay you to write the mutant that hides the gap (cheapest whole-construct kill). ([mutation-must-build](./mutation-must-build.md))
8e. **A report line must not name a stronger verdict than the check performed.** Convention checks must not emit execution tokens (`gate-ok` forbidden → `convention-ok`). Unwired/manual files labelled `MANUAL DIAGNOSTIC` emit `diagnostic`, not convention-ok. Guard stays silent on runner membership. Same disease family as 8c (proxy for execution), reporter layer. ([report-line-strength](./report-line-strength.md))
8f. **An instruction that only a human can execute is unprotectable.** Keep instructional comments few and adjacent; prefer a check over a comment. Remote/duplicated prose rot (E1-2). Same limit covers **probe verdict predicates** (item 15): Gate B can validate the mutant while the checker's own pass/fail sentence lies — not a fifth 8d leg. When a verdict banner and its supporting numbers disagree, **the numbers are the evidence; the verdict is a claim.** Mechanical gates raise the floor, not the ceiling. ([unprotectable-instructions](./unprotectable-instructions.md))

## Actions (same disease as unattributed measurement)

9. **Never combine a verification command with a mutating one.** Read, then act, as separate steps. A verify that also pushes or checks out is not evidence of the pre-state.
10. **Never filter the output of a command that mutates a remote.** Pipes and greps hide the mutation line; run mutators plain so the full transcript is the record.
11. **A fix can be correct while its stated cause is wrong.** Ship the fix with an open question rather than a confident false mechanism — the wrong cause stops the next person looking. (rat scar: slice-j — [milestone-density-pass](./milestone-density-pass.md))
11b. **Prefer the boring mechanism until the code rules it out.** Reach for single-process, same-file, already-known causes before cross-agent, timing, or environmental ones. Ask "is this the loud defect we already understand, with its evidence lost?" before naming a new one.

    **Cost of ignoring it — three wrong mechanisms in one session, all rat, all the same shape:**

    | Claimed | Actual |
    |---|---|
    | Parser scores a green run as opaque failure | Token is gated on `status !== 0`; the run genuinely failed |
    | A reviewer's build killed another agent's calm run | Four-minute gap; hypothesis built from an open-files list, which carries **no timestamps** |
    | Cross-agent contention on `data/projects` | Single-process: unqueued `load()` racing `saveDirect`'s rename, plus per-request store instances |

    Each was escalated before reading the code that would have settled it. Two reached eight agents as instructions to change behaviour. The correcting evidence in every case was cheap — forty lines of a script, a reflog, one code read.

11c. **Correlation of files touched is not evidence of interference.** Check the clock — `git reflog`, file mtimes, artifact timestamps — before attributing one agent's failure to another's activity.
11a. **A fix that eliminates the symptom by quietly discarding the thing being protected is not a fix.** Corollary: when a fix has a "just clean it up" branch, check whether that branch destroys what the ticket exists to preserve. (ox/rat: T-004 auto-drop draft on server move; badger tsc@0 fixture that two branches could both catch — [sheet-identity-durable-dirty](./sheet-identity-durable-dirty.md))

## Class over instance

12. **A defect found once is a hypothesis about a class.** Before fixing an instance, grep for the mechanism and count the sites. Report the count. The instance is almost always cheaper than the class — fixing only the instance leaves the class live. ([milestone-density-pass](./milestone-density-pass.md) § class-over-instance)
13. **Reporter names the mechanism; fixer owns the sweep** (or hands the inventory to whoever does). "Look for more" is advice; naming + counting + sweep ownership is the procedure.
13a. **Inventory is not verdict.** Same presentation can be two defects (Inbox wall ≠ Promoted length tax). Verify each site’s failure mode before applying the same fix. ([lab-lifecycle-ends](./lab-lifecycle-ends.md), [canon-under-load-az](./canon-under-load-az.md))

## Modeling

14. **Do not collapse a multi-state domain into a boolean.** Name the states; fixture the ones that change behaviour (true-empty · seeded-blank · populated is the type case). ([boolean-hides-multi-state](./boolean-hides-multi-state.md); render twin: [save-chip-error-not-idle](./save-chip-error-not-idle.md) — SaveState error must not paint as idle)

## Product chrome

15. **One solid primary per job in the viewport**, counted across regions. Same verb + destination = one job; second door demotes or hides. ([one-primary-door-per-job](./one-primary-door-per-job.md)) — check **B6-primary-per-job** **LANDED** (empty Canon + Draft fixtures).
16. **A solid must not advertise a job that cannot succeed** in the current state (runnable-solid). Weight and entitlement are different axes. ([runnable-solid-precondition](./runnable-solid-precondition.md))
17. **Build the control the current cardinality justifies.** One overflow target → plain control, not a one-item menu costume. Grow the menu when the second target exists. ([research-face-shape](./research-face-shape.md); APG full-menu greenlight **retracted**)
18. **Companion is one assistant doing one job.** Jobs share assistant busy (Chat, cowrite/Spark, Continuity, Research **query**). **Decisions stay free** under jobs (Inbox Accept/Edit/Reject, Apply/Dismiss, Research Pin/Propose) with local busy only. No run-id parallel lanes; one busy word family for jobs; face shows this run’s outcome. ([companion-one-assistant](./companion-one-assistant.md), [companion-lock-jobs-vs-decisions](./companion-lock-jobs-vs-decisions.md))
19. **A panel is not a unit of work.** One face may host a job and decisions (Research query vs Pin/Propose). Do not gate the whole face because one control is a job. ([companion-lock-jobs-vs-decisions](./companion-lock-jobs-vs-decisions.md))
20. **Canon has exactly one write path and it is explicit** — Accept on a proposal, or Save on an author sheet edit (with leave guard). Never silent bible write; never Accept/Reject on author sheet edits. Canon + Inbox are the system of record. **Durable dirty** (local crash copy of form dirty) is allowed and required for process lifetime — it restores **as dirty** and never writes Canon without Save. ([copy-audit-task-t](./copy-audit-task-t.md), [sheet-dirty-leave-guard](./sheet-dirty-leave-guard.md), [sheet-identity-durable-dirty](./sheet-identity-durable-dirty.md), [lab-lifecycle-ends](./lab-lifecycle-ends.md))
21. **User-facing bible → Canon is full sweep or none** (half-rename is revert-class). Graph kinds use `SHEET_KIND_LABEL`. Kind chips stay Characters/Lore/World/Organizations — People/Places renames rejected. ([pack-b-canon-dialect-complete](./pack-b-canon-dialect-complete.md), [design-review-l2](./design-review-l2.md))
22. **New project ≠ first boot.** Boot may seed Chapter One; New project stays empty. Seeded-default is a third arrival. Same empty-door rules when empty; fixtures cover true-empty / seeded-blank / populated. ([new-project-vs-first-boot](./new-project-vs-first-boot.md), [seeded-default-first-impression](./seeded-default-first-impression.md))
23. **Sheet = binder Level-3 stack**, not center stage. ([adjudication-d5-sheet-binder](./adjudication-d5-sheet-binder.md))
24. **Writing faces:** ≤3 primary peers (Chat·Write·Check) + Inbox badge + quiet Research/More — allow-list may be 5; not a ≤3 redesign gate. ([design-review-d6](./design-review-d6.md), [research-face-shape](./research-face-shape.md))
25. **Lab is transient.** Promoted = dismissible receipts (not forever audit, not auto-outbox); dismiss does not undo Canon/Inbox. Archive is a state with Restore; no hard delete v1. ([lab-lifecycle-ends](./lab-lifecycle-ends.md))
25b. **Consent is destination-shaped.** Model text may land on a Lab card freely. Crossing into a system of record needs destination honesty: sheet promote stays one-click → pending (Accept gates Canon); chapter promote of model-sourced cards requires title confirm before stored chapter title is written. **Every LabCard carries `source: author|model`.** ([lab-promote-consent-provenance](./lab-promote-consent-provenance.md))
25c. **No silent inherit into the record.** A system-of-record field receives intermediate or model-sourced text only via an **explicit write argument** — never by copying ambient state. Durable dirty cannot become Canon without Save; domain chapter promote of a **model** beat stores chapterTitle only when the caller passes it (omit yields empty string), never auto-picks card.title. UI confirm supplies the argument; domain structure is the gate. ([lab-promote-domain-title](./lab-promote-domain-title.md), [sheet-identity-durable-dirty](./sheet-identity-durable-dirty.md))
25a. **Unsaved author work is a first-class state.** Discard only by explicit author act (Discard, or a conflict choice that names loss). Crash/refresh/tab death are not discard. Same duty as Lab intermediate ends (archive+Restore, dismissible receipts) — different tier, same principle. ([sheet-identity-durable-dirty](./sheet-identity-durable-dirty.md), [lab-lifecycle-ends](./lab-lifecycle-ends.md))
26. **Network at volume:** full graph when small; thresholded default kind-slice when N≥24; honesty count when narrowed. ([network-at-volume](./network-at-volume.md))

## Process letters

35. **One letter ladder per axis.** L1/L2 = pipeline altitude only. P0/P1… = ticket priority only. Gate strength = HARD/WARN full words — no third L*/P* scheme. ([pipeline-gate-vocabulary](./pipeline-gate-vocabulary.md))

## Gate

Citable green = `npm run test:green` only (not a lone smoke, not an unproven calm row).

## Pipeline + tickets (process)

26. **L1 owned-stack Playwright before land** for product/UI fixes — isolation proof on the change; then `npm run land` only. ([AGENT_PIPELINE](../AGENT_PIPELINE.md))
27. **L2 composition E2E on `origin/dev` before story close / main** — isolation green ≠ composition green. ([AGENT_PIPELINE](../AGENT_PIPELINE.md))
28. **No start lower priority while a P0 is open** without founder/rat override on the ticket. Run `npm run tickets:check`. ([tickets/README](../tickets/README.md))
29. **Measure condition labels / probe chrome are not default product evidence.** Assert behaviour and state; probes may aid reports only. ([AUDIT_HANDOFF](../AUDIT_HANDOFF.md))
30. **Code review and E2E verify are different questions.** "Is the change sound?" (reads the diff) vs "did the ticket's intent land on the running product?" (drives the app, does not read the diff). Neither substitutes for the other. ([AGENT_PIPELINE](../AGENT_PIPELINE.md))
31. **A failed E2E verify is a bug, not a review rejection.** It opens a ticket at ≥ prior priority and re-enters the sprint; it does not revert the land. ([AGENT_PIPELINE](../AGENT_PIPELINE.md))
32. **The coordinator is not an approval gate before landing.** Review → land → verify. A coordinator inbox between "reviewed" and "landed" is what produced the 83-commit dev/main drift. ([AGENT_PIPELINE § Sprint model](../AGENT_PIPELINE.md))
33. **`dev → main` at every 5 lands, with a named milestone on the merge subject.** The count is the trigger; the name is what the subject says. Both hold. Supersedes the earlier "never at a commit count" wording, which read as forbidding the founder's own cadence — corrected 2026-08-01 after rat cited it against horse. ([AGENT_PIPELINE](../AGENT_PIPELINE.md), [GIT_WORKFLOW](../GIT_WORKFLOW.md))
34. **Authority claims need citable words.** "X asked for this" must come with what X actually said. A missing citation disproves the citation, **not** the claim — re-ask rather than concluding it was invented. (rat scar: koala pipeline land)
35. **One land per feature, not per step.** A land is the unit the founder reads; it should be a thing they can name. A ticket lands with its own close. Review follow-ups fold into the branch before it lands, not after it. Batch only what shares a reason — independent risk, separate tickets, and hotfixes still land separately. (founder, 2026-08-01, after 128 lands in one day; [GIT_WORKFLOW § Land granularity](../GIT_WORKFLOW.md#land-granularity))
36. **Two lanes, chosen by whether anything must be verified together.** *Feature lane:* `feature-NN-ticket-MM` → `feature-NN` → (E2E on the whole feature) → `dev`; landing a feature ticket straight on `dev` skips that gate. *Bugfix lane:* one `T-###`, `storylint/<topic>`, straight to `dev` — an integration branch buys no evidence when there is nothing to compose. A bugfix that grows into several interdependent tickets becomes a feature. ([FEATURE_PIPELINE § Two lanes](../FEATURE_PIPELINE.md))
37. **A coder self-reviews end to end before handing up.** Not "the unit test passes" — drive the real path and be able to say what would have shown it broken. A reviewer is not the coder's test runner. ([FEATURE_PIPELINE § Stage 3](../FEATURE_PIPELINE.md))
38. **A failed review goes back to the coder, not to the coordinator.** The coordinator splits, assigns, pools and opens fix tickets; it is not a relay for review outcomes. ([FEATURE_PIPELINE § Stage 4](../FEATURE_PIPELINE.md))
39. **Run the documented workflow before publishing it.** The feature-pipeline doc told coders to branch `feature-01-ticket-01`; `land.mjs` refused that exact name. Caught by executing the instructions, not by reading them. A workflow nobody has run is a hypothesis. (rat scar, 2026-08-01)

## Still open

See [README.md § Still open](./README.md#still-open).
