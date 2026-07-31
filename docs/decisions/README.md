# Decisions & reviews

**Purpose:** durable **judgments** that must survive clone/clean.  
**Also tracked (elsewhere):** measurements-over-time whose value is the **diff across commits** — today [`e2e/output/calm-budget-run.md`](../../e2e/output/calm-budget-run.md) (calm bar scoreboard at a known HEAD). Regenerable is not the test; a future reader cannot cheaply reconstruct product state at that commit.

**Not tracked:** raw evidence dumps — screenshots, probe JSON/logs, skill dumps, drive scratch — under `e2e/output/` (gitignored except the scoreboard exception).

**Policy:** see root [.gitignore](../../.gitignore) section `e2e/output`. This folder = judgments. Scoreboard = tracked measurement.


**Related product locks:** [IA_MAP.md](../IA_MAP.md) · [CALM_BUDGET.md](../CALM_BUDGET.md) · [DOCTRINE_AUDIT.md](../DOCTRINE_AUDIT.md)

---

## Index

| File | Kind | Author | Decided / use |
|------|------|--------|----------------|
| [adjudication-d5-sheet-binder.md](./adjudication-d5-sheet-binder.md) | adjudication | ox | D5 sheet→center RETRACTED; IA_MAP §2/§4.4 binder Level-3 stack STANDS; residue F1/F2/F3 (Task V / octopus) |
| [calm-budget-authority-ox.md](./calm-budget-authority-ox.md) | design-authority | ox | How CALM numbers were judged (B1≥40 floor, faces≤5 ceiling not ≤3 gate, structure checks). Still useful history. |
| [calm-budget-r3-ox.md](./calm-budget-r3-ox.md) | design-authority | ox | Green-vs-calm r3: false green/red, M1–M11, structure over ratios. **Live bar** = [../CALM_BUDGET.md](../CALM_BUDGET.md) r3 (Task AG) |
| [density-audit-qa3.md](./density-audit-qa3.md) | audit | dolphin | Surface density fault list @ pre-fix head (historical). D5 center-sheet fix SUPERSEDED by adjudication-d5. Re-run before new D-tasks. |
| [design-review-r1.md](./design-review-r1.md) | design-review | ox | Round-1 accept/reject by surface @ 8911406; drives calm budget + density follow-ups |
| [design-review-d6.md](./design-review-d6.md) | design-review | ox | ACCEPT D6 companion face density (Chat/Write/Check + More/Inbox badge) |
| [design-review-task-l.md](./design-review-task-l.md) | design-review | ox | Task L binder polish + Canon labels review (later partly reverted in L2) |
| [design-review-l2.md](./design-review-l2.md) | design-review | ox | ACCEPT L2 kind-label revert → Characters/Lore/World/Organizations |
| [ia-final-qa.md](./ia-final-qa.md) | qa-record | qa (ia-final-qa.mjs) | PASS 14/14 J1/J2/J3 + Canon entry @ 6a2a74b |
| [ia-step1-qa.md](./ia-step1-qa.md) | qa-record | qa (ia-step1-qa.mjs) | PASS with nits — IA step-1 naming/entry @ 67592a1/b68703e |
| [milestone-density-pass.md](./milestone-density-pass.md) | milestone-notes | horse | Density-pass founder summary @ 4327572; holds = calm gate + Canon dirty-guard; deliberate non-goals |
| [orchestrator-ux-faults.md](./orchestrator-ux-faults.md) | review-handoff | hamster | Priority UX fault queue for orchestrator (request changes) |
| [ux-report.md](./ux-report.md) | review | hamster | Full UX drive report; paint doctrine Kobo/brass not skill OLED |

---

## Split rule

| Keep tracked | Leave ignored |
|---|---|
| Judgments / adjudications / design reviews (this folder) | Screenshots, webp, shot folders |
| **Measurements-over-time** — e.g. `e2e/output/calm-budget-run.md` scoreboard (diffable product-vs-bar at a commit) | Probe JSON / logs / zip (machine dumps) |
| | `calm-budget-run.json` (full machine payload; .md is the canonical scoreboard) |
| | ux-progress / ux-graph-progress scratch |
| | ux-pro-max-* skill dumps |

Former paths were mostly `e2e/output/<name>.md`. Prefer this folder for any new **ACCEPT / RETRACT / HARD bar / adjudication**. QA scripts may still write to `e2e/output/`; promote judgment markdown here when final. Re-run `npm run calm` and commit the updated `.md` scoreboard when the bar measurement is meant to land in history.


---

## Supersession (do not delete history)

| Record | Status |
|--------|--------|
| [density-audit-qa3.md](./density-audit-qa3.md) | **Historical** pre-fix snapshot. D5 center-sheet **RETRACTED** → [adjudication-d5-sheet-binder.md](./adjudication-d5-sheet-binder.md) + IA_MAP §2/§4.4 |
| [design-review-task-l.md](./design-review-task-l.md) | Kind **renames REJECTED** — see [design-review-l2.md](./design-review-l2.md) + [../design/CANON-VOCABULARY.md](../design/CANON-VOCABULARY.md) |
| [calm-budget-authority-ox.md](./calm-budget-authority-ox.md) | Judgment method still useful; **live bar** = [../CALM_BUDGET.md](../CALM_BUDGET.md) **r3** via [calm-budget-r3-ox.md](./calm-budget-r3-ox.md) |
| [ia-step1-qa.md](./ia-step1-qa.md) | Superseded as latest IA QA by [ia-final-qa.md](./ia-final-qa.md) (keep both) |

Corpus entry: [../README.md](../README.md).

## How to add a decision

1. Write or copy the memo into `docs/decisions/<task-traceable-name>.md`.
2. Add a one-line banner comment (author, kind, decided).
3. Link it from this README table.
4. Cite shot paths like `e2e/output/design-review-r1/` — do **not** commit the shot folder.
