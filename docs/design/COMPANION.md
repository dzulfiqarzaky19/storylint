# Companion — mode-shaped right rail

**Status:** design (not built)  
**Pairs with:** [LAB.md](./LAB.md) · [../03-ux.md](../03-ux.md)  
**Problem today:** one Agent panel stacks Continuity + privacy essay + proposals + chat + Review/Craft + co-write + Research tab. Same face everywhere → cognitive overload.

---

## Principle

**Same agent brain. Different face per job.**

KISS: user should see **one job** in the right rail. Layout follows **where they are** (center context) and **what they’re doing** (optional sub-mode). Not a permanent toolbox of every skill.

```
Center context ──▶ default Companion face ──▶ user may switch sub-mode
```

---

## Two axes

| Axis | Values | Who sets |
|------|--------|----------|
| **Context** (center) | `writing` · `lab` · `details` · `graph` · (+ `research` focus) | Workspace / binder selection |
| **Face** (rail sub-mode) | depends on context; always ≤4 choices | User; resets to context default on context change |

Changing center **resets** face to that context’s default (no leftover Co-write chrome while staring at a sheet).

---

## Contexts → default faces

### 1. Writing (`workspaceMode = manuscript`, chapter open)

**Job:** draft prose; pair without burying the page.

| Face | Default? | Body | Footer primary |
|------|----------|------|----------------|
| **Chat** | **Yes** | Transcript only (tool/apply/review cards inline as they appear) | Send |
| **Write** | | Selection chip + Continue / Rewrite / Brainstorm · Apply queue | Generate / Apply |
| **Check** | | Continuity · Review · Craft as a **short tool list** (one line each) | Run selected |
| **Inbox** | | Pending proposals + Apply cards only | — |

**Hidden by default in Writing/Chat:** Research UI, Lab boards, multi-row skill toolbars, long privacy essays (one muted status line max).

Top-bar **Continuity** may remain a power shortcut; rail **Check** is the explained home.

```
Writing + Chat                    Writing + Write
┌ Companion ─────────┐           ┌ Companion ─────────┐
│ Chat Write Check ① │           │ Chat Write Check   │
│ @chapter · @bible  │           │ Selection: 40 ch   │
│                    │           │ [Continue][Rewrite]│
│  transcript…       │           │ [Brainstorm]       │
│                    │           │ Apply cards…       │
│ [ Ask…        ]    │           │                    │
│            [Send]  │           │                    │
└────────────────────┘           └────────────────────┘
```

`①` = Inbox badge when pending count > 0 (click → Inbox face).

---

### 2. Lab (`workspaceMode = lab`)

**Job:** create / experiment; agent feeds the **bench**, not the bible.

| Face | Default? | Body | Footer primary |
|------|----------|------|----------------|
| **Chat** | **Yes** | Transcript; chips `@lab` / `@lab-card` | Send (brainstorm → **cards**) |
| **Spark** | | Kind presets: place · character · beat · what-if (one tap → prompt or cards) | Spark |
| **Inbox** | | Lab-originated proposals awaiting Accept (after Promote) | — |

**Never in Lab rail:** Continuity run, Craft check on chapter, Co-write Apply-to-manuscript, Graph edit.  
**Promote** stays on the **Lab card** (center), not as a permanent rail button.

```
Lab + Chat
┌ Companion ─────────┐
│ Chat  Spark  ①     │
│ @lab · Bench       │
│                    │
│  “3 places for…”   │
│  → cards landed    │
│                    │
│ [ Brainstorm… ]    │
│            [Send]  │
└────────────────────┘
```

---

### 3. Details (sheet open in binder stack / sheet editor focused)

**Job:** deepen **one** canon entity.

| Face | Default? | Body | Footer primary |
|------|----------|------|----------------|
| **Chat** | **Yes** | Transcript; chip `@sheet:Name` | Send |
| **Fill** | | “Propose facts” · field-hint chips · pack preview | Propose |
| **Inbox** | | Proposals **for this sheet** (filter) | Accept paths |

**Hidden:** chapter co-write skills, Lab spark kinds, Research crawl (unless user switches — see Research).

```
Details + Fill
┌ Companion ─────────┐
│ Chat  Fill  ①      │
│ @sheet Kael        │
│ Hints: wound · oath│
│ [Propose pack]     │
│ pending facts…     │
└────────────────────┘
```

---

### 4. Graph (`workspaceMode = graph`)

**Job:** navigate accepted relationships.

| Face | Default? | Body |
|------|----------|------|
| **Chat** | **Yes** | `@graph` · ask about links |
| **Inspect** | | Selected node summary + “Open sheet” · pending edges note |

No co-write. No Lab spark grid.

---

### 5. Research (explicit face or entry)

Research is **not** a twin of Agent with a second kitchen sink.

| Entry | Behavior |
|-------|----------|
| Face **Research** from Writing/Details (optional 4th slot **or** under Check/More) | Query · results · Pin / Propose only |
| From Lab | Prefer “search for this place card” → results can **Pin to Lab card** notes (v1.5); v1: Propose sheet still Accept-gated |

**Research body (only):**

```
[ query                   ] [Search]
pins | results + citations
     [Pin] [Propose to sheet]
```

No transcript wall, no Continuity, no co-write row.

---

## Global rules (overload budget)

1. **≤1 primary** button in the footer.  
2. **≤3 face tabs** visible (4th = overflow/More if needed).  
3. **≤3** competing actions before scroll in the active face.  
4. **One** main scroll region (transcript **or** tools **or** inbox **or** results).  
5. Proposals do not permanently eat the top of Chat — **badge → Inbox**.  
6. Status/privacy/fixture copy: **one** muted line, not a paragraph.  
7. Context switch **resets** face to default (Chat).  
8. Focus mode: companion hidden (unchanged).  
9. Same underlying agent session/transcript store; faces **filter** what is emphasized, not separate AIs.  
10. Tokens only; segment control = quiet ghost/pressed, not loud pills.

---

## Mapping from today’s UI

| Today | Tomorrow |
|-------|----------|
| Agent \| Research tabs | Faces under context; Research is a face, not a peer app |
| Continuity button + essay in transcript | Check face + one status line; optional top-bar run |
| Review / Craft always under composer | Check face only (Writing) |
| Continue / Rewrite / Brainstorm always | Write face only (Writing) |
| All proposals above chat | Inbox face + badge |
| ResearchPanel full swap | Research face, sparse |
| Same chrome on every screen | Writing / Lab / Details / Graph defaults differ |

---

## Shell state (implement sketch)

```ts
type WorkspaceContext = 'writing' | 'lab' | 'details' | 'graph'

type CompanionFace =
  | 'chat' | 'write' | 'check' | 'spark' | 'fill' | 'inspect' | 'research' | 'inbox'

// defaults
const DEFAULT_FACE: Record<WorkspaceContext, CompanionFace> = {
  writing: 'chat',
  lab: 'chat',
  details: 'chat',
  graph: 'chat',
}

// allowed faces per context (KISS allowlists)
const FACES: Record<WorkspaceContext, CompanionFace[]> = {
  writing: ['chat', 'write', 'check', 'inbox'], // research via More or 5th if needed
  lab: ['chat', 'spark', 'inbox'],
  details: ['chat', 'fill', 'inbox'],
  graph: ['chat', 'inspect', 'inbox'],
}
```

`details` context = sheet editor open (binder path), even if workspaceMode stays manuscript/lab underneath — **selection focus wins** for companion defaults.

---

## Acceptance (when built)

- [ ] Opening a chapter shows Writing faces; default Chat; no co-write row until Write  
- [ ] Opening Lab shows Lab faces; default Chat with `@lab`; no Continuity/Craft  
- [ ] Opening a sheet shows Details faces; Fill proposes, does not Apply prose  
- [ ] Context change resets to Chat  
- [ ] Pending count badge → Inbox; Accept still gated  
- [ ] Research face has no co-write / no continuity essay  
- [ ] E2E screenshots: `companion-writing.png`, `companion-lab.png`, `companion-details.png`  
- [ ] No new hex; segment control uses existing button/badge tokens  

---

## Build sequencing

| Step | When |
|------|------|
| Spec (this doc) | Now |
| Refactor AgentPanel → faces (Writing only) | After PR land; can precede Lab UI |
| Lab faces | With slice L |
| Details / Graph faces | With sheet focus + graph polish |
| Research as face | Replace tab swap |

Prefer **Writing face split first** — immediate clutter win without waiting on Lab domain.

---

## Doc links

- Lab bench: [LAB.md](./LAB.md)  
- UX IA: [../03-ux.md](../03-ux.md)  
- Build: [../BUILD.md](../BUILD.md)
