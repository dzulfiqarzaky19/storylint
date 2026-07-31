# Storylint — detailed IA map (locked)

**Status:** locked product map (target language + current wiring)  
**Depends on:** [PRD.md](./PRD.md) · [03-ux.md](./03-ux.md) journeys · [PERSONAS.md](./PERSONAS.md) · [design/LAB.md](./design/LAB.md)  
**Research pack:** [research/ui-ux](./research/ui-ux/README.md)
**Not:** a fourth ecosystem, new panels, or depth > 3

---

## 0. How to read this

| Mark | Meaning |
|------|---------|
| **ships** | Behavior exists in app today |
| **partial** | Behavior exists; name, entry, or chrome wrong |
| **missing** | Target behavior not built yet |
| **rename** | Same thing; user-facing word should change |

This map is the **detailed locked architecture**. Journeys (J1–J3) are the paths through it.  
UI work after this = align chrome to the map, not invent new kingdoms.

## Build status (refresh)

| Step | Item | Status | Evidence |
|------|------|--------|----------|
| 1 | Naming + entry (Draft, Promote split, two doors, binder groups) | **done** | `67592a1` `b68703e` `6a2a74b` |
| 2 | Calm top bar + Continuity Draft-only | **done** | `55b9033` `6a2a74b` |
| 3 | Canon entry + landing memory | **done** | `5bfe65e` |
| 4 | Surface density polish | **open** (optional) | user call |

Final walkthrough QA: `e2e/output/ia-final-qa.md` — **PASS 14/14** @ `6a2a74b`.


---

## 1. Three ecosystems (only)

| Ecosystem | User word | Feeling | Current code names | Status |
|-----------|-----------|---------|--------------------|--------|
| **Lab** | Lab | Messy think / research / try | `workspaceMode: 'lab'`, LabBench, binder Lab boards | **ships** |
| **Draft** | Draft | Clean write | `workspaceMode: 'manuscript'`, Manuscript, binder chapters | **ships** + **rename** (UI still says manuscript / Write) |
| **Canon** | Canon | Settled world truth | Sheets + facts + accepted proposals + Graph | **ships** + **rename** (UI still says sheets / bible / Graph as peer mode) |

**Not ecosystems (never promote them to top kingdoms):**

| Thing | Role | Home |
|-------|------|------|
| Companion / Agent | Help across all three | Right rail / drawer |
| Research | Cited gather tool | Companion face (Lab-leaning) |
| Continuity / Review / Craft | Draft checks | Companion **Check** only (no top-bar button) |
| Apply / Accept / Reject | Gates | Inbox + cards |
| Project switch / Export | Library ops | Project switcher |
| Focus / Theme / Reading | Comfort chrome | Top bar / paper |
| Multi-project | Library | Project switcher |

---

## 2. Depth law (hard)

```
Level 1 — Home (open app / active project)
Level 2 — Ecosystem (Lab | Draft | Canon)
Level 3 — Thing (chapter, board/card, sheet, graph view)
```

**Forbidden:** hubs inside hubs, settings mazes, “more tools” as a fourth place, Research/Graph/Review as equal permanent kingdoms beside Lab/Draft/Canon.

Examples that stay legal:

| Path | Depth |
|------|-------|
| Home → Draft → Chapter 3 | 3 |
| Home → Lab → Board “Cities” | 3 |
| Home → Canon → Sheet “Kael” | 3 |
| Home → Canon → Graph (map of canon) | 3 |

Illegal:

| Path | Why |
|------|-----|
| Home → Tools → Research → Sources → Pin folders → … | depth / extra kingdom |
| Home → Graph → Filters → Advanced → … as primary job | graph is Canon tool, not a dig site |

Companion faces are **modes of help**, not Level-2 places.

**Ruling — depth counts navigation steps, not screen regions.** A sheet opened in the binder detail stack is still the Level-3 Canon thing (Home → Canon → Sheet Kael = depth 3). No separate center sheet surface is required.

---

## 3. Shell skeleton (one frame)

```
┌─ top bar (global chrome) ─────────────────────────────────────────┐
├─ binder (left) ─┬─ center workspace ─┬─ companion (right) ────────┤
│  Level-3 lists  │  Lab | Draft |     │  faces by context          │
│  by ecosystem   │  Canon surface     │  not a fourth ecosystem    │
└─────────────────┴────────────────────┴────────────────────────────┘
```

| Region | Job | Focus mode |
|--------|-----|------------|
| Top bar | Project identity, ecosystem switch, rare global actions | Minimal / hide nonessentials |
| Binder | Navigate Level-3 things | Hidden |
| Center | The work surface | Full width paper / bench / map |
| Companion | Help + gates | Hidden |

**ships:** binder + center + agent + focus  
**ships (steps 1–3):** calm top bar; Draft · Lab · Canon switch; Canon map entry  
**open:** step 4 surface density polish

---

## 4. Center workspace map

Only **one** center surface at a time. (Canon sheet is a Level-3 thing in the binder detail stack, not a center surface — see §2 ruling.)

| Target surface | Ecosystem | Current | Primary content | Status |
|----------------|-----------|---------|-----------------|--------|
| Draft page | Draft | Manuscript (user: Draft) | Chapter title + body + marks + reading | **ships** |
| Lab bench | Lab | LabBench | Boards + cards + promote | **ships** |
| Canon map | Canon | RelationshipGraph under Canon entry | Network / family of **accepted** links | **ships** |

### 4.1 Draft (center)

**In**

- Chapter title + body (textarea + mark overlay)
- Continuity marks (Y/R) on spans
- Reading profile control on paper (Day/Sepia/Mint/Night)
- Word/char comfort (non-blocking)
- Craft tags: available, collapse on narrow (**ships** after S4)

**Out of Draft chrome**

- Gen chips in the type column
- Research full panel as permanent Draft chrome
- Graph filters
- Lab card editors

**Companion context when Draft center:** `writing`  
Faces: Chat · Write · Check · Research · Inbox

### 4.2 Lab (center)

**In**

- Boards (Level-3)
- Cards: beat, place, character-spark, lore-spark, what-if, question, motif
- Pin / edit / archive
- Promote (gated exits)
- Agent Spark presets → cards only

**Out**

- Continuity against Lab text (**ships** as out — do not add)
- Graph nodes from unaccepted Lab
- Silent sheet/chapter writes

**Exits (only two product exits)**

| Exit | Target | Current behavior | Status |
|------|--------|------------------|--------|
| **Send to Draft** | chapter stub in Draft | beat → chapter-stub; jumps to Draft | **ships** |
| **Promote to Canon** | pending sheet proposal → Accept | stays Lab; Accept in Inbox | **ships** |

**Ruling — post-exit navigation:** **Send to Draft** jumps to the new stub in Draft. **Promote to Canon** stays in Lab; Accept happens via Inbox.

**Companion context when Lab center:** `lab`  
Faces: Chat · Spark · Inbox

### 4.3 Canon map (center)

**In**

- Network + Family views of **accepted** relationships
- Kind filters (enums `character`/`lore`/`world`/`organization`; **labels** Characters/Lore/World/Organizations per [design/CANON-VOCABULARY.md](./design/CANON-VOCABULARY.md) — binder uses labels; graph chips must not stay raw enums)
- Node → open sheet (Level-3 Canon thing)
- Pending edges hidden until Accept (**ships**)

**Out**

- Lab mess
- Draft prose editing

**Companion context:** `graph`  
Faces: Chat · Inspect · Inbox

**IA note:** Graph is **Canon’s map**, not ecosystem #4. Top-level control should eventually sit under Canon entry, not equal “product mode” forever. **partial**

### 4.4 Canon sheet (binder detail stack)

**Where:** binder detail stack (per §2 ruling), not a center surface.

**In**

- Sheet kinds: character, lore, world, organization
- Facts manual edit
- Portrait/icon
- Pending proposals for that world truth via Inbox/Accept

**Companion context when editing sheet:** `details`  
Faces: Chat · Fill · Research · Inbox

---

## 5. Binder map (left)

Binder contents **reshape by ecosystem**, same rail (depth stays 3).

| When center is | Binder shows | Actions |
|----------------|--------------|---------|
| Draft | Chapters list · (Canon sheets still reachable, secondary) | Select chapter, add chapter, open sheet |
| Lab | Lab boards + cards entry · Open Lab | Select board, open Lab |
| Canon map / sheet | Sheets by kind · chapters secondary | Open sheet, kinds |

**ships:** chapters, sheets by kind, Lab section, open Lab, **Draft / Lab / Canon** group labels

---

## 6. Top bar map (global)

### 6.1 Always allowed (calm set)

| Control | Job | Status |
|---------|-----|--------|
| Binder toggle | Open navigation | **ships** |
| Project switcher | Switch/create project | **ships** |
| Save status | Saving… / Saved | **ships** |
| Ecosystem switch | Draft · Lab · Canon | **ships** |
| Focus | Hide rails | **ships** |
| Theme | Chrome only | **ships** |
| Companion toggle | Show agent | **ships** |

### 6.2 Conditional / demote

| Control | When | Target treatment | Status |
|---------|------|------------------|--------|
| Continuity | never in top bar | **Ruling (user, final):** Continuity is a verb, not an ecosystem — it never sits beside Draft·Lab·Canon. Companion **Check** is the sole entry point | **removed from top bar** |
| Export / New project | Rare | Overflow under project switcher | **ships** |
| Duplicate project title (h1 + switcher) | Never | Single identity | **ships** |

### 6.3 Target ecosystem switch labels

| Target | Current button | Notes |
|--------|----------------|-------|
| **Draft** | Draft (was Write) | Default center |
| **Lab** | Lab | Keep word Lab |
| **Canon** | Canon (was Graph peer) | Map-first, then last Canon thing |

**Ruling — Canon landing:** the single **Canon** entry lands on the **map** on first visit, then on the **last-opened Canon thing** (sheet or map). Map is one Canon view, never a peer mode. **ships.**

---

## 7. Companion map (right) — not Level 2

### 7.1 Faces by context

| Context | When | Faces | Status |
|---------|------|-------|--------|
| writing | Draft center | Chat, Write, Check, Research, Inbox | **ships** |
| lab | Lab center | Chat, Spark, Inbox | **ships** |
| details | Sheet edit | Chat, Fill, Research, Inbox | **ships** |
| graph | Canon map | Chat, Inspect, Inbox | **ships** |

**Ruling — details trigger:** `details` context activates while a sheet is open for edit (including from the binder stack); closing the sheet returns the companion to the center context.

### 7.2 Face jobs

| Face | Job | Gates |
|------|-----|-------|
| Chat | Freeform project chat | none auto-write |
| Write | Continue / Rewrite / Brainstorm | **Apply** card only |
| Check | Continuity, Review, Craft | marks + proposals; tags explicit |
| Spark | Lab brainstorm presets | Lab cards only |
| Fill | Sheet help | proposal packs → Accept |
| Research | Cited cards | Pin note / Propose; Accept=canon |
| Inspect | Graph-oriented help | no silent edges |
| Inbox | Pending proposals + Apply cards | Accept/Edit/Reject · Apply/Dismiss |

### 7.3 Research placement (locked)

- Research is a **Companion face**, primarily for Lab-ish gather and Canon fill — **not** ecosystem #4.
- **ships** as agent face; do not add top-bar Research kingdom.

---

## 8. Gates (sacred)

| Gate | From | Into | Status |
|------|------|------|--------|
| **Apply** | Companion Write cards | Draft chapter body | **ships** |
| **Accept** | Proposals (continuity, sheet pack, Lab promote, research propose) | Canon sheets/facts | **ships** |
| **Edit proposal** | Inbox | Canon after edit | **ships** |
| **Reject / Dismiss** | Inbox / cards | nowhere | **ships** |
| **Promote** | Lab card | Draft stub **or** Canon proposal | **ships** + **rename** exits |

Nothing silent-writes Draft body or Canon truth.

---

## 9. Journey × surface matrix

### J1 — Already know the story → write

| Step | Ecosystem | Center | Binder | Companion | Chrome | Status |
|------|-----------|--------|--------|-----------|--------|--------|
| 1 Open project | Home | — | — | — | Project switcher | **ships** |
| 2 Land last chapter | Draft | Draft page | Chapters | optional | Draft selected | **ships** |
| 3 Type → Saved | Draft | page | optional | hidden/Focus ok | Saved | **ships** |
| 4 Optional Focus | Draft | page only | off | off | Focus on | **ships** |

**Must not require:** Lab, Graph, Research, Review.

### J2 — Still finding story → Lab → promote

| Step | Ecosystem | Center | Binder | Companion | Status |
|------|-----------|--------|--------|-----------|--------|
| 1 Open/create project | Home | — | — | — | **ships** |
| 2 Start in Lab | Lab | LabBench | boards | Spark/Chat | **ships** |
| 3 Messy cards | Lab | cards | boards | Spark | **ships** |
| 4a Send to Draft | Lab→Draft | after promote stub | chapters | Inbox if needed | **ships** |
| 4b Promote to Canon | Lab→Canon | stays Lab; Inbox Accept | sheets | Inbox | **ships** |
| 5 Later return Draft | Draft | chapter | chapters | writing faces | **ships** |

### J3 — Continuity pass

| Step | Ecosystem | Center | Companion | Status |
|------|-----------|--------|-----------|--------|
| 1 Open chapter | Draft | Manuscript | — | **ships** |
| 2 Run Continuity | Draft | marks appear | Companion **Check** | **ships** |
| 3 Read Y/R marks | Draft | overlay | summary card | **ships** |
| 4 Accept/Edit/Reject | Canon gate | — | Inbox / proposal cards | **ships** |
| 5 Optional Canon context | Canon | sheet or map | Fill/Inspect | **ships** |

**Must not:** auto-write bible; force Graph.

---

## 10. Empty project entry (target)

| Choice | Lands | Status |
|--------|-------|--------|
| **Write** (Draft) | New/first chapter | **ships** |
| **Start in Lab** | Lab bench | **ships** |

No wizard. Two doors max.

---

## 11. Naming alignment backlog (not new features)

| Current UI word | Locked word | Status |
|-----------------|-------------|--------|
| Write (mode) | **Draft** | **done** |
| Manuscript (user-facing) | **Draft** | **done** (code may still say manuscript) |
| Sheets / bible (mixed) | **Canon** in nav; “sheet” inside Canon | **done** (nav) |
| Graph (top mode) | under **Canon** (Map) | **done** |
| Promote (both exits) | **Send to Draft** / **Promote to Canon** | **done** |
| Companion faces | keep | keep |
| Lab | Lab | keep |
| Binder sections | **Draft / Lab / Canon** group labels | **done** |

---

## 12. Chrome density rules (from journeys)

1. **Default calm:** identity · ecosystem switch · save · focus · companion  
2. **Job tools** appear inside the journey (Check when drafting, Spark in Lab, Inspect on map)  
3. **Equal top weight forbidden** for Continuity · Export · Research · Review · Graph filters · New  
4. **Focus** always returns J1 purity  
5. If a control isn’t needed on J1/J2/J3, it doesn’t earn a permanent top slot  

---

## 13. What we will not add

- Fourth ecosystem  
- Nested hub IA  
- Always-on gen cockpit in Draft  
- Silent Accept/Apply  
- Research or Graph as peer products to Lab/Draft/Canon  
- Depth-4 “dig to understand the app” flows  

---

## 14. Implementation inventory (anchor to code)

| Area | Path |
|------|------|
| Shell / modes | `src/components/shell/Shell.tsx` (`manuscript` \| `graph` \| `lab`) |
| Visibility / Focus | `src/components/shell/useShellState.ts` |
| Draft page | `src/components/shell/Manuscript.tsx` |
| Binder | `src/components/shell/Binder.tsx` |
| Companion | `src/components/shell/AgentPanel.tsx` |
| Lab | `src/features/lab/LabBench.tsx`, `src/domain/lab.ts` |
| Canon map | `src/features/graph/RelationshipGraph.tsx` |
| Canon sheet | `src/features/project/SheetEditor.tsx` |
| Research | `src/features/research/ResearchPanel.tsx` |
| Gates | proposals + Apply cards + promote APIs in `useProject` / domain |

---

## 15. Build order

| # | Item | Status |
|---|------|--------|
| 1 | **Naming + entry** — Draft label, Promote split, two doors, binder groups | **done** @ `67592a1` `b68703e` `6a2a74b` |
| 2 | **Calm top bar** — single identity, overflow New/Export, Continuity Draft-only | **done** @ `55b9033` `6a2a74b` |
| 3 | **Canon entry** — map-first landing + last-thing memory | **done** @ `5bfe65e` |
| 4 | **Surface density polish** | **open** — optional; user call |

QA: `e2e/output/ia-final-qa.md` **PASS 14/14**. No new panels.

---

## 16. One-line lock

**Home → (Lab | Draft | Canon) → thing; companion helps; Apply/Accept gates truth; max depth 3.**
