# Decisions & reviews

**Purpose:** durable **judgments** that must survive clone/clean.  
**Not here:** screenshots, probe JSON, skill dumps, run progress — those stay under `e2e/output/` (gitignored) and are regenerable.

**Policy:** see root [.gitignore](../../.gitignore) section `e2e/output` — throwaway artifacts ignored; this folder is tracked.

**Related product locks:** [IA_MAP.md](../IA_MAP.md) · [CALM_BUDGET.md](../CALM_BUDGET.md) · [DOCTRINE_AUDIT.md](../DOCTRINE_AUDIT.md)

---

## Index

| File | Kind | Author | Decided / use |
|------|------|--------|----------------|
| [adjudication-d5-sheet-binder.md](./adjudication-d5-sheet-binder.md) | adjudication | ox | D5 sheet→center RETRACTED; IA_MAP §2/§4.4 binder Level-3 stack STANDS; residue F1/F2/F3 (Task V / octopus) |
| [calm-budget-authority-ox.md](./calm-budget-authority-ox.md) | design-authority | ox | CALM_BUDGET HARD/WARN rulings (B1≥40, faces≤5 ceiling not ≤3 gate, structure checks, etc.) |
| [density-audit-qa3.md](./density-audit-qa3.md) | audit | dolphin | Surface density fault list @ pre-fix head (historical). D5 center-sheet fix SUPERSEDED by adjudication-d5. Re-run before new D-tasks. |
| [design-review-r1.md](./design-review-r1.md) | design-review | ox | Round-1 accept/reject by surface @ 8911406; drives calm budget + density follow-ups |
| [design-review-d6.md](./design-review-d6.md) | design-review | ox | ACCEPT D6 companion face density (Chat/Write/Check + More/Inbox badge) |
| [design-review-task-l.md](./design-review-task-l.md) | design-review | ox | Task L binder polish + Canon labels review (later partly reverted in L2) |
| [design-review-l2.md](./design-review-l2.md) | design-review | ox | ACCEPT L2 kind-label revert → Characters/Lore/World/Organizations |
| [ia-final-qa.md](./ia-final-qa.md) | qa-record | qa (ia-final-qa.mjs) | PASS 14/14 J1/J2/J3 + Canon entry @ 6a2a74b |
| [ia-step1-qa.md](./ia-step1-qa.md) | qa-record | qa (ia-step1-qa.mjs) | PASS with nits — IA step-1 naming/entry @ 67592a1/b68703e |
| [orchestrator-ux-faults.md](./orchestrator-ux-faults.md) | review-handoff | hamster | Priority UX fault queue for orchestrator (request changes) |
| [ux-report.md](./ux-report.md) | review | hamster | Full UX drive report; paint doctrine Kobo/brass not skill OLED |

---

## Left ignored (on purpose)

- calm-budget-run.md / .json — machine measurement runs (regenerable)
- ux-progress.md / ux-graph-progress.md — drive progress scratch
- ux-pro-max-*.md — skill dump regenerable
- **/*.{png,webp,jpg,json,log,zip} under e2e/output — shots & probes regenerable
- density/ and other shot folders — path cited from reviews, not committed

Former paths were mostly `e2e/output/<name>.md`. Prefer this folder for any new **ACCEPT / RETRACT / HARD bar / adjudication**. QA scripts may still write to `e2e/output/`; promote the markdown into `docs/decisions/` when the judgment is final.

---

## How to add a decision

1. Write or copy the memo into `docs/decisions/<task-traceable-name>.md`.
2. Add a one-line banner comment (author, kind, decided).
3. Link it from this README table.
4. Cite shot paths like `e2e/output/design-review-r1/` — do **not** commit the shot folder.
