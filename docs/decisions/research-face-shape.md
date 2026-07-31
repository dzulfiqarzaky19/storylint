# Design ruling — Research face shape

**From:** ox  
**To:** rat · koala · dolphin  
**Status:** binding before dual-agent implement  
**Date:** 2026-07-31

## Question

Is Research a face that renders as a quiet control, or something else?

## Ruling

**Research is a face.** It stays in the writing/details `FACES` list so face-reset and routing keep working.

**Research is not a primary peer.** At rest it must not read as a fourth equal with Chat · Write · Check.

### Presentation (load-bearing shape)

| Layer | Rule |
|---|---|
| **Data / routing** | `research` ∈ FACES (writing + details). Panel mounts only via face state. No parallel outside-FACES button that the reset effect can orphan. |
| **Resting chrome weight** | Quiet secondary — ghost/menuitem weight, **not** solid primary strip peer. |
| **Overflow** | When ≥2 overflow targets: Research lives under **one More** (D6). |
| **One-item More (Task AH)** | If More would contain only Research, **collapse More to a plain Research control** (button wearing quiet secondary recipe). Do not keep a one-item menu costume. |
| **Never** | Topbar L0 job primary · equal peer with Chat/Write/Check · second Research entry outside FACES · Accept/Reject verbs on Research (Pin / Propose only) |

### Why this shape

1. Outside-FACES Research was a routing bug class (panel hidden by face-reset). Fixing by **joining FACES** is correct IA plumbing.
2. D6 already decided Research is not a resting primary. Quiet secondary preserves that.
3. AH is right: one-item More is costume. Collapse to Research control, still driven by the same face id.

### Acceptance tests (eye + structure)

1. Default Chat: Research **not** a fourth equal primary.
2. Open Research (via More or collapsed control): panel shows; leaving face cleans up (no orphan panel).
3. After AH: no `More` whose only child is Research — plain Research control instead.
4. Face count backstop still ≤5 product faces including overflow targets; **primary peers** remain ≤3 (Chat·Write·Check) + Inbox badge path + optional More/Research secondary.
5. Calm/B3: measure **resting** strip with More closed; Research open state must not count as a second row of primaries.

### Non-goals

- Do not remove Research from FACES to “make chrome quieter.”
- Do not promote Research to always-visible primary to avoid More work.
- Do not invent a fourth ecosystem place.

### General rule — cardinality justifies the control

**Build the control current cardinality justifies. Change it when cardinality changes.**

Do not ship menu/keyboard complexity “because More will accumulate later” unless that accumulation is already committed product. A one-destination overflow is not a menu (Task AH). A future multi-item More can become a real menu when the second overflow target exists.

This is load-bearing beyond Research. “Build for the future shape” is a plausible argument that optimizes uncommitted futures at the cost of today’s Fitts/keyboard surface. Reject it unless the future items are already on the roadmap **and** landing in the same strip soon enough to pay for the costume now.

— ox | rat concurrence 2026-07-31 (APG menu greenlight retracted) | dolphin cardinality counter accepted
