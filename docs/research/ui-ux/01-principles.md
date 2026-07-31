# 01 — Core UI/UX principles

**Scope:** durable principles for complex creative tools (not marketing sites).  
**Storylint relevance:** power IDE + calm writing surface.

---

## 1. Cognitive load is the real competitor

Users fail less from “missing features” than from **too many simultaneous decisions**.

Three load types that matter in product UI:

| Load | Meaning | Product smell |
|------|---------|---------------|
| Intrinsic | Hardness of the real task (writing a novel) | Unavoidable — don’t add fake complexity |
| Extraneous | UI friction, clutter, unclear labels | Too many equal buttons, jargon, nested hubs |
| Germane | Useful learning of the mental model | Good labels, stable places, clear gates |

**Practice:** spend design budget on cutting **extraneous** load. Keep the hard part writing/worldbuilding, not “where is Continuity.”

---

## 2. One primary job per moment

At any time the UI should answer:

1. **Where am I?**
2. **What is the main thing to do here?**
3. **Where can I go next?**

If three “main things” compete at equal weight, users stall.

**Patterns that support this**

- Clear selected state for the current place
- One primary action style; secondary quieter
- Focus / distraction-free mode for deep work
- Context-sensitive tools (show job tools only in the job)

---

## 3. Recognition over recall

Prefer visible structure and plain labels over memorized icon grammar.

| Prefer | Avoid |
|--------|-------|
| “Draft”, “Lab”, “Canon” | Clever internal codenames |
| Selected ecosystem + selected thing | Mystery mode chips with no home |
| Inbox of pending gates | “Something changed somewhere” |

Icons need labels for primary navigation (especially for new users). Tooltip-only identity fails under density and on touch.

---

## 4. Feedback loops must be obvious

Every meaningful action needs a visible result:

| Action class | Feedback |
|--------------|----------|
| Type / edit | Save state (Saving… / Saved) |
| Run analysis | Progress + summary counts |
| Propose change | Card in a known inbox |
| Accept / Apply | Target updates; gate leaves pending |
| Reject / Dismiss | Clear removal; no silent side effect |
| Error | Plain language, recoverable |

No feedback = users repeat actions or lose trust.

---

## 5. Hierarchy beats flat toolbars

Not every action deserves the same altitude.

| Altitude | Examples |
|----------|----------|
| Global always | Place switch, identity, focus, companion toggle |
| Contextual job | Continuity while drafting; Spark in Lab |
| Rare / overflow | Export, new project, advanced filters |
| Destructive / canon | Accept, Apply, delete — explicit |

Flat toolbars feel “powerful” early and “noisy” forever.

---

## 6. Consistency builds speed

Same place → same behavior.

- Rails behave the same across widths (collapse rules stable)
- Companion faces follow a fixed vocabulary
- Gates always mean the same thing (Accept never half-writes)
- Empty states teach the next step without a modal wizard

Inconsistency forces re-learning — pure extraneous load.

---

## 7. Accessibility is usability

Minimum bar for a writing IDE:

- Keyboard reach for primary paths
- Visible focus rings
- Labels on icon-only controls
- Contrast safe for long reading sessions
- Reduced-motion respect
- Touch targets usable on narrow layouts (≥44px class targets)

If a path only works with hover, it is incomplete.

---

## 8. Empty states are product UI

Empty is not failure; it is onboarding without a wizard.

Good empty states:

- Name the place (“No chapters yet”)
- Offer **one or two** next actions max
- Never dump the full feature catalog

For Storylint-class apps: empty project should offer **Write** or **Start in Lab**, not ten tools.

---

## 9. Density is allowed; chaos is not

High-information UIs (IDEs, Scrivener-like binders) can be dense **if**:

- Grouping is obvious
- Primary path stays calm
- Advanced controls collapse
- Typography/spacing stay readable for hours

Density without hierarchy is clutter. Hierarchy without density can feel toy-like for power users. Aim for **structured density**.

---

## 10. Test tasks, not opinions

Validate with journey tasks:

- “Open and write for two minutes”
- “Start ideas without polluting canon”
- “Run continuity and accept one fact”

Measure: time to first useful keystroke, misclicks, recoverability, whether users can say where they are.

Pretty screenshots are secondary.

---

## Sources

- Cognitive load framing in modern UX practice (extraneous vs intrinsic)
- Wayfinding trio (where / what / next) — standard navigation UX teaching
- Nielsen-class heuristics: visibility of system status, match to real world, consistency, error prevention, recognition vs recall
- Accessibility baselines (WCAG-oriented practical bar for app chrome)


- Dense evidence (~20 datapoints per cluster): [07-overwhelm-evidence.md](./07-overwhelm-evidence.md)
  - Sweller CLT (1988+) · Miller WM · Hick–Hyman · choice overload metas · Krug / Laws of UX · Fitts / Doherty / Tesler

### Overwhelm one-liners (from evidence)

| Principle above | Evidence hook |
|-----------------|---------------|
| Cognitive load | Extraneous load is the design-owned budget |
| One primary job | Hick + choice overload: equal peers freeze users |
| Recognition over recall | Limited WM; labels beat icon grammar |
| Feedback loops | Doherty ~400ms; empty success builds trust |
| Hierarchy | Serial position + structured density |
| Consistency | Micro-pauses from inconsistency accumulate load |
| Accessibility | Fitts targets; non-hover identity |
| Empty states | Two-door onboarding beats wizard overload |
| Density OK / chaos not | Tesler: system should carry irreducible complexity |
| Test tasks | Aesthetic-usability can mask real faults |
