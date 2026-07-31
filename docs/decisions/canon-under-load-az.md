# Design ruling — Canon under load (TASK AZ)

**From:** ox  
**To:** rat · octopus · pig  
**Status:** binding product read  
**Evidence:** `e2e/output/canon-under-load-az.md` · HEAD `9e432d3` · 68 sheets / 195 edges · 1440 + 390  
**Cite:** empty-Canon demote · B6-primary-per-job · item-4 binder push stack · D4 family-sparse nit (closed)

## Verdict strip

| Question | Ruling |
|---|---|
| Full Canon empty-demote / B6 / dirty-leave | **HOLD** — no reopen |
| Binder list @68 | Navigable; kind sections enough; **no search build** from 68 |
| Family under multi-gen mesh | **Not sparse** — D4 sparsity nit **CLOSED** |
| Network @68 | **Hairball** — product model open (not a density false-green) |
| Binder scroll restore after detail Back | **REGRESSION — fix** (highest AZ ship item) |

---

## 1. Binder scroll restore — **P0 product bug**

| | @1440 |
|---|---|
| preOpenScroll | 2080 |
| restoredScrollTop | 1147 |
| delta | **−933** |

Dirty-leave dialog path is fine. **Clean Back from a deep sheet loses list position.** Same stack as today’s push + `listScrollTopRef`.

**Required:** restore binder list scrollTop to pre-open value on detail pop (Back), both rail @1440 and drawer @390.

**Not:** redesign binder, virtualize rows, or fold sections.

This is the only AZ item that should open an implement tip before settle.

---

## 2. Network under load — product call, not a layout hotfix

Fixed `800×520`, 68 nodes, 195 edges, minDist **25.1**, closePairs **68**, dense initials only.

Dense mode is **honest** (hides full names to reduce collision) and still **unusable as a cast directory**. Character filter recovers (36 / minDist 47 / close 0) — filters are the real escape hatch today.

### Options (pick later; not settle-blocking)

| Option | Meaning | Ox lean |
|---|---|---|
| **A. Accept + filter-first** | Network at full cast is overview-only; author must filter/kind before reading names | Honest default if chrome teaches it |
| **B. Default filter** | Land on last-used kind or Characters when N≥threshold | Reduces first-paint hairball |
| **C. Cluster / expand** | Group by kind or org, expand on demand | Heavier; real graph product |
| **D. Pan/zoom + larger canvas** | Escape fixed 800×520 | Helps geometry; does not fix 195-edge hairball alone |

**Not now:** pretend initials+packing is a directory. **Not now:** build search to paper over Network.

**Settle rule:** document Network@scale as known limit; do **not** open C/D in the density pass. Optional one-line chrome later (“Filter to read names”) if authors hit this cold — copy only, ox nouns later.

---

## 3. Family — D4 sparsity **CLOSED**

| metric | value |
|---|---|
| nodes | 36 kinship |
| minDist | **81** |
| close &lt;28 | **0** |
| labels | full names |
| viewBox | wide tree (`2334×856`), canvas scrolls |

Family under multi-generation mesh is **usable**. Old “family sparse under load” curiosity does **not** reproduce as emptiness.

**Residual (not sparsity):** long horizontal tree may need pan affordance later. Re-verify Family@390 (probe once failed to stick view) before any Family chrome tip. **No fill-the-family work.**

---

## 4. Full Canon holds today’s demote/B6 letter

| check | @68 sheets |
|---|---|
| New sheet | **primary** (demote only true-empty) |
| B6 maxPerJob | **1** |
| Send proposal solid | absent (sheets ≫ 2; gate N/A) |
| Dirty-leave | dialog works under long list |
| graph empty | false |

Empty-Canon and full-Canon are different states — fixtures must keep covering both. No change to demote rules from AZ.

---

## 5. Binder list / kinds / search

- **4 sheet kinds** in product (character, lore, world, organization). Not seven. Drop “seven kinds” premise in briefs.
- Kind section heads + counts carry the job at 68.
- Graph kind filters work and are load-critical for Network.
- **Search:** comfort above ~30/kind; **not must-ship from AZ.** Do not open search from this report.

---

## 6. Class-over-instance (same lesson as Lab BA)

Network hairball and binder scroll loss **present under the same seed** and are **different defects** (viz model vs navigation state). Fix restore without “fixing density.” Do not scrollbar-wash Network.

---

## Disposition / queue

| Item | Action |
|---|---|
| Binder scroll restore | **Tip implement** — P0, scoped, no redesign |
| Network@scale | **Known limit** — model choice deferred; no density hotfix |
| Family sparsity (D4) | **CLOSED** |
| Search | **Do not build** from AZ |
| Empty demote / B6 / dirty-leave | **HOLD** |
| After restore tip + B6-runnable-solid seed proof | **Settle** — stop adding under-load surfaces |

## Non-goals

- Canon virtualization
- New graph layout algorithm in density pass
- Phone Family chrome until re-measured
- Changing sheet kind taxonomy

— ox | restore the list; Network is a model problem; Family is fine; then stop
