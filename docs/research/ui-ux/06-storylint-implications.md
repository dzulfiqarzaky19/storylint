# 06 — Storylint implications

**Scope:** apply research pack → locked Storylint map.  
**Authority:** does not override [IA_MAP.md](../../IA_MAP.md); recommends build emphasis.

---

## Research verdict (short)

Storylint’s locked shape is **aligned with best practice**:

| Lock | Research support |
|------|------------------|
| Three ecosystems only | Few top-level choices; clear mental model |
| Max depth 3 | Progressive disclosure + nav depth guidance |
| Companion not a kingdom | Contextual disclosure; IDE sidebar pattern |
| Apply/Accept gates | Staged change / trust norms |
| Focus kills chrome | Writing-app sanctuary pattern |
| No new panels | Density/hierarchy over feature sprawl |

The main risk is not missing features. It is **extraneous load from chrome and naming** while the architecture is already rich enough.

Dense citations and ~20 datapoints per mechanism cluster: **[07-overwhelm-evidence.md](./07-overwhelm-evidence.md)**.

### Overwhelm mechanisms → Storylint counters

| Mechanism | Counter already locked |
|-----------|------------------------|
| Extraneous cognitive load | Calm L0 top bar; Focus; paper-first Draft |
| Choice overload / Hick | 3 ecosystems; 2 empty doors; 2 Lab exits |
| Information overload | Inbox + cards + Check summaries (filters) |
| Split attention | Mark ↔ proposal ↔ Accept contiguity |
| Untrusted automation | No auto-apply/accept; gen out of type column |
| Cockpit sprawl | No fourth ecosystem; companion faces by job |

---

## What the research says to prioritize

Matches IA_MAP §15, reinforced by external practice:

### P0 — Naming + entry (high leverage, low structural risk)

| Change | Why research cares |
|--------|--------------------|
| Write → **Draft** | Recognition; matches job language |
| Promote split → **Send to Draft** / **Promote to Canon** | Two exits need two names |
| Binder groups **Draft / Lab / Canon** | Wayfinding labels |
| Empty project: **Write** or **Start in Lab** | Empty state as two-door onboarding, not wizard |

### P1 — Calm top bar

| Change | Why |
|--------|-----|
| Single project identity | Duplicate titles = orientation noise |
| Rare actions to overflow | Hick’s law / hierarchy |
| Continuity as Check-primary; top shortcut temporary | Contextual disclosure migration |

### P2 — Canon entry

| Change | Why |
|--------|-----|
| Graph under **Canon** (map view) | Filters/views ≠ top ecosystems |
| Landing: map first, then last Canon thing | Consistent place memory |

### P3 — Surface density polish

Only after P0–P2. Includes graph control hierarchy, phone content priority, craft-tag collapse (partly done).

---

## Journey guardrails (from research)

### J1 Write

**Success metric:** first keystroke in ≤5 seconds on return visit.

Must remain possible with:

- No Lab
- No Graph
- No Research
- Companion closed
- Focus on

If a change breaks that, it fails research bar regardless of power-user gain.

### J2 Lab

**Success metric:** user can make a mess and explain “this isn’t canon yet.”

Must keep:

- Sandbox copy visible
- Two named exits only
- Accept still required for bible
- Continuity not run on Lab text

### J3 Continuity

**Success metric:** one real contradiction caught + clear Accept path.

Must keep:

- Marks on Draft
- Proposals as objects
- Inbox durable
- No silent canon write
- Empty success feedback (“0 issues”) as trustworthy as findings

---

## Control altitude map (recommended)

| Altitude | Controls |
|----------|----------|
| **L0 Global calm** | Binder toggle, project switcher, save status, Draft/Lab/Canon, Focus, theme, companion |
| **L1 Job chrome** | Companion faces; map view toggles; Lab board tools; paper reading control |
| **L2 On demand** | Continuity/Review/Craft inside Check; Research face; filters on map; export overflow |
| **L3 Gates** | Apply / Accept / Edit / Reject / Promote exits — always explicit |

If a control claims L0, it must serve most sessions. Continuity does not.

---

## Do not do (research + locks agree)

1. Fourth ecosystem (Research/Graph/Review/Agent-as-place)  
2. Depth-4 dig paths for core jobs  
3. Auto-apply / auto-accept  
4. Gen chips in Draft type column  
5. Blocking multi-step wizard on first launch  
6. Hover-only identity for primary objects  
7. Equal-weight top buttons for rare ops  
8. New panels before naming/entry/chrome alignment  

---

## Suggested evaluation scripts (dogfood)

Use as qualitative tests after UI alignment:

1. **Cold return:** open app → type in last chapter without thinking  
2. **New story anxiety:** create project → Start in Lab → promote one character → accept in Inbox  
3. **Continuity:** write a contradiction → run check → accept fix  
4. **Focus:** enable Focus → confirm only paper remains  
5. **Narrow:** phone width family/map still answers “who is this node?”  

Pass/fail on task completion and confusion moments, not aesthetics alone.

---

## How agents should use this pack

| Agent role | Use |
|------------|-----|
| Research (pig) | Keep pack updated when new evidence arrives; densify in [07](./07-overwhelm-evidence.md) |
| UX review | Judge faults against principles + IA_MAP + 07 mechanisms, not taste alone |
| Coder | Implement IA_MAP build order; read 06 before inventing chrome |
| PM (when active) | Don’t schedule new surfaces before P0–P2 |

---

## Open research questions (later)

Not blocking build:

1. Is “Canon” plain enough for non-literary authors, or is “World” better as user-facing synonym?  
2. Should first-run two doors be cards, split empty state, or a quiet preference?  
3. Long-term: does Canon map deserve a split button (Canon ▾ Map/Sheets) or binder-only sheet access?  
4. Metrics if dogfood expands: time-to-first-keystroke, pending-inbox age, promote→accept conversion  

---

## Bottom line

Best-practice UI/UX for Storylint is not “more polish layers.” It is:

> **Calm default, shallow depth, plain names, contextual power, explicit gates.**

That is already the product doctrine. Research says execute the map — especially naming, entry, and top-bar hierarchy — before inventing anything new.
