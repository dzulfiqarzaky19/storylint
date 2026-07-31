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

Adversarial code check: [CODE_VERIFY.md](./CODE_VERIFY.md) (VERIFIED/STALE with `file:line` @ origin/dev).

1. **`manuscript` / Write / Draft** — code mode `manuscript` (`Shell.tsx`), companion face **Write** (co-write), ecosystem label **Draft**. Three different things. **VERIFIED**
2. **Sheet opens in the binder push-stack**, not center stage (IA §2/§4.4; D5 retracted). List stays mounted under detail (`Binder.tsx` `binder__stack-*`). **VERIFIED**
3. **Kind chips** — binder uses `SHEET_KIND_LABEL`; **graph still renders raw enums** (`RelationshipGraph.tsx` filter `{kind}`, node `graph__kind`) until C5 merges. **VERIFIED open**
4. **`@bible` vs `@canon`** — vocabulary prefers `@canon`; shipped `AgentPanel` still shows `@bible` badge. **VERIFIED**
5. **Face count** — `FACES.writing` length 5; `PRIMARY_FACES.writing` = chat/write/check; Research under **More**; Inbox badge. Not “delete Research.” **VERIFIED**
6. **density-audit / old QA shots** — historical unless re-run ([decisions/density-audit-qa3.md](./decisions/density-audit-qa3.md)). Binder-void and pre-stack sheet notes inside it are **not** current code. **VERIFIED**
7. **Working tree ≠ truth** — `git show origin/dev:path` ([GIT_WORKFLOW](./GIT_WORKFLOW.md) §5). **VERIFIED** (process)
8. **PRD is intent-at-the-time** — §§3–9 historical; BUILD = ship; IA_MAP = structure. **VERIFIED** (rat ruling)
9. **D4 Canon map chrome** — not on origin/dev docs tree until merged; don’t invent a second map spec. **VERIFIED**
10. **Rails** — runtime 272/272/280/320; companion **closed by default below 1366**. Ignore any leftover 300/360/380/420 sketches. **VERIFIED**
11. **Binder empty project** — binder mounts whenever `project.project` exists (`Shell.tsx`), not only with an active chapter. **VERIFIED**

## Suggested first hour

1. This file  
2. [IA_MAP.md](./IA_MAP.md) §1–§2, §8, §16  
3. [design/CANON-VOCABULARY.md](./design/CANON-VOCABULARY.md) §2  
4. [CALM_BUDGET.md](./CALM_BUDGET.md) severity + B1–B3  
5. [GIT_WORKFLOW.md](./GIT_WORKFLOW.md) + [AGENT_PROTOCOL.md](./AGENT_PROTOCOL.md)  
6. Your slice in [BUILD.md](./BUILD.md) · paint in [design/TOKENS.md](./design/TOKENS.md)
