# Design ruling — Network graph at volume (C1)

**From:** ox  
**To:** rat · pig · deer · octopus  
**Status:** binding product model — **unblocks build**  
**Evidence:** AZ Canon@68 — minDist 25.1, closePairs 68, dense initials; Character filter → 36 / minDist 47 / close 0  
**Cite:** [canon-under-load-az](./canon-under-load-az.md) · [density-pass-settled-positions](./density-pass-settled-positions.md) §6 · B4-lab-empty-filter (cardinality justifies chrome) · Family generation layering · false-state

## Principle (load-bearing)

**A graph must answer a question the author can finish reading.**

| | |
|---|---|
| **Job of Network** | Relationship shape of **accepted Canon** across kinds — “how is this cast wired?” / “what ties this org to that place?” |
| **Not the job** | Cast **directory** (binder + kind sections) · kinship **tree** (Family) · search box |
| **Failure mode** | Full-cast hairball: everything painted, **no** question finishable. Dense initials are honest packing and still not a directory. |
| **Sibling lesson (Family)** | Family does not show “all relationships.” It shows **one structured cut** (kinship + generation). Network’s structured cut at volume is a **kind slice**, not a new layout algorithm. |
| **Sibling lesson (B4)** | A filter with nothing useful to filter is **chrome**. Do not force filter ritual when the full set is already readable. |
| **False-state** | Hiding Canon behind “pick a filter” when N is small asserts an empty/broken map. Silent default-hide without a count lies about how much Canon exists. |

**Therefore:**  
**Auto-narrow when the full set is unreadable. Never force a filter door when the full set is already readable.**  
Widen is always one control away. Narrow is the default only past a threshold.

## Pick

| Candidate | Verdict | Why |
|---|---|---|
| **A. Filter-first** (nothing paints until author narrows) | **Reject as default** | Right instinct at 60+; **wrong at 5** — door in front of a room you can already see. Cardinality violation + false-empty risk. |
| **B. Default filter above threshold** | **Accept — binding** | First paint answers a question when hairball would not. Small-N stays whole. |
| **C. Cluster / expand** | **Defer** | Real graph product. Not required to unblock readable Network. May return after B ships if dogfood still fails. |

**Binding model name:** **thresholded default kind-slice** (option B).

## Behaviour by cardinality

Let **N** = node count in the current Canon map (accepted relationship graph), before kind filter.

| N | First paint | Filter chrome | Labels |
|---|---|---|---|
| **N = 0** | Empty map (existing empty Canon) | **No** filter row costume | — |
| **1 ≤ N < T** | **All nodes** | Filters available but **idle** (optional quiet chips OK; not a required step) | Full names when geometry allows (existing dense rules) |
| **N ≥ T** | **Pre-narrowed** to default slice | Chips required as the way to change slice; **All** is explicit | Prefer full names inside the slice; dense initials only if slice still packed |

### Threshold T

| | |
|---|---|
| **T = 24** | Below: full graph is the product. At/above: default slice. |
| Why 24 | Under ~20–30, kind sections + full graph stay scannable (AZ Character@36 was already the recovery zone; 68 was hairball). 24 is conservative: enter slice mode before initials-only packing becomes the only option. |
| Not sacred | If a probe shows full graph still name-readable at 30 with real bibles, raise T with evidence. Do not lower below ~16 without evidence (avoid slice costume on small desks). |

### Default slice when N ≥ T

| Priority | Slice |
|---|---|
| 1 | **Last-used kind filter** for this project (persist) |
| 2 | Else **Characters** | Largest cast pressure; AZ recovery path |
| 3 | If Characters count is 0 | Next kind by count, else **All** |

**All** must remain a first-class chip — default slice is a **start**, not a prison.

### Exit threshold (N drops below T)

Rat case: author at 30 with a slice active deletes down to 20. Does the slice release?

**Distinguish who chose the slice.**

| How the current slice was set | When N falls below T | Why |
|---|---|---|
| **System default** (auto-applied because N was ≥ T; author never picked a chip this session) | **Release to All** automatically | Principle: never force a filter door when the full set is readable again. Staying narrowed with no author intent is unexplained chrome. |
| **Author-explicit** (clicked a kind chip, or chose All then a kind) | **Keep the slice** | Author is investigating a cut on purpose. Do not yank their filter because a delete crossed T. Honesty line still shows `Showing x of N`. |
| Author later clicks **All** | All, always | Widen is one control away at any N. |

**Session flag:** track `sliceSource = 'system' | 'author'`.  
- Auto-apply on enter N≥T only when there is no author choice yet (or last author choice was cleared).  
- Any chip click (including All) sets `author`.  
- On N < T: if `system` → set All and clear system flag; if `author` → keep.  
- **Persisted last-used kind** is only the default **seed for the next system enter** (N crosses T upward again) — it does **not** by itself keep a narrow view below T.

**No hysteresis band** for v1 (enter and exit at the same T). Boundary thrash is rare (add/delete single nodes at exactly 24). Revisit only if dogfood flickers.

**Fixture:** N=30 system-narrowed Characters → delete to N=20 → view becomes All, honesty line off. Same path after author clicks Lore → delete to N=20 → stays Lore with honesty line.
### Honesty chrome (required when narrowed)

When the view is not All:

```
Showing {visible} of {N} · {Kind label}
```

Quiet, muted, always visible with the chips. Author must never wonder whether Canon shrank.

## What we are not doing

| Non-goal | Why |
|---|---|
| New force-layout / cluster algorithm in this tip | Model is slice, not physics |
| Search on the map | Binder/search reopen criterion unchanged (AZ) |
| Changing Family | Family job stays kinship; do not merge views |
| Filter-first empty canvas at small N | Cardinality / false-empty |
| Pretending dense initials = directory | Still false |

## Implement sketch (for badger / pig)

1. Compute N on map data; hold `sliceSource` (`system` | `author`).  
2. If N ≥ T and `sliceSource` is not `author`, apply default slice (last-used → Characters → …) and set `system`.  
3. If N < T and `sliceSource === 'system'`, release to All.  
4. Kind chips + **All**; chip click → `author`; persist last-used kind per project (for next system enter only).  
5. Status line `Showing x of N · Kind` when ≠ All.  
6. Fixtures: **N=5** all visible; **N≥T** first paint narrowed + honest count + All restores; **N=30→20 system** releases to All; **N=30→20 after author chip** keeps slice.  
7. Calm: no new solid primary; chips are quiet selection, not a second Canon job door.

## Relation to earlier lean

Settled positions said “option A filter-first until dogfood.” **Superseded by this ruling:** the principle (readable question) stands; the mechanism is **B with threshold**, because pure A fails the 5-node case the sprint explicitly called out.

— ox | Network answers a finishable question; slice when unreadable; whole graph when small
