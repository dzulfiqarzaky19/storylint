# TASK BA — Lab under load (report-only)

**Provenance:** owned-stack @ `5282a3b` (dirty worktree: probe + inventory scratch only; no product edit).  
**Method:** seed 48 mixed Lab cards via `PUT /api/project` on ephemeral UI+API; Playwright measure @1440×900 and @390×844. DOM geometry + action inventory. Not NVDA.  
**Artifacts:** `e2e/ba-lab-under-load.mjs`, `e2e/output/ba/report.json`, `e2e/output/ba/summary.txt`.  
**Out of scope (honored):** no spark→sheet Accept changes; chapters ≠ Canon.

## Seed

| status | n |
|---|---|
| active | 35 |
| pinned | 3 |
| promoted | 10 |
| archived | 0 (not seeded; path exists) |

Kinds balanced across 7: beat / place / character-spark / lore-spark / what-if / question / motif.

UI live set = `active|pinned` only → **38 cards** on bench + **10** in Promoted list.

## Layout geometry (computed)

### @1440
| node | clientH | scrollH | overflowY |
|---|---:|---:|---|
| `.lab` | 852 | **3866** | auto |
| `.lab__grid` | 2860 | 2860 | visible |
| `.lab__promoted-list` | 512 | 512 | visible |
| `.lab__composer` | 246 | 246 | visible |
| `.lab__filters` | 78 | 78 | visible |

Lab scroll ratio ≈ **4.5×** viewport. One document scroller (`.lab`). Grid and Promoted size-to-content; they do **not** own a clipped scrollport.

### @390
| node | clientH | scrollH | overflowY |
|---|---:|---:|---|
| `.lab` | 796 | **8574** | auto |
| `.lab__grid` | 7334 | 7334 | visible |
| `.lab__promoted-list` | 512 | 512 | visible |

Lab scroll ratio ≈ **10.8×**. Same single-scroller pattern. Composer grows (340 vs 248) because kind disclosure + fields wrap.

## Ranked findings

### 1. Lifecycle hole (product modelling) — highest

**Not a density bug.** Bench has exit for live cards; it has no full lifecycle.

| path | domain | API | UI on live card | UI on promoted | restore |
|---|---|---|---|---|---|
| Archive (soft) | `archiveLabCard` — status→`archived`, stays on disk | `POST /api/lab/cards/:id/archive` | **Archive** button | **none** | **none** |
| Pin / Unpin | `pinLabCard` (blocked if archived/promoted) | `POST …/pin` | Pin/Unpin | — | — |
| Promote | `promoteLabCard` → status `promoted` | `POST …/promote` | Promote to Canon / Send to Draft | read-only row | — |
| Hard delete | **absent** | **absent** | **absent** | — | — |
| Decay / purge / age-out | **absent** | **absent** | **absent** | — | — |
| Unarchive | **absent** | **absent** | **absent** | — | — |

Bench filter (`LabBench.tsx`):  
`live = active|pinned`; `promoted` separate section; **archived never rendered**.

Promoted row actions: title + badge (`sent to Draft` | `Canon proposal`) only. No Archive, dismiss, hide, or clear-promoted.

**Consequence under junk-drawer load:**  
- Archive = hide forever (soft), with no undo surface.  
- Promote = append-only tombstone list that only grows.  
- Disk retains archived + promoted indefinitely.  
- Writer who “cleaned the bench” still owns a lengthening Promoted appendix and invisible archived corpus.

**ox product question (item 4):** Is Promoted a permanent audit log, a temporary outbox, or dismissible history? Today it behaves like an audit log with no retention policy. Archive is a one-way trapdoor with no restore. That is modelling debt, not a missing CSS scroll.

### 2. Findability of a half-remembered card — medium

No search/find control. Lab inputs are composer title + body only (`hasSearch: false`).

Probe target **"Quiet cook"** (character-spark, live):
- @1440: in DOM, **not** in first viewport; `scrollIntoView` brings it on-screen; kind filter **Character** narrows 38 → **5** and includes `Quiet cook #7`.
- @390: same filter path works; first paint already showed target in one run after measure scroll state (order is pin-sorted, not alpha).

**Kind filter works** and is the only find aid:
- Present once `live.length > 0`.
- Kinds behind `<details>` disclosure (summary “Kinds” / active kind label); 7 options.
- Composer kind chooser also disclosure; 7 options; opens under load without clipping by its own box (document scroll owns overflow).

**Gap:** title/body substring find does not exist. Filter helps only if the writer remembers **kind**. Half-remembered title with wrong-kind guess still means manual scroll of a 4.5×–10.8× page.

### 3. Promoted scroll vs Inbox-wall pattern — lower than expected

**Not an Inbox wall.**

Inbox-wall pattern = region taller than its box **and** non-scrolling / trapped.  
Here: `.lab__promoted-list` scrollH === clientH (512/512 both viewports), overflowY `visible`. Content fits its box; **parent `.lab` scrolls**.

So Promoted is a **document-length tax**, not a trapped pane:
- 10 promoted rows ≈ 512px always below the grid.
- At 38 live cards the pain is grid length, not Promoted clipping.
- If promoted accumulates to dozens/hundreds with no dismiss, it remains a long tail on the same scroller (still not a nested wall unless CSS changes).

Probe flag `promotedLikelyWall` in raw JSON over-called; corrected judgment: **no nested wall; append-only length risk** (ties to finding 1).

### 4. Density / chrome under load — informational

- Pin sort puts 3 pinned first; useful.
- Each live card exposes Edit / Pin|Unpin / (Promote|Send to Draft if eligible) / Archive — action row is honest, busy-free in this seed.
- what-if / question / motif correctly omit promote (no false path).
- Filter + composer disclosures stay one-click; not seven equal peers at rest (P2 intent holds under load).
- @390 the page is a long single column (grid ~7334px). Usable, tiring. No second sticky chrome conflict measured inside `.lab`.
- Boards: only default **Bench** in seed; board tablist present.

## What is fine

- Soft archive path exists end-to-end for **live** cards.  
- Promote path labels distinguish beat vs spark.  
- Kind filter disclosure + composer kind disclosure scale to 7 kinds.  
- Single owned scroller avoids nested-scroll traps on grid/promoted.  
- Empty-bench rest note path unused under load (correct).

## Non-findings / do-not-fix from BA alone

- Do not “fix” Promoted by giving it `overflow: auto` and a fixed height without a product retention story — that would mint a real nested wall.  
- Do not add hard delete without deciding archive vs destroy.  
- Do not touch Promote→Accept / Canon write path from this report.

## Suggested product decisions (for ox; not implementing)

1. **Promoted retention:** audit-log (keep) vs outbox (dismiss after N days / after Accept) vs “hide promoted” toggle.  
2. **Archive restore:** undo snackbar, Archived board/filter, or true delete after soft window.  
3. **Find:** optional title filter/search only if junk-drawer scale is a real dogfood pain; kind filter already carries medium load.  
4. **Pin soft-cap UX:** domain allows >5; UI does not warn yet (`LAB_PIN_SOFT_CAP = 5`) — minor, not BA-blocking.

## Verdict

Under a 40+ mixed junk-drawer seed, Lab remains **operable**: one scroller, working kind filter, archive on live cards, disclosures intact.  
The real BA signal is **lifecycle modelling**, not contrast/motion/scroll-trap chrome:

> Writers can add and promote forever; they can soft-hide live cards; they cannot restore, hard-delete, decay, or clear Promoted. Density pain is mostly scroll length; product pain is the missing ends of the object lifecycle.

**Report-only. No product commit.**

## ox ruling (binding)

See `docs/decisions/lab-lifecycle-ends.md`.

- Density **ACCEPT** at 40+. No chrome redesign from BA.
- **Promoted = dismissible history (receipts)** — Dismiss/Clear is Lab-only; never undoes Canon/Inbox/Draft.
- **Archive = real state + Restore** — no hard delete v1.
- Do not fixed-height `overflow:auto` Promoted without dismiss/retention.
- Tip ox when lifecycle tip is scheduled/landed.
