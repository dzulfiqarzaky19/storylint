# Steal matrix & phases

## Steal / leave

| Source | Steal | Leave |
|--------|--------|--------|
| **VS Code + Claude / Cursor** | Agent panel, project context, tool runs, apply/accept, clean editor | Code-only metaphors in UI copy |
| **Obsidian** | Local ownership, focus, plain-data export path | DIY-only empty shell |
| **Novelcrafter** | Codex/sheets, scene/chapter structure, char context while working | Permanent dense dual sidebars as only mode; gen-suite identity |
| **Sudowrite** | Co-write / brainstorm *skills* | Gen cockpit embedded in manuscript chrome |
| **Calliope** | Continuity seriousness; human owns final prose by default | Banning co-write as product ideology |
| **Fictionary / AutoCrit** | On-demand deep review mindset | Permanent nag chrome while drafting |
| **Milanote / Craft / UpNote** | Visual bible / atmosphere later | Replacing the IDE editor as home |
| **Dabble / Novlr / Ellipsus** | Habit-friendly novel UX, calm type | Missing agent+canon depth |
| **Reedsy / Atticus** | Export quality as later exit | Format-as-identity |
| **Speare** | — | Forced block-first methodology for freewriters |

## Category gaps we claim

| Gap | Typical tools | Storylint |
|-----|---------------|-----------|
| IDE + novel agent | Split across apps | One workspace |
| Prose ↔ bible sync | Manual | Extract + accept |
| Continuity diagnostics | Late / human | Y/R marks on run |
| Co-write without wrecking editor | Cockpit or external tab | Agent panel + Apply |
| E2E story review bound to sheets | Generic LLM chat | Project-aware review agents (P2) |
| Research into canon safely | Copy-paste chaos | Cited proposals (P3) |
| Local / no-account dogfood | SaaS walls | You first, no login |

## Phases

### P1 — Continuity IDE (MVP build)

**Ships:**

- Local project: chapters + sheets (character, lore, world, organization)  
- Clean manuscript editor  
- Binder (collapsible)  
- **Agent panel shell** (chat UI + run entry points) — required IA  
- Continuity tool: extract → gates → marks + proposals  
- Manual sheet/fact CRUD  
- **Agent “create/fill sheet with me”** → proposal packs → Accept  
- Light **newbie recommendations** in agent (on request / empty state)  
- Accept / Edit / Reject for bible  
- OpenAI-compatible router through server-only `LLM_*` config; no app auth  
- Domain unit tests for gates + accept  
- Facts model allows `relationship` statements early (graph-ready later)  

**Steal emphasis:** VS Code agent shape, Obsidian calm editor, Novelcrafter codex concepts, Calliope continuity seriousness.

### P1b — Co-write apply

**Ships:**

- Agent skills: continue, rewrite, brainstorm beats  
- Output stays in panel until user **Apply** to manuscript (diff/snippet preview)  
- Optional: use bible + chapter context automatically  

**Steal:** Sudowrite capabilities relocated into IDE agent panel.

### P1.5 / P2a — Sheet richness

**Ships:**

- **Portrait / icon** on character (and optional org/place) sheets  
- Richer lore-informed **suggested fields** (agent or soft template chips) — still freeform facts underneath  
- Sheet depth coach in review-ish prompts  

### P2 — Review agents + craft tags

**Ships:**

- On-demand Review runs: plot sense, pacing holes, culture/world logic  
- Findings for things **not yet on sheets** → report + optional sheet proposals  
- **Craft tags** on chapters (manual + agent-suggest Accept)  
- **Chapter craft check**: “before you close this chapter” gaps (char-dev, plot move, twist, etc.) in agent panel  
- Still Accept-gated for canon; no silent bible write  
- Craft findings ≠ continuity red marks  

**Steal:** Fictionary/AutoCrit *when* (deliberate review), IDE diagnostics list UX — **not** their always-on shame chrome.

### P3 — Research panel + depth

**Ships:**

- **Research panel**: clean, powerful, cited, pin/propose — not chat spaghetti  
- Research agent: other books, legend/lore motifs, world analogues  
- Export MD folder; richer bible UX  
- Relationship **edge** proposals feeding future graph  

### P4 — Canvas / graph

**Ships:**

- Obsidian-like **graph/canvas**: who is his father, what org, rivals, places  
- Node portraits; filter by kind; open sheet from node  
- Edge edit ↔ fact Accept  

**Steal:** Obsidian graph *navigation* only ([REFERENCES](./design/REFERENCES.md)); skin = TOKENS.

## Never ship into core chrome

- Auto-type agent prose into the manuscript  
- Auto-accept bible facts  
- Permanent upgrade / brand scream strips  
- Forced plotting methodology on empty project  
- Format factory as home screen  
- Research auto-merged into canon without citations + Accept  
- Graph as P1 blocker (domain only stays graph-ready)

## Build order reminder

**P1 (0–D), Apply (E), portraits/tags (F), Review (G), and Research (H) are shipped in-tree.** Next roadmap slice is I (graph), not started.
Live status: [BUILD.md](./BUILD.md). Do not rebuild shipped slices.
