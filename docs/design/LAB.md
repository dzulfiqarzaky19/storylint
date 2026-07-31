# Lab — pre-canon create & experiment

**Status:** built (shipped on `storylint/lab-slice`)  
**Slice id:** **L** (after K)  
**Host:** center workspace mode (same slot as Manuscript / Graph)  
**Paint:** Kobo paper tokens only — scratch desk, not neon “ideas AI”

---

## Problem

Storylint already has strong paths to **improve** what exists:

| Surface | Job today |
|---------|-----------|
| Sheets (binder) | Edit canon character / lore / world / org |
| Proposals | Accept-gated adds to sheets |
| Agent | Flesh out, review, co-write **against** project truth |
| Continuity | Stress draft vs bible |
| Research | Cited **outside** material |
| Graph | Map **accepted** relationships |

Missing: a place to **create and experiment** before something is real.

Authors need to try a new plot fork, a city, a magic rule, or three versions of a character **without**:

- opening a fake chapter  
- polluting sheets (false canon)  
- triggering continuity against half-baked vibes  
- dumping mess into Research (not citations) or Graph (not edges)

---

## Product one-liner

**Lab** = pre-canon sandbox.  
Mess is allowed. **Nothing is true** until Promote → existing Accept / Apply paths.

```
idea ──▶ Lab card ──▶ Promote ──▶ proposal / chapter stub ──▶ Accept/Apply ──▶ canon or draft
              │
              └── archive / pin (still not canon)
```

---

## Truth levels (lock this)

| Level | Surfaces | Continuity? | Graph? |
|-------|----------|-------------|--------|
| **Canon** | Sheets + accepted facts | Yes | Yes |
| **Draft** | Chapters | Yes (on run) | No |
| **Cited** | Research pins | No | No |
| **Lab** | Boards + cards | **No** | **No** |

Agent may read Lab for context when user @lab.  
Agent must **not** treat Lab text as bible or as manuscript.

---

## Jobs-to-be-done

1. **Create** a character / place / lore spark before a sheet exists  
2. **Experiment** on plot beats and what-ifs without a chapter  
3. Hold **multiple options** (A/B/C) and pin favorites  
4. **Promote** one option into the real system (sheet proposal or outline/chapter stub)  
5. Keep manuscript clean (no gen chips, no shame chrome)

---

## Non-goals (v1)

- Infinite canvas / Figma-like freeform  
- Auto-run Continuity on Lab cards  
- Lab cards as graph nodes/edges  
- Forced plot methodology wizard (Save the Cat, etc.)  
- Unattended “generate 40 twists” cockpit  
- Collab / sync  
- Replacing Research or Sheets

---

## IA

### Entry

- Binder footer / section: **Lab** (always present)  
- Top bar workspace toggle: `Editor · Graph · Lab` (Graph already uses this pattern)  
- Focus mode: Lab hidden with other chrome (manuscript-only remains sacred)

### Layout

```
┌ binder ────────┬──────── Lab (center) ─────────────┬ agent ─────┐
│ Chapters       │ Board: Act 2 forks                │ chat       │
│ Sheets…        │ [+ Card]  filter kinds · pins     │ “brainstorm│
│ ─────────      │                                   │  3 places” │
│ Lab            │ ┌ card ┐ ┌ card ┐ ┌ card ┐        │ → cards    │
│  · boards      │ │beat  │ │place │ │what-if│       │   in Lab   │
│                │ │ …    │ │ …    │ │ …    │        │            │
│                │ └──────┘ └──────┘ └──────┘        │ [Promote]  │
└────────────────┴───────────────────────────────────┴────────────┘
```

Narrow: Lab is center full-width; binder/agent drawers unchanged.

### Empty state

Title: **Nothing on the bench**  
Hint: Try a place, a beat, or a what-if. Nothing here is canon until you promote.  
Actions: `New card` · `Ask agent to brainstorm…` (opens agent with Lab intent)

---

## Domain (v1)

Persist on the project (same `project.json`, **schemaVersion bump** when implemented).

```ts
type LabCardKind =
  | 'beat'            // plot step / scene seed
  | 'place'           // location / setting seed
  | 'character-spark' // person before sheet
  | 'lore-spark'      // rule, artifact, culture scrap
  | 'what-if'         // fork / hypothetical
  | 'question'        // open problem for later
  | 'motif'           // image, theme, refrain

type LabCardStatus = 'active' | 'pinned' | 'promoted' | 'archived'

type LabCard = {
  id: string
  boardId: string
  kind: LabCardKind
  title: string
  body: string
  status: LabCardStatus
  // soft hints only — never graph edges, never facts
  touches?: { sheetId?: string; chapterId?: string }
  // set when promoted; card stays as breadcrumb unless archived
  promoted?: {
    at: string // ISO
    as: 'sheet-proposal' | 'chapter-stub'
    targetIds?: string[] // proposal ids / chapter ids
  }
  createdAt: string
  updatedAt: string
}

type LabBoard = {
  id: string
  title: string
  cardIds: string[] // order
}

type Lab = {
  boards: LabBoard[]
  cards: LabCard[]
}
```

**Defaults on new project:** one board `"Bench"`, zero cards.

**Rules**

- Delete = archive (status), not hard-wipe (dogfood undo)  
- Pin ≤ **5** `pinned` cards highlighted at top of board (soft cap, not error)  
- `promoted` cards default to collapsed “Promoted” tray so the bench stays for live mess

---

## Promote paths (the product)

| Card kind | Promote target | Mechanism |
|-----------|----------------|-----------|
| `character-spark` | Character **sheet proposal** pack | Existing proposal Accept flow |
| `place` / `lore-spark` | Sheet proposal (`world` / `lore` / `organization` as user picks) | Same |
| `beat` (single) | Optional **chapter stub** (title + empty body) or stay outline-only in Lab | `saveChapter`-class API |
| `beat` (ordered pins) | v1: ordered list copy / multi-stub; v1.5 outline strip | Don’t block v1 |
| `what-if` / `question` / `motif` | **No auto sheet** — duplicate-as or stay in Lab | Promote disabled or “clone to card kind…” |

Promote always:

1. User clicks **Promote** on a card (or agent offers Promote card actions)  
2. Preview of what will be created (sheet fields / chapter title)  
3. Confirm → creates **proposal or stub**, never silent canon  
4. Card → `promoted` with pointer back

Manuscript Apply remains separate (co-write). Lab does not paste prose into the chapter without Apply.

---

## Agent (Lab-aware)

| Intent | Result |
|--------|--------|
| “Brainstorm 3 places for the siege” | 3 `place` cards on current board |
| “Spark a rival for Kael” | 1 `character-spark` (may soft-touch Kael sheet id) |
| “Fork: what if the treaty fails?” | 1+ `what-if` cards |
| “Develop this card” | Edits **card body** in Lab (not sheet) |
| “Promote this to a sheet” | Same as UI Promote → proposals |

Context chips: `@lab`, `@lab-card`, optional board name.  
Continuity tool: **ignores** Lab.  
Graph: **ignores** Lab.

Newbie tip (dismissible): “Create in Lab first if you’re not ready for the bible.”

---

## UI components (reuse)

| Need | Use |
|------|-----|
| Cards | `surface-raised` + border; kind `Badge` |
| Lists / select board | existing `ListRow` / buttons |
| Empty | `EmptyState` + primary action |
| Promote confirm | light dialog or agent-style tool card (no new modal system if avoidable) |
| Kind filter | chip row like graph filters |
| Icons | monochrome SVG, `currentColor` |

**Skin notes**

- Center background: `color.canvas` with cards on `color.surface` / raised (desk with scraps), **not** manuscript paper  
- Dashed border on empty drop / new card affordance  
- No mark-yellow/red on Lab (those = continuity only)  
- Motion: existing tokens; reduced-motion respected

---

## Shell wiring

| Concern | Choice |
|---------|--------|
| State | `workspaceMode: 'manuscript' \| 'graph' \| 'lab'` |
| Binder | Lab section lists boards; click opens Lab mode + board |
| Deep link | optional `requestedLabCardId` (mirror sheet request from graph) |
| Persistence | project field `lab`; API get/patch with rest of project |
| Export | v1: omit Lab from markdown export **or** appendix “Lab (non-canon)” — default **omit** |

---

## Acceptance (slice L done)

- [x] New project has Lab board “Bench”  
- [x] Create / edit / archive card; reload persists  
- [x] Kinds selectable; pin highlights; soft cap doesn’t block  
- [x] Workspace toggle Editor · Graph · Lab works; Focus hides Lab  
- [x] Empty state has New card + path to agent  
- [x] Promote `character-spark` → pending sheet proposal(s); Accept updates bible; Lab card marked promoted  
- [x] Promote does **not** write sheets without Accept  
- [x] Continuity run does not read Lab body as canon  
- [x] Graph does not show Lab cards as nodes  
- [x] Agent brainstorm lands cards in Lab only (fixture path)  
- [x] Unit tests: promote boundary (+ `labBodies` helper; continuity inputs are chapter-only)  
- [x] Tokens only; no new hex  
- [x] E2E smoke: open Lab, add card, screenshot `e2e/output/slice-l-lab.png`

---

## Build order (when coding)

1. **Domain + persist** (`Lab` on project, schema bump, tests)  
2. **API** read/write cards/boards  
3. **UI** Lab center + binder entry + empty/cards  
4. **Promote → proposal** (reuse accept pipeline)  
5. **Agent** brainstorm → cards (fixture)  
6. **E2E** smoke  

Test-first for promote boundary and “continuity ignores lab.”

---

## Open choices (decide at implement)

| Topic | Default if undecided |
|-------|----------------------|
| Board count | Multi-board v1 (simple list); start with 1 |
| Chapter stub promote | In v1 for single `beat` |
| Export Lab | Omit |
| Name in UI | **Lab** (not Workshop/Scratch) |
| Agent auto-promote | Never |

---

## Doc links

- IA doctrine: [../03-ux.md](../03-ux.md)  
- Tokens: [TOKENS.md](./TOKENS.md)  
- Build queue: [../BUILD.md](../BUILD.md)  
- PRD gap this fills: create/experiment before canon (sheets = improve)
