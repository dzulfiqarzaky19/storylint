# #12 Inventory: dev reference bones for dev2 (keep / drop / rewrite)

**Branch inventoried:** `dev`  
**Wayfinder map:** #6  
**Ticket:** #12  
**Date:** 2026-08-02  
**Scope:** research inventory only — no product code changes.

## Locked product bet (dev2 first cut)

From #6 + ticket body:

| Bet | Implication for inventory |
| --- | --- |
| Research → deep living wiki only (character + lore cards) | Keep sheet/fact/proposal/research bones; drop manuscript-first IA |
| No manuscript/chapters surface | Drop chapter editor, craft tags, cowrite/apply/review/continuity chapter spans |
| No agent dashboard complexity; new clean shell; keep liked UI aesthetic | Drop AgentPanel multi-face companion; keep `components/ui` + design tokens |
| Domain bones: sheet/fact/proposal ideas (UI word **Card**) | Keep domain core; rename surface language in rewrite |
| Accept/reject proposals; fact filter for scene beats | Keep proposal accept/reject; rewrite claim/fact filters (ticket #7 owns rules) |
| Magic hub + child pieces; MC fixed sections | Not present as first-class model on `dev` — **new** on dev2 (see Gaps) |
| Reuse LLM + research server wire | Keep `server/llm.ts`, research routes/run |
| Thin multi-book header switcher | Keep project list/activate idea; rewrite chrome (ticket #14) |
| Export/import; starts empty | Keep export bones; **import missing** — add on dev2; no migrate-from-dev junk |
| Drop world/org kinds from first cut UI/model surface | Drop `world` / `organization` from allowed kinds |
| Lab not in first cut | Drop lab domain + API + LabBench |

---

## Verdict gist

**Keep as reference bones (copy/adapt):**  
`Sheet`/`Fact`/`Proposal` domain + accept/reject, project multi-file store, LLM client, research run + pin/propose APIs, export zip/markdown shape, UI primitives + tokens, thin project switcher idea, ProposalCard UX.

**Drop for first cut (do not port):**  
Manuscript shell + chapters, AgentPanel dashboard/faces, Lab entire stack, continuity/cowrite/review/apply chapter pipelines, world/org kinds, relationship graph as center workspace, event-claim extraction spam path, chapter-tied proposal `source` spans as required shape.

**Rewrite on dev2 (idea kept, implementation new):**  
App shell (research rail + center card + wiki list), Card editor (MC fixed sections + magic hub), proposal source model (research/wiki not chapter span), fact-filter policy, research→propose-on-card flow, multi-book header, import path, empty-start project seed.

---

## Keep / drop / rewrite table

Legend: **K** = keep bone (reuse with light trim) · **D** = drop first cut · **R** = rewrite (new module; steal ideas/aesthetics only) · **P** = partial (split inside module)

### Domain (`src/domain`)

| Module | Verdict | Why |
| --- | --- | --- |
| `types.ts` — `Sheet`, `Fact`, `Proposal`, `ProposalStatus`, `ResearchNote`/`ResearchSource` | **K** (trim) | Core wiki canon bones. UI word becomes Card; code may keep sheet ids short-term. |
| `types.ts` — `SHEET_KINDS` includes `world`, `organization` | **D** (first cut surface) | Locked: character + lore only. Keep type evolution path later; do not ship kinds in UI/validation allow-list. |
| `types.ts` — `CLAIM_KINDS` `attribute`/`relationship`/`event`/`existence` | **P** | Keep `attribute` (+ maybe `relationship` later). **Drop event-fact spam path** from extractors/prompts (continuity live aliases `event` → claimKind event). Existence optional later. Fact-filter rules → #7. |
| `types.ts` — `Chapter`, `CraftTag`, `Mark`, `ClaimSpan` chapter-bound | **D** first cut | No manuscript/chapters surface. Marks/continuity lint are later-map. |
| `types.ts` — `Lab`/`LabBoard`/`LabCard` + schemaVersion lab requirement | **D** | Lab not in first cut. |
| `types.ts` — `Project` aggregate | **R** | Same idea (titled wiki container + sheets + proposals + researchNotes). Drop chapters/marks/lab; start empty; optional thinner multi-book shape per #14. |
| `project.ts` — `upsertSheet`, `upsertFact`, `deleteFact` | **K** | Direct wiki mutations. |
| `project.ts` — `patchChapter`/`upsertChapter` | **D** | Manuscript. |
| `proposals.ts` — `acceptProposal` / `rejectProposal` + pack + rejectedFingerprints | **K** | Author always accept/rejects; no silent auto-canon. Pack idea useful for multi-fact propose-on-card. |
| `fingerprint.ts` — `claimFingerprint` | **K** | Dedup/reject memory for proposals. |
| `identityText.ts` | **K** | Shared trim identity for card fields. |
| `lint.ts` — `lintClaims` | **D** first cut (bone for later) | Chapter claim lint → later continuity map. Ideas may inform fact-filter, but not ship path now. |
| `apply.ts` — manuscript range apply | **D** | Cowrite/manuscript. |
| `lab.ts` (+ tests) | **D** | Entire lab promote/pin/archive stack. |
| `index.ts` barrel | **R** | Re-export only kept modules. |

### Server (`src/server`)

| Module / route | Verdict | Why |
| --- | --- | --- |
| `llm.ts` (`completeJson`, `completeText`, trailer-tolerant parse) | **K** | Explicit reuse. |
| `llmConfig.ts` + `src/llm/types.ts` | **K** | Env wire. |
| `store.ts` — `ProjectFileRoot` / `ProjectStore` path lock + multi-project files | **K** | Local multi-book persistence bone. |
| `validation.ts` | **P** | Keep parseSheet/Fact/Proposal/ResearchNote/Project (trimmed). Drop chapter/lab parsers for first cut surface. |
| `zip.ts` + `GET /api/export` | **K** | Export safety. Import **missing** → add (see Gaps / #10). |
| `index.ts` default seed (empty chapter + lab bench) | **R** | dev2 starts **empty** wiki (no chapter stub, no lab). |
| `GET/POST /api/projects`, `POST .../activate` | **K** | Thin multi-book backend. |
| `GET/PUT /api/project` | **K** | Load/save active wiki. |
| `PUT /api/sheets/:id`, fact PUT/DELETE | **K** | Card CRUD. |
| `POST .../proposals/:id/accept\|reject`, `PATCH .../proposals/:id` | **K** | Decision loop. |
| `POST /api/research`, `/pin`, `/propose` | **K** | Research server wire + pin note + propose lore proposal. |
| `POST /api/graph/proposals` | **D** first cut (optional later) | Relationship edge proposals tied to graph UX. |
| Chapter routes (`/api/chapters/*`, apply) | **D** | Manuscript. |
| `POST /api/chat` | **D** first cut | Agent dashboard chat/sheet-pack/lab-spark. Sheet-pack→proposal idea may be reborn simpler later. |
| `POST /api/continuity/:chapterId` | **D** first cut | Manuscript continuity. |
| `POST /api/cowrite`, `POST /api/review/:chapterId` | **D** | Draft/review surfaces later. |
| All `/api/lab/*` | **D** | Lab. |
| `http.ts` monolith router | **R** | Keep pattern; strip dropped routes; add import when #10 lands. |

### Research / LLM runners

| Module | Verdict | Why |
| --- | --- | --- |
| `src/research/run.ts` — `runResearch` | **K** | Fixture/live research completion. |
| `src/research/run.ts` — `researchProposal` | **P/R** | Keep propose-from-research idea; always forces `sheetKind: 'lore'` + key `research_note` + fake chapter span `chapterId: 'research'`. Rewrite for character/lore target Card + fact-filter (#8). |
| `src/research/types.ts` | **K** | Thin result DTO. |
| `src/agent/*` | **D** first cut | Chat agent + sheet packs + lab drafts — dashboard complexity. |
| `src/continuity/*` | **D** first cut | Chapter claim extract; live path is primary **event-fact spam** vector (prompt asks for event/existence/world/org). |
| `src/cowrite/*`, `src/review/*` | **D** | Manuscript AI. |

### Export

| Module | Verdict | Why |
| --- | --- | --- |
| `src/export/markdown.ts` | **P/R** | Keep bible/`kind`/`name` fact dump idea. Drop chapters/*.md for first cut export or make optional. Align format with #10. |
| Import (any module) | **R (new)** | **No `/api/import` on dev.** Need round-trip for local wiki safety. |

### Features / UI

| Module | Verdict | Why |
| --- | --- | --- |
| `components/ui/*` + `ui.css` | **K** | Liked primitive aesthetic. |
| `design/tokens.css`, `design/index.ts`, rail budget ideas | **K** | Single token source; new shell should consume tokens. |
| `features/project/SheetEditor.tsx` | **R** | Fact CRUD + identity dirty/draft are good bones; rewrite as Card editor with MC fixed sections + magic hub (not freeform kind dropdown of 4 kinds). Drop world/org options. |
| `sheetIdentityDirty.ts`, `sheetIdentityDraft.ts`, save chip helpers | **K** | Durable dirty identity patterns. |
| `features/project/api.ts` | **P** | Keep project/sheet/fact/proposal/research/export clients; delete lab/chat/cowrite/review/continuity/graph clients from first-cut surface. |
| `features/project/useProject.ts` | **P/R** | Keep load/switch/mutation generation patterns; drop chapter draft localStorage path. |
| `features/project/ProjectSwitcher.tsx` | **R** | Thin multi-book header switcher bone; simplify chrome per #14. |
| `features/research/ResearchPanel.tsx` | **R** | Keep query → results → pin/propose loop; re-home into research rail (not companion face). |
| `features/continuity/ProposalCard.tsx` | **K** | Accept/edit/reject UX bone. |
| `features/agent/*` (Apply/Review/SheetPack/useAgent/checkTools) | **D** | Agent dashboard. |
| `features/lab/*` | **D** | Lab. |
| `features/graph/*` + `src/graph/*` | **D** first cut | Canon map/network center; later optional. Relationship facts may remain data-capable without graph UI. |
| `components/shell/Shell.tsx` | **D/R** | Do not port three-mode manuscript\|graph\|lab shell. **New clean shell** (#9): research rail + center card + wiki list. Steal layout density/token usage only. |
| `AgentPanel.tsx` (+ faces chat/write/check/spark/fill/inspect/research/inbox) | **D** | Explicitly dropped agent dashboard complexity. Research face logic → ResearchPanel rewrite. |
| `Manuscript.tsx`, chapter list labeling | **D** | No manuscript surface. |
| `Binder.tsx` | **R** | Wiki list bone (sheets by kind); drop chapter/lab modes and world/org sections. |
| `useShellState.ts` dual-rail/drawer breakpoints | **P** | Keep responsive rail budget ideas; drop binder/agent region coupling to manuscript. |
| `workspace.ts` kind labels | **P** | character/lore only labels. |
| `App.tsx` → Shell | **R** | Point at new shell. |

### Tests

| Area | Verdict | Why |
| --- | --- | --- |
| Domain proposal/fact/fingerprint/identity tests | **K** | Lock bones when porting. |
| `server/llm.test.ts`, store-root, research tests | **K** | Wire confidence. |
| Lab/continuity/cowrite/review/agent/chapter shell tests | **D** first cut | Or quarantine; do not block dev2. |
| Export tests | **P** | Retarget wiki-only files. |

---

## Explicit drop list (do not re-litigate)

1. **Agent dashboard** — `AgentPanel`, multi-face companion, `useAgent`, chat/sheet-pack/lab-spark API.
2. **Lab** — domain `lab.ts`, all `/api/lab/*`, `LabBench`, promote-to-chapter.
3. **Manuscript shell** — `Manuscript`, chapters in Project, craft tags, cowrite/apply/review, continuity-on-chapter.
4. **World / organization kinds** — first-cut UI + validation allow-list + research/agent prompts.
5. **Event-fact spam paths** — continuity live extractor prompting `claimKind: event` (and free sheetKind world/org); any pipeline that floods proposals with scene beats without filter (#7).
6. **Migrating old `dev` sheet junk into `dev2`** — starts empty.
7. **Relationship graph as primary workspace** — drop center mode for first cut.

---

## Explicit keep list (reference bones)

1. **Sheet + Fact + Proposal** domain semantics and accept/reject (+ packs, rejectedFingerprints).
2. **LLM** — `server/llm.ts` / config / `hasLiveLlm`.
3. **Research** — `runResearch`, pin note, propose path, ResearchPanel loop.
4. **Project store** multi-id JSON + activate + list.
5. **Export** zip of markdown bible files (reshape).
6. **UI primitives + design tokens** (liked aesthetic).
7. **ProposalCard** decision UX.
8. **Sheet/fact HTTP + client** CRUD.
9. **Fingerprint + identity text** helpers.
10. **ProjectSwitcher** multi-book idea (thin header).

---

## Rewrite targets (new on dev2, steal ideas)

| Target | Steal from | New work |
| --- | --- | --- |
| Clean shell | Shell density, rails, tokens, drawers | Research rail + center Card + wiki list (#9) |
| Card editor | SheetEditor fact list, dirty identity | MC fixed sections; magic hub + child pieces; UI word Card |
| Research → propose-on-card | ResearchPanel + `researchProposal` | Character/lore targeting; richer than single `research_note` attribute (#8) |
| Fact filter | lint confidence gate idea only | Scene beat vs permanent change rules (#7) — not chapter span lint |
| Multi-book header | ProjectSwitcher + projects API | Thin header data shape (#14) |
| Import | Export zip/markdown | Round-trip format (#10) |
| Empty seed | — | No default chapter/lab; empty character/lore wiki |

---

## Gaps / not on `dev` (must invent on dev2)

| Gap | Notes |
| --- | --- |
| Magic hub + child pieces model | No first-class type; only freeform facts/hints on sheets |
| MC fixed sections template | SheetEditor is generic key/value facts + hints |
| Import API / UI | Export only today |
| In-app web search provider | Research is LLM JSON + citations, not browse tool (#11) |
| Fact-filter policy | No dedicated filter; continuity dumps claims including events |
| UI glossary Card vs sheet | Product says Card; code says Sheet — rename at surface |

---

## Suggested port order for implement sessions

1. Trimmed domain Project/Sheet/Fact/Proposal (+ fingerprint, identity) — character/lore only.
2. Store + projects API + empty seed.
3. LLM + research routes + accept/reject.
4. UI tokens/primitives + new shell scaffold.
5. Card editor + wiki list + ProposalCard.
6. Research rail wired to propose-on-card.
7. Export reshape + import (#10).
8. Multi-book header polish (#14).

Do **not** start from `Shell.tsx`/`AgentPanel.tsx`/`LabBench.tsx` as the architectural base.

---

## Source map (high-signal paths)

```
src/domain/{types,project,proposals,fingerprint,identityText,lint,apply,lab}.ts
src/server/{http,llm,llmConfig,store,validation,zip,index}.ts
src/llm/types.ts
src/research/{run,types}.ts
src/agent/*  src/continuity/*  src/cowrite/*  src/review/*
src/export/markdown.ts
src/features/{project,research,continuity,agent,lab,graph}/*
src/components/{ui,shell}/*
src/design/*
src/graph/*
```

## API inventory (`dev` `http.ts`)

| Method | Path | dev2 first cut |
| --- | --- | --- |
| GET/POST | `/api/projects` | Keep |
| POST | `/api/projects/:id/activate` | Keep |
| GET/PUT | `/api/project` | Keep |
| GET | `/api/export` | Keep (reshape body) |
| PUT | `/api/sheets/:id` | Keep |
| PUT/DELETE | `/api/sheets/:id/facts/:id` | Keep |
| POST | `/api/proposals/:id/accept\|reject` | Keep |
| PATCH | `/api/proposals/:id` | Keep |
| POST | `/api/research`, `/pin`, `/propose` | Keep (+ rewrite propose payload) |
| PUT/PATCH | `/api/chapters/*` | Drop |
| POST | `/api/chapters/:id/apply` | Drop |
| POST | `/api/chat`, `/continuity/*`, `/cowrite`, `/review/*` | Drop |
| POST | `/api/graph/proposals` | Drop first cut |
| * | `/api/lab/*` | Drop |
| — | `/api/import` | **Add** (new) |

---

## Resolution

This table is the scope lock for implement sessions: **reuse domain/server research+canon bones; new shell; no agent/lab/manuscript/world-org/event-spam first cut.** Downstream #15 should cite this file rather than re-open keep/drop.
