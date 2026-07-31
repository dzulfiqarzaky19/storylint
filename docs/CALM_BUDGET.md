# CALM_BUDGET

**Status:** enforceable density bar (docs-only) · **r2** (ox Task Q + rat Task R)  
**Date:** 2026-07-31  
**Owns:** measurable density **numbers** + severity (HARD/WARN). **Does not own:** IA structure (three ecosystems, depth, Continuity placement) — that is [IA_MAP.md](./IA_MAP.md); this file only budgets chrome that implements it.
**Authority:** numbers + severity here are the pass/fail bar for surface density. Doctrine stays in [IA_MAP.md](./IA_MAP.md) §12 and [03-ux.md](./03-ux.md). Evidence in [research/ui-ux/](./research/ui-ux/) (esp. [07](./research/ui-ux/07-overwhelm-evidence.md)). Design authority memo: [decisions/calm-budget-authority-ox.md](./decisions/calm-budget-authority-ox.md). Scoreboard measurement: [e2e/output/calm-budget-run.md](../e2e/output/calm-budget-run.md) (tracked).  
**Baseline head for scoreboard:** re-measure on **dev ≥ `5db610c`** (includes Continuity-off-topbar, narrow ecosystems, D3/D8 density, D6 companion). Older QA3 at pre-fix heads is historical only.  
**Future:** badger asserts **HARD** keys once e2e is deterministic. **WARN** = scoreboard only until two review rounds agree.

---

## Severity

| Level | Meaning |
|-------|---------|
| **HARD** | Merge blocker when assertion exists **and** the related feature has landed |
| **WARN** | Scoreboard / review signal only until two rounds agree |

**Principle:** a budget that passes while the UI still feels loud is worse than none. Width ratios alone are incomplete without **structure / fold / resting-state / truncation / wrap** checks.

---

## How to measure

Viewports: **1440×900** desktop, **390×844** narrow. Theme light. Rails in product **default open** state (not Focus). Prefer **viewport** shares, not full-document geometry when they diverge.

| Metric key | Definition |
|------------|------------|
| `workPct` | work surface width ÷ viewport width × 100 |
| `chromePct` | (binder + agent) width ÷ viewport × 100 |
| `binderPct` / `agentPct` | each rail ÷ viewport × 100 |
| `topJobPrimaryCount` | topbar **job** controls with primary/solid weight (not place switches) |
| `ecosystemVisible` | count of labeled Draft · Lab · Canon controls |
| `placeLabelClipped` | any place label ellipsized/clipped @390 |
| `faceTabCount` | faces in the product set for the context |
| `faceRows` | wrapped rows of face tabs @ viewport |
| `chipVisibleCount` | fully expanded chips in one strip (excludes +N / Tags+ control) |
| `kindFullStrips` | count of **full** Lab kind strips (filter+composer both full = 2) |
| `labFilterWhenEmpty` | filter strip present when card count = 0 |
| `touchFailChrome` | topbar / faces / disclosures / ecosystems with min(w,h) < 44 @390 |
| `overflowX` | `scrollWidth > clientWidth` |
| `foldOwner` | largest center-band box in the **first viewport** |
| `checkRestHasStatus` | Check idle shows ≥1 helper line **or** last-run status |
| `chatProposalsWall` | pending proposals rendered as a wall on Chat (badge-only is OK) |

**Job primary** = Continuity · Export · Research · Review · New (peers) as solid/primary in the **top bar**.  
**Place controls** (Draft / Lab / Canon) are wayfinding — pressed place must **not** count as a job primary.  
One segmented control = one choice set, not N primaries.

---

## Budgets

### B1 — Work vs rails @1440 (default dual rails)

| ID | Rule | Sev | Why |
|----|------|-----|-----|
| B1-work-hard | `workPct` **≥ 40** | **HARD** | Below ~40% the manuscript stops being the job (CLT extraneous). |
| B1-work-warn | `workPct` **< 45** | **WARN** | Soft push toward paper majority; fires only when work drops under 45. R1 accepted-calm Draft ~47 is **above** this band (no WARN). |
| B1-rail-warn | either rail **> 24** or `chromePct` **> 58** | **WARN** | Dual-rail ~53 chrome is **expected**, not soft-fail. WARN only past ~58 or fat single rail — do not force collapse to manufacture work%. |
| B1-rail-pathological | either rail width **>** work width | **HARD** | Chrome owns the desk. |
| B1-fold | `foldOwner` = work surface (paper / lab bench / map) | **HARD** | Page-% can pass while a form steals the fold (Canon sheet-in-binder class). |

**Dropped:** HARD `workPct ≥ 55` (too tight for accepted dual-rail Draft).

---

### B2 — Top bar jobs + ecosystems

| ID | Rule | Sev | Why |
|----|------|-----|-----|
| B2-job-primary | Continuity / Export / Research / Review / New as top primary = **0** | **HARD** | Job tools are L2 (IA §12.2–12.3). |
| B2-job-count | `topJobPrimaryCount` **≤ 0** | **HARD** | Places are not job primaries. |
| B2-ecosystem | `ecosystemVisible` **= 3** on 1440 **and** 390 | **HARD** | Wayfinding; depth law on phone. |
| B2-truncation | `placeLabelClipped` **= 0** @390 | **HARD** | Visible-but-clipped “Ca” lies to count-based metrics (R1 P2). |
| B2-top-count-warn | topbar controls **> 8** @390 without overflow pattern | **WARN** | Crowded phone chrome. |

---

### B3 — Companion faces (not a product redesign gate)

| ID | Rule | Sev | Why |
|----|------|-----|-----|
| B3-writing-count | writing faces **≤ 5** (Chat · Write · Check · Research · Inbox) | **HARD** ceiling | Shipped IA; **≤3 is not a density gate** (product change). D6 may show fewer via More — still ≤5. |
| B3-lab-count | lab faces **≤ 3** | **HARD** | Chat · Spark · Inbox. |
| B3-graph-count | graph faces **≤ 3** | **HARD** | Chat · Inspect · Inbox. |
| B3-wrap | `faceRows` @390 **= 1** | **HARD** | Real narrow fail is wrap, not count (R1 P3). |
| B3-overflow-shape | extras only behind **one** labeled More (no second free row) | **HARD** | Disclosure without a new chrome band. |
| B3-footer-primary | footer primary **≤ 1** | **HARD** | [03-ux.md](./03-ux.md). |
| B3-footer-total | footer actions ≤3 **WARN**; **≥4 HARD** | WARN/HARD | Footer ≠ tool wall. |
| B3-default-face | writing default **= Chat** | **HARD** | Not Check-as-home. |
| B3-rest | Check resting: helper line **or** last-run status | **HARD** | Empty middle + footer-only is loud silence (R1 P4). |
| B3-inbox-wall | `chatProposalsWall` **= false** (Inbox badge OK) | **HARD** | Chat is transcript, not pending dump. |

---

### B4 — Chips, Lab kinds, Canon

| ID | Rule | Sev | Why |
|----|------|-----|-----|
| B4-craft-desktop | craft visible **≤ 5** + one overflow control | **HARD** | [03-ux.md](./03-ux.md) chip overflow; D8 pattern. |
| B4-craft-phone | craft collapsed disclosure default @390 | **HARD** | Keep narrow win. |
| B4-lab-empty-filter | no Lab filter strip when cards = 0 | **HARD** | D3 empty-bench calm. |
| B4-lab-kind-strips | `kindFullStrips` **≤ 1** | **HARD** | One full kind strip max; composer may own kinds; filter must not duplicate full set. Empty lab composer-only **passes**. |
| B4-canon-propose | propose form collapsed until intent | **WARN** until D4 lands → **HARD** after | Don’t CI-block known P1 pre-D4. |
| B4-canon-view | view switch accent **>** kind filter weight | **WARN** until D4 → **HARD** after | Views navigate; filters aren’t destinations. |

---

### B5 — Touch + overflow

| ID | Rule | Sev | Why |
|----|------|-----|-----|
| B5-touch-chrome | min hit **≥ 44×44** @390 for topbar, faces, disclosures, ecosystems | **HARD** | [03-ux.md](./03-ux.md) · Fitts. |
| B5-touch-fail | `touchFailChrome` **= 0** | **HARD** | Same chrome scope. |
| B5-overflow | `overflowX` **= false** | **HARD** | Extraneous horizontal scroll. |
| B5-graph-nodes | SVG node radius vs 44 | **WARN** only | Not chrome; don’t fail the app on node geometry. |
| B5-focus | Focus hides rails; type column only | **HARD** smoke | IA §12.4 J1 purity. |

---

### B6 — Region caps at rest

Chrome control = labeled button/chip/tab in the region chrome band (not page body).

| ID | Region | Rule | Sev |
|----|--------|------|-----|
| B6-top-job | Top bar | solid job primaries **= 0** | **HARD** |
| B6-draft-header | Draft header | title+meta OK; extra chrome **≤2** | **WARN** (HARD later if thrash-free) |
| B6-lab-chrome | Lab | empty composer is work; extra chrome **≤3** | **WARN** |
| B6-canon-chrome | Canon map | propose **collapsed** by default; when D4 lands pin **≤ 4** chrome peers (view · filter · propose entry · overflow) | **HARD** post-D4 |
| B6-companion | Companion | owned by B3 | via B3 |
| B6-binder | Binder list | global list actions **≤2** | **WARN** |

---

## Scoreboard (re-read on dev ≥ `5db610c`)

Code/docs pass where marked **code**; layout % still needs a fresh density run (**measure**).

| ID | Sev | Current read | Status |
|----|-----|--------------|--------|
| B1-work-hard ≥40 | HARD | last QA3 workPct=47 | **PASS** (ratio); confirm on new run |
| B1-work-warn <45 | WARN | 47 ≥ 45 | **PASS** on warn band (WARN only if work <45) |
| B1-rail-warn chrome>58 | WARN | ~53 dual-rail expected | **PASS** expected at ~53; WARN only >58 |
| B1-fold | HARD | sheet-in-binder history | **measure** foldOwner |
| B2-job-primary | HARD | Continuity removed from topbar (`8911406` line) | **PASS** code; confirm DOM |
| B2-ecosystem | HARD | narrow ecosystems retained (`fef1406` line) | **PASS** code; confirm @390 |
| B2-truncation | HARD | not in old metrics | **measure** |
| B3-writing-count ≤5 | HARD | D6: Chat Write Check + More→Research; Inbox badge path | **PASS** ceiling |
| B3-wrap / overflow-shape | HARD | D6 More pattern | **measure** @390 one row |
| B3-rest | HARD | not asserted | **measure** / likely **FAIL** until shipped |
| B3-inbox-wall | HARD | badge doctrine | **measure** |
| B4-craft ≤5 | HARD | D8 craft collapse on desktop path | **PASS** expected; confirm count |
| B4-lab empty filter + strips | HARD | D3 lab filter work | **PASS** expected; confirm empty bench |
| B4-canon propose/view | WARN | pre-D4 | **WARN** until D4 |
| B5-touch-chrome | HARD | 32px icons in old audit | **measure** (likely **FAIL** if unchanged) |
| B5-overflow | HARD | old audit clean | **PASS** expected |
| B6-top-job | HARD | = B2 | **PASS** with B2 |

**Historical QA3 only:** work 47/53, Continuity primary, writing 5 faces, craft 8, lab dual kind strips, touchFail>0. Do not treat as current fail list after `5db610c`.

---

## Must-have measures (next audit driver)

1. Check resting emptiness — B3-rest  
2. First-fold ownership — B1-fold  
3. Place-label truncation @390 — B2-truncation  
4. Face wrap rows @390 — B3-wrap  
5. Job vs journey accent hierarchy — B4-canon-view (HARD post-D4)  
6. Duplicate Lab kind strips — B4-lab-kind-strips  
7. Chat proposals wall vs Inbox badge — B3-inbox-wall  

---

## Out of scope

- New ecosystems / panels / depth → [IA_MAP.md](./IA_MAP.md)  
- Apply/Accept verbs → IA_MAP §8 · research 05  
- Tokens → [design/TOKENS.md](./design/TOKENS.md)  
- Graph node hit geometry as chrome touch  
- Face-count product redesign (≤3 writing) as a density HARD  

---

## Assertion sketch (HARD only)

```text
assert workPct(1440, rails=default) >= 40
assert not (railWidth > workWidth)
assert foldOwner(firstViewport) == workSurface
assert topJobPrimaryCount(continuity|export|research|review|new) == 0
assert ecosystemVisible(1440) == 3 && ecosystemVisible(390) == 3
assert placeLabelClipped(390) == 0
assert faceTabCount(writing) <= 5 && faceTabCount(lab) <= 3 && faceTabCount(graph) <= 3
assert faceRows(390) == 1
assert defaultFace(writing) == Chat
assert checkRestHasStatus == true
assert chatProposalsWall == false
assert craftChipVisible(1440) <= 5
assert craftCollapsedDefault(390) == true
assert labFilterAbsentWhenEmpty == true
assert kindFullStrips(lab) <= 1
assert touchFailChrome(390) == 0
assert overflowX(*) == false
// post-D4:
// assert canonProposeDefaultCollapsed == true
// assert viewAccentWeight > filterAccentWeight
```

Extend `e2e/density-audit.mjs` → `metrics.json` for fold / wrap / rest / truncation.

---

## One-line bar

**Work ≥40% (warn under 45); fold owned by work; zero L0 job primaries; three unclipped ecosystems on phone; writing faces ≤5 with one row @390; Check never empty-rest; ≤5 craft chips; one Lab kind strip; chrome touch ≥44; no overflowX; no proposal wall on Chat.**
