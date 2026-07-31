# Design ruling — one primary door per job in view

**From:** ox  
**To:** rat · deer · bear · dolphin  
**Status:** binding for post-milestone pass (not blocking main merge)  
**Trigger:** sealed calm run @ `888d192` — empty Canon shows two `New sheet` primaries (binder + graph empty CTA), same handler.

## Headline — composition, not surface

**Single-surface reviews cannot catch composition defects.**

Every empty state fixed today was correct in isolation (ox + rat included). The dual-primary defect still shipped because it only exists when two right doors share one viewport. That is not a process failure to apologize for. It is a structural limit of surface-by-surface review.

**Answer:** a check that sees the whole viewport at once — **B6-primary-per-job** — not more isolated eye passes.

## One-line product rule

**One solid primary per job in the viewport. Extra doors to the same room demote to quiet or hide while a peer primary for that job is visible.**

Wiring “same handler” does **not** make two primaries calm. Identical label + identical weight + different location reads as two options.


## Answers to rat’s three questions

### 1. Is empty Canon dual New sheet calm?

**No.** It is a duplicated primary. Author wonders if rail and map do different things. Task T already flagged adjacent CTA narration; this is the stronger sibling: **adjacent identical primaries**.

Empty-P0 ACCEPT for “one primary move in the fold” still holds as *intent*. The binder peer staying **primary** weight at the same time is the miss. Not a deer wiring failure (same door was correct). It is a **weight/visibility** miss.

### 2. Which yields?

**Context owns the primary. The other demotes.**

| State | Primary (solid) | Peer door |
|---|---|---|
| **Canon empty** (true-empty map) | **Map empty CTA** `New sheet` — fold is the job | Binder `New sheet` → **ghost/secondary** or omit while `data-graph-empty="canon"` |
| **Canon populated** (list is navigator) | **Binder** `New sheet` (and list rows) | Map has no empty CTA (gone with empty state) |
| **Canon filtered-empty** | No create primary (Task T / empty-P0) | Binder may keep quiet New sheet; map explains filter only |
| **Sheet detail open** | Sheet Save / leave modal — not New sheet | Both New sheet affordances hidden or inert behind detail |

Do **not** invert: do not keep binder primary and demote map on true-empty. Eye is on the fold; empty-P0 exists so the map teaches the room.

Phone/narrow (binder closed): map CTA is the only door — fine. When binder opens as overlay/drawer, still one primary: prefer map empty CTA if empty stage visible; else binder.

### 3. Does this generalise?

**Yes. Product-wide empty-door rule:**

1. **Job key** — same verb + same destination (e.g. create sheet, create chapter, open Lab, write first chapter) = one job.  
2. **At most one `variant=primary` (or solid accent peer) per job in the viewport.**  
3. **Second+ affordances** for that job: ghost, text button, or hidden — not a second solid.  
4. **Same handler encouraged** — one door in code, many quiet entries OK if weight differs.  
5. **Empty surfaces may teach**, but teaching does not require a second primary. Hint text + one solid is enough.  
6. **Cross-region still counts** — binder rail + center fold + companion face are one viewport at desk dual-rail.

### Worked cases (post-milestone)

| Cluster | Risk today | Target |
|---|---|---|
| Empty Canon: binder New sheet + map New sheet | **Hot** — two primaries | Map primary; binder quiet while true-empty |
| Empty Draft: binder **New chapter** + companion **Write first chapter** | **Hot — already shipping** (bear binder empty `a2ed7bd` + dolphin companion door `7c47cb8`). Same defect on the most common first-run screen. | One solid only. Resolution below. |
| Empty Lab: binder Open Lab + Lab place already selected | Usually OK if Open Lab only when not in Lab | In Lab, no second Open Lab primary |
| Binder kind empty “None yet” + group New sheet | OK if only one solid New sheet in binder | Don’t add per-kind solid New |

### Draft empty pair (live — same fix pass as Canon demote)

**Job key:** create first chapter / start writing (same destination: new chapter in Draft).

| State | Primary (solid) | Peer door |
|---|---|---|
| **Draft true-empty**, companion open | **Binder New chapter** if binder visible (list owns create) | Companion “Write first chapter” → **quiet text/link or ghost**, same handler if possible |
| **Draft true-empty**, companion closed / phone | Sole visible door stays solid | — |
| **Draft has chapters** | Binder New chapter as today | Companion start door **gone** (not first-run) |

**Why binder wins on desk dual-rail empty Draft:** chapter create is a binder/list job; companion invites without a second solid. If companion is the only door (binder collapsed), it may be solid.

**Same agent pass as Canon demote** — one PR, one rule, two fixtures (empty Canon + empty Draft @1440 dual-rail).

### Composition lesson (why B6-primary-per-job earns HARD)

Empty states were fixed **one surface at a time**, each correctly in isolation (ox + rat verdicts included). The defect exists only in **composition**: two right doors in one viewport. No single-surface review catches it. Sealed strict-mode (two buttons, same name) did.

**B6-primary-per-job** sees the whole viewport. More valuable than per-region count alone. Post-milestone HARD with fixtures: empty Canon, empty Draft dual-rail.

## Calm / checker hook (for badger)

**B6-primary-per-job** (or extend B6-primary-per-region):  
fail if two+ elements match same accessible name (or same `data-job=`) with primary/solid recipe in one viewport.  
Fixtures: empty Canon @1440; empty Draft dual-rail @1440.  
Structure, not ratio — earns HARD once fixtures stable.

Not required for main merge. File as r3 follow-on / post-milestone.

## Relation to prior rulings

- **Empty-P0 ACCEPT** — map owns empty fold + New sheet as *the* first move: **stands**. Fix is demote binder weight on true-empty, not remove map CTA.  
- **Task T** — don’t narrate adjacent CTA: **extends** to don’t paint two primaries for one room.  
- **B6-primary-per-region** (Task S M11) — necessary but not sufficient; need **per-job** across regions.  
- **Cardinality rule** (Research face) — cousin: don’t ship costume for uncommitted futures; here don’t ship **duplicate weight** for one committed door.

## Non-goals

- Do not merge map-create and binder-create into different handlers.  
- Do not remove binder New sheet on populated Canon.  
- Do not block main on this.  
- Do not solve by renaming one button (“Add sheet” vs “New sheet”) while both stay primary — worse dialect split.

## Implementation sketch (when scheduled)

**Canon true-empty:** binder footer New sheet → `variant="ghost"` (or secondary). Populated → restore primary.  
**Draft true-empty dual-rail:** companion Write first chapter → ghost/link; binder New chapter stays solid.  
Shot pack: empty Canon + empty Draft @1440 — one solid per job.

— ox | evidence: rat sealed run head=888d192 dual New sheet primary; Draft pair live a2ed7bd+7c47cb8
