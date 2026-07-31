# CALM_BUDGET

**Status:** enforceable density bar (docs-only)  
**Date:** 2026-07-31  
**Authority:** numbers here are the pass/fail bar for surface density. Doctrine stays in [IA_MAP.md](./IA_MAP.md) §12 and [03-ux.md](./03-ux.md). Evidence in [research/ui-ux/](./research/ui-ux/) (esp. [07](./research/ui-ux/07-overwhelm-evidence.md)).  
**Audit baseline:** `e2e/output/density-audit.md` + `e2e/output/density/metrics.json` (dolphin QA3, head noted in audit).  
**Future:** badger asserts these keys once e2e is deterministic.

---

## How to measure

Viewport defaults unless noted: **1440×900** desktop, **390×844** narrow. Theme light. Rails in product default open state (not Focus).

| Metric key | How to read from audit / script |
|------------|----------------------------------|
| `workPct` | workspace width ÷ viewport width × 100 |
| `chromePct` | (binder + agent) width ÷ viewport × 100 |
| `binderPct` / `agentPct` | each rail width ÷ viewport × 100 |
| `topPrimaryCount` | topbar controls with primary/solid weight (not ghost/quiet) |
| `ecosystemVisible` | Draft · Lab · Canon controls present and labeled |
| `faceTabCount` | visible companion face tabs (not overflow menu items) |
| `chipVisibleCount` | fully expanded filter/tag chips in one strip (not +N overflow) |
| `kindPickerSets` | distinct Lab kind chooser rows (filter vs composer vs Spark) |
| `touchFail` | interactive hits with min(width,height) < 44 on narrow |
| `overflowX` | `scrollWidth > clientWidth` |

**Primary action** = competing choice at equal decision weight (solid/primary button, or peer chip in an always-expanded strip). Quiet selected-state toggles inside one segmented control count as **one** choice set, not N primaries.

---

## Budgets

### B1 — Work column owns the desk (1440, dual rails default)

| Budget | Limit | Why (one line) |
|--------|------:|----------------|
| `workPct` | **≥ 55** | Extraneous load: manuscript is the job; minority work column is cockpit failure (CLT extraneous · IA §12 default calm). |
| `chromePct` | **≤ 45** | Dual rails must not exceed work; Hick/choice load rises when chrome is the visual majority. |
| `binderPct` | **≤ 24** | Single nav chunk; rail is recognition list, not a second app. |
| `agentPct` | **≤ 24** | Companion is optional help (IDE sidebar pattern), not a peer manuscript. |

**Baseline (audit draft/lab/canon @1440 light):** `workPct=47` · `chromePct=53` · rails `26/26` → **FAIL** (bear rail work).

---

### B2 — Top bar primary weight (1440 + 390)

| Budget | Limit | Why |
|--------|------:|-----|
| `topPrimaryCount` | **≤ 1** | One primary job cue max; equal solid peers recreate Hick freeze (07 Hick/choice · IA §12.3). |
| Continuity / Export / Research / Review as top `primary` | **0** | Job tools are L2 (Check/overflow), not L0 (IA §12.2–12.3 · 06 altitude map). |
| `ecosystemVisible` | **true** on 1440 **and** 390 | Wayfinding trio requires place switch; depth law fails if ecosystems vanish on phone (03 nav · audit fault 7). |
| Topbar equal-weight job actions beyond ecosystem segment | **0** permanent | Serial position + calm set: identity · ecosystems · save · focus · companion only (IA §12.1). |

**Baseline:** Continuity `ui-button--primary` on Draft; 390 top labels keep Continuity and **drop** Draft/Lab/Canon → **FAIL** hierarchy + **FAIL** narrow ecosystems.  
*(Post density-topbar merges may have moved Continuity; re-measure before closing.)*

---

### B3 — Companion faces

| Budget | Limit | Why |
|--------|------:|-----|
| `faceTabCount` visible | **≤ 3** primary; extra only in overflow | Locked product rule ([03-ux.md](./03-ux.md) ≤3 face tabs) + progressive disclosure; 07 maps faces to ≤~3–5 learned chunks. |
| Writing default visible set | **≤ 3** (e.g. Chat · Check · Inbox badge path) | Five equal tabs is permanent mode wall (audit fault 6 · choice overload). |
| Lab / Graph visible faces | **≤ 3** | Already the calm pattern (Chat·Spark·Inbox / Chat·Inspect·Inbox). |
| Footer primaries in companion | **≤ 1** | [03-ux.md](./03-ux.md) ≤1 footer primary; gates stay explicit without button shouting. |

**Baseline @1440:** writing faces Chat/Write/Check/Research/Inbox = **5** → **FAIL**. Lab=3 · Graph=3 → **PASS**.

---

### B4 — Chips and kind pickers

| Budget | Limit | Why |
|--------|------:|-----|
| `chipVisibleCount` (craft tags, desktop) | **≤ 5** before collapse (`Tags +` / +N) | [03-ux.md](./03-ux.md) flags >~5–7 chips without overflow; Miller chunking is a heuristic, not a hard 7-law. |
| `chipVisibleCount` (craft tags, narrow) | **≤ 1** control when collapsed (selected may show) | Narrow already collapses; keep it (audit non-fault). |
| Lab `kindPickerSets` | **≤ 1** visible chooser | Duplicate filter+composer kind rows double n for the same decision (Hick · audit fault 3). |
| Lab kind chips in that one chooser | **≤ 7** including All, else select/overflow | One chunked set beats two walls of 7. |
| Canon map: view toggles vs kind filters | **separate** hierarchy (view > filter) | Views are navigation; filters are not destinations (03 nav · audit fault 4). |
| Canon propose form default | **collapsed** until intent | Always-open form steals work column (disclosure · audit fault 4). |

**Baseline @1440:** craft `n=8` expanded → **FAIL**. Lab work labels duplicate Beat…Motif (filter+composer) → **FAIL** `kindPickerSets≥2`. Narrow craft collapse → **PASS**.

---

### B5 — Touch and overflow

| Budget | Limit | Why |
|--------|------:|-----|
| Min hit target on **390** profile | **≥ 44×44** CSS px | [03-ux.md](./03-ux.md) touch ≥44 · Fitts (07 Laws cluster) · WCAG-class touch. |
| `touchFail` on 390 (chrome + primary paths) | **0** | Icon 32×32 topbar fails audit fault 10. |
| `overflowX` any listed surface | **false** | Horizontal scroll is pure extraneous load. |
| Focus mode work dominance | rails hidden; type column only | J1 purity lock (IA §12.4); not re-budged here beyond “Focus clears B1 chrome.” |

**Baseline:** draft 390 `touchFail=13` (icons 32) → **FAIL**. Overflow false on captured surfaces → **PASS**.

---

### B6 — Region primary-action caps (simultaneous)

Count **visible primary-weight or equal-peer** actions in the region at rest (empty/idle bench, not mid-modal).

| Region | Max simultaneous primaries | Why |
|--------|--------------------------:|-----|
| Top bar (ex-ecosystem segment) | **0–1** quiet utilities; **0** solid job CTAs | L0 calm set only. |
| Draft work header (excl. page body) | **≤ 2** (e.g. paper profile + tags control) | Prose is the job; chip walls compete with first sentence. |
| Lab bench chrome | **≤ 3** (board/filter mode · one kind control · New card) | Empty bench must not present 14 kind buttons. |
| Canon map chrome | **≤ 4** (view segment · filter control · propose entry · rare overflow) | Map must remain the primary visual. |
| Companion chrome (faces + one footer primary) | faces per B3 + **≤1** footer primary | Transcript is the surface. |
| Binder list mode | **≤ 2** global list actions | Navigator, not editor. |

**Baseline:** Lab `workN=18` with duplicated kinds → **FAIL**. Draft header 8 craft chips + paper → **FAIL**. Canon map Network/Family equal to filters + open propose → **FAIL** hierarchy.

---

## Scoreboard (audit baseline → budget)

| ID | Budget | Baseline | Status |
|----|--------|----------|--------|
| B1 | work ≥55 / chrome ≤45 @1440 | 47 / 53 | **FAIL** |
| B2a | Continuity not top primary | primary CTA on Draft | **FAIL**\* |
| B2b | ecosystems visible @390 | missing Draft/Lab/Canon | **FAIL**\* |
| B3 | face tabs ≤3 writing | 5 faces | **FAIL** |
| B3 | face tabs ≤3 lab/graph | 3 / 3 | **PASS** |
| B4a | craft chips ≤5 desktop | 8 | **FAIL** |
| B4b | craft collapse narrow | Tags+ pattern | **PASS** |
| B4c | Lab kindPickerSets ≤1 | filter + composer | **FAIL** |
| B5a | touch ≥44 @390 | 32px icons; touchFail>0 | **FAIL** |
| B5b | no overflowX | false | **PASS** |

\*Re-run metrics after Continuity-topbar / narrow-ecosystem merges before filing regressions.

---

## Out of scope (do not encode here)

- New ecosystems, panels, or depth rules → [IA_MAP.md](./IA_MAP.md)
- Gate verbs Apply/Accept → [IA_MAP.md](./IA_MAP.md) §8 · research 05
- Visual tokens / hex → [design/TOKENS.md](./design/TOKENS.md)
- Aesthetic taste without a metric

---

## Assertion sketch (for badger later)

```text
assert workPct(1440, rails=default) >= 55
assert chromePct(1440, rails=default) <= 45
assert topPrimaryJobCTAs(continuity|export|research|review) == 0
assert ecosystemVisible(390) == true
assert faceTabCount(context=writing) <= 3
assert craftChipVisible(1440) <= 5
assert labKindPickerSets <= 1
assert touchFail(390, chrome) == 0
assert overflowX(*) == false
```

Driver today: `e2e/density-audit.mjs` → `e2e/output/density/metrics.json`.

---

## One-line bar

**At 1440 the page owns ≥55% width; no L0 solid job CTAs; ≤3 face tabs; ≤5 chips before collapse; one Lab kind picker; ≥44px touch on 390; no horizontal overflow.**
