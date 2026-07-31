# 02 — Progressive disclosure

**Scope:** how to hide complexity without hiding capability.  
**Storylint relevance:** many tools, three ecosystems, one calm default.

---

## Definition

**Progressive disclosure** = show what the user needs for the current job; reveal more on demand or when conditions are met.  
Goal: lower cognitive load without amputating power.

Industry practice warns: **more than ~3 disclosure layers** usually means the IA is wrong, not that users need another nested menu.

That maps directly to Storylint’s **max navigation depth 3**.

---

## Four useful types

| Type | How it works | Storylint fit |
|------|--------------|---------------|
| **Conditional** | Show controls only when a condition is true | Continuity enabled when a Draft chapter exists; Lab Continuity stays off |
| **Contextual** | Show details relevant to current selection/place | Companion faces change by writing / lab / details / graph |
| **Progressive enabling** | Disable until prerequisites met | Apply disabled until card exists; Promote only on promotable card kinds |
| **Staged** | Step-by-step sequence | Prefer **not** for core write path; OK for rare export wizards only |

For a writing IDE, **conditional + contextual** beat long staged onboarding.

---

## What good disclosure looks like

1. **Defaults are enough for the primary job**  
   J1 writer can type without opening Research, Graph, or Review.

2. **Power is one intentional step away**  
   Check face → Continuity. Not Continuity + Review + Craft + Export all top-level forever.

3. **Disclosure cues are obvious**  
   Tabs, “more”, overflow menus, selected faces — not hover-only secrets on desktop-only.

4. **Advanced stays advanced**  
   Graph filters, craft tag full set, research cite detail — expand in place, don’t colonize the top bar.

5. **Layer count stays shallow**  
   Home → ecosystem → thing. Companion faces are modes of help, not extra kingdoms.

---

## What bad disclosure looks like

| Anti-pattern | Why it hurts |
|--------------|--------------|
| Everything visible “so power users see it” | Equal weight = no hierarchy |
| Everything hidden in hamburger “so it’s clean” | Core jobs become treasure hunts |
| Clever names for disclosed panels | Users can’t predict what’s inside |
| Hover-only identity (graph labels, icon meanings) | Fails touch + accessibility |
| Nested hubs (Tools → Research → Sources → …) | Depth explosion |
| Staged wizard for daily write | Blocks momentum authors |

---

## Toolbar & chrome application

### Keep calm (always-on candidates)

- Place / ecosystem switch
- Project identity
- Save status
- Focus
- Companion toggle

### Disclose by job

| Job | Reveal |
|-----|--------|
| Drafting | Check tools, craft tags as secondary |
| Lab | Spark presets, promote exits |
| Canon map | View/filter controls on the map surface |
| Sheet edit | Fill / fact editors |
| Rare library ops | Export, new project in overflow |

### Demote over time

A top-level shortcut can exist while a better home is weak (e.g. top Continuity while Check is still learning), then move to overflow once the contextual home is discoverable. That is a **migration** disclosure strategy, not a permanent double home.

---

## Companion faces as disclosure

Context-sensitive face sets are progressive disclosure done right:

- Writing: Chat, Write, Check, Research, Inbox
- Lab: Chat, Spark, Inbox
- Details: Chat, Fill, Research, Inbox
- Graph: Chat, Inspect, Inbox

Users learn a small face vocabulary instead of a permanent mega-toolbar.

**Rule:** faces are not Level-2 navigation. They do not create a fourth ecosystem.

---

## Mobile / narrow

Progressive disclosure is mandatory on small screens:

- Prioritize content (Draft page, Lab cards, graph readability)
- Collapse secondary chrome first
- Prefer drawers over permanent dual rails
- Do not keep desktop equal-weight tool clusters

---

## Checklist for any new control

Before adding a visible control, answer:

1. Which journey needs it (J1 / J2 / J3)?
2. Is it primary for that moment or secondary?
3. Can it live in companion / overflow / surface chrome instead of global top bar?
4. Does it add a navigation level?
5. Can a new user ignore it and still succeed?

If (4) is yes or (5) is no, redesign.

---

## Sources

- LogRocket, “Progressive disclosure in UX design: Types and use cases” (updated 2025) — conditional, contextual, progressive enabling, staged; keep disclosure levels shallow (ideally under three)
- Standard complex-product practice: basic toolbar + advanced overflow (docs/IDE pattern)
- Storylint lock: max depth 3 · IA_MAP chrome density rules


- Nielsen Norman Group — Progressive Disclosure pattern (advanced/rare → secondary surface)
- Kristina Hooper Woolsey (1985) — selectively inform users with well-chosen system bits
- Wikipedia *Progressive disclosure* (retrieved 2026-07-31) — macOS print “Show Details”; theme-park queue analogy
- Evidence pack cluster F: [07-overwhelm-evidence.md](./07-overwhelm-evidence.md#source-cluster-f--progressive-disclosure)

### Evidence anchors (selected)

1. Defer advanced features until task-relevant (NN/g definition).
2. >~3 nested disclosure layers usually means broken IA, not “need another menu.”
3. Staged wizards OK for rare setup; bad for daily write (J1).
4. Hidden nav calms but costs discoverability — compensate with plain labels + empty states.
5. Contextual face sets beat permanent mega-toolbars.
6. Expertise reversal: scaffolds that help novices can slow experts (fade chrome, don’t delete power).
7. Defaults must complete primary job without opening advanced UI.
8. Migration dual-homes are temporary, not permanent double entry.
9. Hover-only disclosure fails a11y/touch.
10. Storylint max depth 3 *is* architectural progressive disclosure.
