# 03 — Navigation and information architecture

**Scope:** wayfinding, depth, labels, density for complex apps.  
**Storylint relevance:** Lab / Draft / Canon shell.

---

## Navigation must answer three questions

At every screen:

1. **Where am I?**
2. **What can I do here?**
3. **Where can I go next?**

If users cannot answer quickly, navigation failed — even if features exist.

---

## Start from IA, not from menus

Good order of work (industry SaaS practice):

1. User jobs / journeys  
2. Information architecture (places + things)  
3. Navigation chrome  
4. Visual density polish  

Storylint already did 1–2 (journeys + IA_MAP). Build should implement chrome to match, not invent new places.

---

## Depth

### Practical rule

**Keep primary task paths within three steps** from home.

Deeper trees are sometimes necessary for large libraries, but **daily jobs must not dig**.

Storylint lock is stricter and correct for this product:

```
Home → Ecosystem (Lab | Draft | Canon) → Thing
```

Companion, research, review, filters = tools inside a place, not deeper kingdoms.

### Anti-patterns

- Hubs inside hubs
- “Tools” as a top ecosystem
- Same feature reachable only through inconsistent deep paths
- Breadcrumb theater that hides a broken hierarchy

---

## Familiar patterns (and when to use them)

| Pattern | Best for | Storylint use |
|---------|----------|---------------|
| **Top bar** | Global identity + few primary switches | Project, ecosystem switch, focus, companion |
| **Left sidebar / binder** | Hierarchical objects in a project | Chapters, boards, sheets |
| **Right sidebar** | Inspector / assistant | Companion |
| **Center canvas** | Primary work surface | Draft page, Lab bench, Canon map |
| **Tabs / faces** | Peer modes inside one region | Companion faces; map Network/Family |
| **Drawers** | Narrow layouts | Binder/agent below breakpoints |
| **Overflow menus** | Rare actions | Export, new project |
| **Breadcrumbs** | Deep systems | Usually unnecessary if depth ≤3 and binder shows place |

Avoid mega-menus for this product. The object model is a project binder, not a content site.

---

## Labels beat cleverness

Navigation labels should be:

- Specific
- Familiar to the audience
- Consistent
- Free of internal jargon

| Weak | Stronger for Storylint audience |
|------|----------------------------------|
| Write (ambiguous vs co-write face) | **Draft** |
| Graph as peer product | **Canon** (map is a view) |
| Promote (two different exits) | **Send to Draft** / **Promote to Canon** |
| Mystery icon row | Icon + text for primary switches |

Test labels with task language: “I want to draft”, “I want to mess around”, “I want the truth of the world.”

---

## Grouping and Hick’s law

More equal choices → slower decisions.

Practices:

- Few top-level items (Storylint: three ecosystems)
- Group binder sections by ecosystem language
- Separate **view switch** from **filters** (filters are not navigation peers)
- Don’t give rare actions equal weight to daily ones

---

## Orientation cues

Users need continuous orientation:

| Cue | Example |
|-----|---------|
| Selected ecosystem | Draft / Lab / Canon pressed state |
| Selected thing | Active chapter / board / sheet |
| Place title | Top status: chapter title or “Lab” / map |
| Mode chrome | Companion `data-companion-context` faces |
| Save/system status | Saved, Continuity running |

Missing current-location indication is a top complex-product failure mode.

---

## Responsive navigation

| Width | Pattern |
|-------|---------|
| Wide | Dual rails OK if toggles exist |
| Medium | One rail + drawer for the other |
| Compact | Drawers; content first |
| Focus | Rails gone; work surface only |

Do not ship a shrunk desktop toolbar as “mobile design.” Re-prioritize.

---

## Density without disorientation

Structured density works when:

- Sections have headers
- Primary objects scan as a list
- Secondary actions appear on select/hover/menu, not all at once
- Filters live with the view they affect

Unstructured density (every action always visible) is what users call “too many buttons.”

---

## Common navigation failures (checklist)

- [ ] Too many top-level items of equal weight  
- [ ] Vague or clever labels  
- [ ] Core actions hidden with no teaching  
- [ ] Inconsistent structure across modes  
- [ ] Needlessly deep menus  
- [ ] No selected/location state  
- [ ] Desktop chrome forced onto phone  
- [ ] Filters presented as destinations  

Storylint’s own UX fault list already hit several of these (topbar overload, graph control hierarchy, phone density). Research agrees those are real faults, not taste.

---

## Sources

- Eleken, “UX navigation design: Common patterns and best practices” (2026) — wayfinding questions, patterns, label clarity, depth mistakes, responsive nav
- Progressive disclosure depth guidance (keep layers shallow) — see 02
- Storylint [IA_MAP.md](../../IA_MAP.md) rulings on Canon landing, binder stack sheets, depth law
