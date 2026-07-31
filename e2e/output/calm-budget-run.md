# CALM_BUDGET run

**When:** 2026-07-31T18:55:39.286Z
**UI:** http://localhost:5173/
**HEAD:** 0510b22
**Branch tip note:** measured live DOM (dev server), not threshold-tuned.

## Summary

| | Count |
|--|--:|
| PASS | 43 |
| WARN (fail band) | 1 |
| HARD FAIL | 3 |
| Total checks | 47 |

**Exit:** nonzero (HARD fail)

## Scoreboard

| Status | ID | Sev | Measured | Threshold | Surface | Doc |
|--------|----|-----|----------|-----------|---------|-----|
| PASS | B1-work-hard | HARD | workPct=47.2 | ≥40 | Draft@1440 | CALM_BUDGET.md B1-work-hard · workPct ≥ 40 |
| PASS | B1-work-warn | WARN | workPct=47.2 | ≥45 preferred (WARN if <45) | Draft@1440 | CALM_BUDGET.md B1-work-warn · workPct < 45 warns |
| WARN | B1-rail-warn | WARN | binder=26.4 agent=26.4 chrome=52.8 | rails≤24, chrome≤55 | Draft@1440 | CALM_BUDGET.md B1-rail-warn · rail>24 or chrome>55 |
| PASS | B1-rail-pathological | HARD | binderW=380 agentW=380 workW=680 | each rail ≤ work | Draft@1440 | CALM_BUDGET.md B1-rail-pathological · rail > work |
| PASS | B1-fold | HARD | foldOwner=work (manuscript) | work | Draft@1440 | CALM_BUDGET.md B1-fold · foldOwner = work |
| PASS | B2-job-primary@1440 | HARD | topJobPrimaryCount=0 | =0 | topbar@1440 | CALM_BUDGET.md B2-job-primary · Continuity/Export/Research/Review/New top primary = 0 |
| PASS | B2-ecosystem@1440 | HARD | ecosystemVisible=3 [Draft,Lab,Canon] | =3 | topbar@1440 | CALM_BUDGET.md B2-ecosystem · ecosystemVisible = 3 |
| PASS | B3-writing-count@1440 | HARD | productFaces=4 [Chat · Write · Check · Inbox] more=true | ≤5 | companion writing@1440 | CALM_BUDGET.md B3-writing-count · writing faces ≤ 5 |
| PASS | B3-default-face@1440 | HARD | face=chat | chat | companion@1440 | CALM_BUDGET.md B3-default-face · writing default = Chat |
| PASS | B3-inbox-wall@1440 | HARD | chatProposalsWall=false | false | companion chat@1440 | CALM_BUDGET.md B3-inbox-wall · chatProposalsWall = false |
| PASS | B3-footer-primary-chat@1440 | HARD | footerPrimary=1 | ≤1 | companion chat@1440 | CALM_BUDGET.md B3-footer-primary · footer primary ≤ 1 |
| PASS | B3-footer-total-chat@1440 | WARN | footerTotal=1 | ≤3 | companion chat@1440 | CALM_BUDGET.md B3-footer-total · ≤3 WARN, ≥4 HARD |
| PASS | B3-rest@1440 | HARD | checkRestHasStatus=true | true | companion Check@1440 | CALM_BUDGET.md B3-rest · Check resting helper or last-run status |
| PASS | B3-footer-primary-check@1440 | HARD | footerPrimary=1 | ≤1 | companion Check@1440 | CALM_BUDGET.md B3-footer-primary · footer primary ≤ 1 |
| PASS | B3-lab-count@1440 | HARD | productFaces=3 [Chat · Spark · Inbox] | ≤3 | companion lab@1440 | CALM_BUDGET.md B3-lab-count · lab faces ≤ 3 |
| PASS | B3-graph-count@1440 | HARD | productFaces=3 [Chat · Inspect · Inbox] | ≤3 | companion graph@1440 | CALM_BUDGET.md B3-graph-count · graph faces ≤ 3 |
| PASS | B4-lab-empty-filter@1440 | HARD | cards=0 filterWhenEmpty=false | false | Lab@1440 | CALM_BUDGET.md B4-lab-empty-filter · no filter when cards=0 |
| PASS | B4-lab-kind-strips@1440 | HARD | kindFullStrips=1 | ≤1 | Lab@1440 | CALM_BUDGET.md B4-lab-kind-strips · kindFullStrips ≤ 1 |
| PASS | B4-craft-desktop | HARD | chipVisibleCount=5 [char-dev,plot-progress,twist,world-build,relationship] | ≤5 | Draft craft@1440 | CALM_BUDGET.md B4-craft-desktop · craft visible ≤ 5 + overflow |
| PASS | B4-canon-propose@1440 | WARN | proposeExpanded=false | collapsed | Canon@1440 | CALM_BUDGET.md B4-canon-propose · propose collapsed until D4 (WARN) |
| PASS | B4-canon-view@1440 | WARN | viewW=2 filterW=2 | view ≥ filter | Canon@1440 | CALM_BUDGET.md B4-canon-view · view accent > kind filter (WARN pre-D4) |
| PASS | B5-overflow@1440 | HARD | overflowX=false | false | shell@1440 | CALM_BUDGET.md B5-overflow · overflowX = false |
| PASS | B5-focus | HARD | focus=true binder=false work=true | focus + work, no binder | Focus mode | CALM_BUDGET.md B5-focus · Focus hides rails; type column only |
| PASS | B6-top-job | HARD | topJobPrimaryCount=0 | =0 | topbar | CALM_BUDGET.md B6-top-job · solid job primaries = 0 |
| PASS | B2-job-primary@390 | HARD | topJobPrimaryCount=0 | =0 | topbar@390 | CALM_BUDGET.md B2-job-primary · Continuity/Export/Research/Review/New top primary = 0 |
| PASS | B2-ecosystem@390 | HARD | ecosystemVisible=3 [Draft,Lab,Canon] | =3 | topbar@390 | CALM_BUDGET.md B2-ecosystem · ecosystemVisible = 3 |
| PASS | B2-truncation | HARD | placeLabelClipped=0 | =0 | topbar@390 | CALM_BUDGET.md B2-truncation · placeLabelClipped = 0 @390 |
| PASS | B2-top-count-warn | WARN | topControlCount=7 | ≤8 | topbar@390 | CALM_BUDGET.md B2-top-count-warn · top controls > 8 without overflow |
| PASS | B3-writing-count@390 | HARD | productFaces=4 [Chat · Write · Check · Inbox] more=true | ≤5 | companion writing@390 | CALM_BUDGET.md B3-writing-count · writing faces ≤ 5 |
| PASS | B3-default-face@390 | HARD | face=chat | chat | companion@390 | CALM_BUDGET.md B3-default-face · writing default = Chat |
| PASS | B3-inbox-wall@390 | HARD | chatProposalsWall=false | false | companion chat@390 | CALM_BUDGET.md B3-inbox-wall · chatProposalsWall = false |
| PASS | B3-wrap | HARD | faceRows=1 labels=[Chat · Write · Check · Inbox · More] | =1 | companion@390 | CALM_BUDGET.md B3-wrap · faceRows @390 = 1 |
| PASS | B3-overflow-shape | HARD | rows=1 hasMore=true | one row; More ok | companion@390 | CALM_BUDGET.md B3-overflow-shape · extras behind one More |
| PASS | B3-footer-primary-chat@390 | HARD | footerPrimary=1 | ≤1 | companion chat@390 | CALM_BUDGET.md B3-footer-primary · footer primary ≤ 1 |
| PASS | B3-footer-total-chat@390 | WARN | footerTotal=1 | ≤3 | companion chat@390 | CALM_BUDGET.md B3-footer-total · ≤3 WARN, ≥4 HARD |
| PASS | B3-rest@390 | HARD | checkRestHasStatus=true | true | companion Check@390 | CALM_BUDGET.md B3-rest · Check resting helper or last-run status |
| PASS | B3-footer-primary-check@390 | HARD | footerPrimary=1 | ≤1 | companion Check@390 | CALM_BUDGET.md B3-footer-primary · footer primary ≤ 1 |
| PASS | B3-lab-count@390 | HARD | productFaces=3 [Chat · Spark · Inbox] | ≤3 | companion lab@390 | CALM_BUDGET.md B3-lab-count · lab faces ≤ 3 |
| PASS | B3-graph-count@390 | HARD | productFaces=3 [Chat · Inspect · Inbox] | ≤3 | companion graph@390 | CALM_BUDGET.md B3-graph-count · graph faces ≤ 3 |
| PASS | B4-lab-empty-filter@390 | HARD | cards=0 filterWhenEmpty=false | false | Lab@390 | CALM_BUDGET.md B4-lab-empty-filter · no filter when cards=0 |
| PASS | B4-lab-kind-strips@390 | HARD | kindFullStrips=1 | ≤1 | Lab@390 | CALM_BUDGET.md B4-lab-kind-strips · kindFullStrips ≤ 1 |
| FAIL | B4-craft-phone | HARD | collapsed=false chips=8 | true | Draft craft@390 | CALM_BUDGET.md B4-craft-phone · craft collapsed disclosure default @390 |
| PASS | B4-canon-propose@390 | WARN | proposeExpanded=false | collapsed | Canon@390 | CALM_BUDGET.md B4-canon-propose · propose collapsed until D4 (WARN) |
| PASS | B4-canon-view@390 | WARN | viewW=2 filterW=2 | view ≥ filter | Canon@390 | CALM_BUDGET.md B4-canon-view · view accent > kind filter (WARN pre-D4) |
| FAIL | B5-touch-chrome | HARD | touchFailChrome=3 e.g. Project menu 38px | =0 fails | chrome@390 | CALM_BUDGET.md B5-touch-chrome · min hit ≥ 44×44 chrome @390 |
| FAIL | B5-touch-fail | HARD | touchFailChrome=3 | =0 | chrome@390 | CALM_BUDGET.md B5-touch-fail · touchFailChrome = 0 |
| PASS | B5-overflow@390 | HARD | overflowX=false | false | shell@390 | CALM_BUDGET.md B5-overflow · overflowX = false |

## HARD failures

- **B4-craft-phone**: collapsed=false chips=8 (want true) — CALM_BUDGET.md B4-craft-phone · craft collapsed disclosure default @390
- **B5-touch-chrome**: touchFailChrome=3 e.g. Project menu 38px (want =0 fails) — CALM_BUDGET.md B5-touch-chrome · min hit ≥ 44×44 chrome @390
- **B5-touch-fail**: touchFailChrome=3 (want =0) — CALM_BUDGET.md B5-touch-fail · touchFailChrome = 0

## WARN band

- **B1-rail-warn**: binder=26.4 agent=26.4 chrome=52.8 (want rails≤24, chrome≤55) — CALM_BUDGET.md B1-rail-warn · rail>24 or chrome>55

## Notes

- B4-canon-* stay WARN until D4 lands (doc).
- B5-graph-nodes intentionally not asserted as HARD (SVG radii).
- Face chrome uses role=tab (D6). Helpers imported when present; local tab fallback included.
- Offline only: no LLM routes required.
