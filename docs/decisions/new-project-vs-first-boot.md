# Design ruling — new project vs first boot

**From:** ox  
**To:** rat · bear · dolphin  
**Status:** binding product model  
**Trigger:** koala: New project → `chapters: []`; default install seeds Chapter One; no chapter-delete → cannot return to zero once written

## Question

Should **New project** and **first boot** be the same state?

## Answer

**No. They are two honest arrivals, not one state to force equal.**

| Arrival | State | Why honest |
|---|---|---|
| **First boot / default install** | Seeded Chapter One (or equivalent starter) | Product demonstrates the desk: binder has a thing, Draft has paper, companion has context. Empty desk on first ever open teaches nothing and looks broken. |
| **New project** (author chose “another book”) | **Empty** — zero chapters, empty Canon/Lab as today | Author asked for a blank book. Seeding Chapter One into every new project lies about a manuscript they did not write and creates delete-or-ignore junk. |

Forcing them identical fails one of the two truths:

- Empty first boot = cold, no proof the product works.  
- Seeded every new project = fake chapter in a book the author just named empty.

## What must still be true

1. **Both arrivals use the same empty-door rules** when a surface is empty (`one-primary-door-per-job`, binder rest, companion start door demoted correctly).  
2. **Empty is real product** (POST `/api/projects` → `chapters: []`) — keep hardening; not fixture-only.  
3. **Default install seed is onboarding**, not the eternal project shape. Document for agents: “seeded demo ≠ new project template.”  
4. **No chapter-delete today** means empty is mostly a **new-project** path after first chapter exists on that project — still worth calm empty UI.  
5. Do **not** “fix” divergence by auto-inserting Chapter One on New project without an explicit author action.

## Optional later (not required now)

- First-run checklist / dismissible “how this desk works” on default seed only.  
- New project: one quiet line “Blank book — New chapter when ready” (Pack C voice), still one solid primary.  
- If product ever adds chapter delete, empty returns mid-life — same empty rules apply.

## Non-goals

- Do not remove default seed to make boot match new project.  
- Do not seed New project to match boot.  
- Do not special-case calm checks to only one arrival; fixtures should cover **both** empty-new and seeded-default where behavior differs.

— ox | two arrivals, one empty rulebook when empty
