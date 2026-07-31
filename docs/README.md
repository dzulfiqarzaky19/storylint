# Docs map (start here)

Clone → read **this page** → follow one lane. Do not browse the folder as a flat pile.

## Product truth (locks)

| Read | Owns | Do not treat as |
|------|------|-----------------|
| [IA_MAP.md](./IA_MAP.md) | **Structure** — three ecosystems, depth 3, shell, journeys, gates, what we will not add | A density checklist |
| [design/CANON-VOCABULARY.md](./design/CANON-VOCABULARY.md) | **Words** — user-facing labels (Draft/Lab/Canon, sheet kinds, @canon) | Code enum names |
| [CALM_BUDGET.md](./CALM_BUDGET.md) | **Numbers** — HARD/WARN density bar + how to measure | IA structure (link IA instead) |
| [design/TOKENS.md](./design/TOKENS.md) | **Paint + sizes** — Kobo paper, rails, no magic numbers | Product IA |
| [PRD.md](./PRD.md) | **Why / MVP spine / non-goals** | Live chrome inventory (see IA_MAP status) |

**Landmines (confirm in IA_MAP before coding):** Lab · Draft · Canon only · depth ≤3 · no fourth ecosystem · Continuity = verb (Companion **Check**, never top bar) · Draft = prose · chapters never become Canon · kind labels **Characters / Lore / World / Organizations**.

## Process

| Read | Owns |
|------|------|
| [GIT_WORKFLOW.md](./GIT_WORKFLOW.md) | Branch off `origin/dev`, `--no-ff`, **push is part of merge**, report origin hash |
| [AGENT_PROTOCOL.md](./AGENT_PROTOCOL.md) | State-change reports, shippable slices, handoffs, coordinator anti-duplicate |
| [AGENTS_ROLES.md](./AGENTS_ROLES.md) | Coder / reviewer / verifier · **AI harness local-only** · commit story |
| [BUILD.md](./BUILD.md) | Slice status + coder stop conditions (historical slice detail) |
| [E2E.md](./E2E.md) | Playwright smoke how-to |

## Decision history (not locks)

| Read | Owns |
|------|------|
| [decisions/README.md](./decisions/README.md) | Index of judgments + measurements-over-time split |
| [DOCTRINE_AUDIT.md](./DOCTRINE_AUDIT.md) | **Hazard map** — ranked contradictions (C1–C10); what almost caused a wrong build |
| Individual files under `decisions/` | Ox adjudications, design reviews, QA records — **history even when superseded** |

When a decision is superseded, the file stays; the banner points at what replaced it. Do not delete.

## Design surfaces (how, not whether)

| Read | Owns |
|------|------|
| [design/README.md](./design/README.md) | Design-folder index |
| [design/COMPANION.md](./design/COMPANION.md) | Right-rail faces by context |
| [design/LAB.md](./design/LAB.md) | Lab bench (shipped) |
| [03-ux.md](./03-ux.md) | Journeys + reading profiles + layout narrative (**structure details → IA_MAP**) |
| [research/ui-ux/README.md](./research/ui-ux/README.md) | Evidence pack — **locks win** on conflict |
| [UX_PASS.md](./UX_PASS.md) | Phased Playwright UX drives (process for reviewers) |
| [04-agents.md](./04-agents.md) | In-app agent product behavior |

## Ownership (one owner; others link)

| Rule family | Owner | Everyone else |
|-------------|-------|---------------|
| Ecosystems / depth / gates / Continuity placement | **IA_MAP** | Link; do not restate full tables |
| User-facing words | **CANON-VOCABULARY** | Link; UI strings match the lexicon |
| Density pass/fail numbers | **CALM_BUDGET** | IA §12 = intent; CALM = measurable bar |
| Token values | **TOKENS** + `src/design/tokens.css` | No hex in features |
| Git / origin truth | **GIT_WORKFLOW** | Reports use origin hash |
| Swarm cadence | **AGENT_PROTOCOL** | — |
| “What almost went wrong” | **DOCTRINE_AUDIT** + **decisions/** | Not a second IA |

Healthy overlap = one sentence + link. Drift risk = two full copies of the same rule.

## What a new engineer still gets wrong

1. **`manuscript` / Write / Draft** — code mode `manuscript`, companion face **Write** (co-write), ecosystem label **Draft**. Three different things.
2. **Sheet opens in the binder stack**, not center stage (IA §2/§4.4; D5 center-sheet **retracted** — [decisions/adjudication-d5-sheet-binder.md](./decisions/adjudication-d5-sheet-binder.md)).
3. **Kind chips** — binder shows Characters/…; graph may still show raw enums until C5 lands ([DOCTRINE_AUDIT](./DOCTRINE_AUDIT.md) C5). Prefer `SHEET_KIND_LABEL`.
4. **`@bible` vs `@canon`** — vocabulary prefers `@canon`; shipped badge may still say `@bible` (C8 copy debt).
5. **Face count** — allow-list can be 5; **≤3 primary tabs** + More + Inbox badge. Not “delete Research.”
6. **density-audit / old QA shots** — historical unless re-run; not a live implementer checklist ([decisions/density-audit-qa3.md](./decisions/density-audit-qa3.md)).
7. **Working tree ≠ truth** in a multi-agent repo — `git show origin/dev:path` ([GIT_WORKFLOW](./GIT_WORKFLOW.md) §5).
8. **PRD phase table lags** — slices through **L** shipped in BUILD; PRD “through H” is spine language, not “stop at H.”
9. **D4 Canon map chrome** — may live only on a topic branch until merged; do not invent a second map spec from memory.

## Suggested first hour

1. This file  
2. [IA_MAP.md](./IA_MAP.md) §1–§2, §8, §16  
3. [design/CANON-VOCABULARY.md](./design/CANON-VOCABULARY.md) §2  
4. [CALM_BUDGET.md](./CALM_BUDGET.md) severity + B1–B3  
5. [GIT_WORKFLOW.md](./GIT_WORKFLOW.md) + [AGENT_PROTOCOL.md](./AGENT_PROTOCOL.md)  
6. Your slice in [BUILD.md](./BUILD.md) · paint in [design/TOKENS.md](./design/TOKENS.md)
