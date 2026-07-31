# CALM_BUDGET run

**When:** 2026-07-31T20:35:16.396Z
**UI:** http://127.0.0.1:52571/
**HEAD:** e68f272 (e68f2724659d57fa23de69f3d77d0be4bf407d7a)
**Owned:** yes (ephemeral stack)
**UI:** http://127.0.0.1:52571/
**API:** http://127.0.0.1:52570
**Shell.css:** local#2c416be35924 served#2c416be35924
**Dirty tree:** yes
**Helpers:** required e2e/helpers.mjs (no self-contained fallback)
**Project:** e2e-calm-12044-ms9eis9a

## Summary

| | Count |
|--|--:|
| PASS | 49 |
| WARN (fail band) | 0 |
| HARD FAIL | 0 |
| Total checks | 49 |

**Exit:** zero (no HARD fail)

## Scoreboard

| Status | ID | Sev | Measured | Threshold | Surface | Doc |
|--------|----|-----|----------|-----------|---------|-----|
| PASS | B1-work-hard | HARD | workPct=61.1 · rails binder=open/default agent=open/default atDesk=true | ≥40 | Draft@1440 | CALM_BUDGET.md B1-work-hard · workPct ≥ 40 |
| PASS | B1-work-warn | WARN | workPct=61.1 · rails binder=open/default agent=open/default atDesk=true | ≥45 preferred (WARN if <45) | Draft@1440 | CALM_BUDGET.md B1-work-warn · workPct < 45 warns |
| PASS | B1-rail-warn | WARN | binder=19.4 agent=19.4 chrome=38.9 · rails binder=open/default agent=open/default atDesk=true | rails≤24, chrome≤55 | Draft@1440 | CALM_BUDGET.md B1-rail-warn · rail>24 or chrome>55 |
| PASS | B1-rail-pathological | HARD | binderW=280 agentW=280 workW=880 · rails binder=open/default agent=open/default atDesk=true | each rail ≤ work | Draft@1440 | CALM_BUDGET.md B1-rail-pathological · rail > work |
| PASS | B1-fold | HARD | foldOwner=work (manuscript) · rails binder=open/default agent=open/default atDesk=true | work | Draft@1440 | CALM_BUDGET.md B1-fold · foldOwner = work |
| PASS | B2-job-primary@1440 | HARD | topJobPrimaryCount=0 | =0 | topbar@1440 | CALM_BUDGET.md B2-job-primary · Continuity/Export/Research/Review/New top primary = 0 |
| PASS | B2-ecosystem@1440 | HARD | ecosystemVisible=3 [Draft,Lab,Canon] | =3 | topbar@1440 | CALM_BUDGET.md B2-ecosystem · ecosystemVisible = 3 |
| PASS | B3-writing-count@1440 | HARD | productFaces=5 [Chat · Write · Check · Inbox · Research] more=false context=writing | ≤5 | companion writing@1440 | CALM_BUDGET.md B3-writing-count · writing faces ≤ 5 |
| PASS | B3-default-face@1440 | HARD | face=chat context=writing | chat | companion@1440 | CALM_BUDGET.md B3-default-face · writing default = Chat |
| PASS | B3-inbox-wall@1440 | HARD | chatProposalsWall=false | false | companion chat@1440 | CALM_BUDGET.md B3-inbox-wall · chatProposalsWall = false |
| PASS | B3-footer-primary-chat@1440 | HARD | footerPrimary=1 | ≤1 | companion chat@1440 | CALM_BUDGET.md B3-footer-primary · footer primary ≤ 1 |
| PASS | B3-footer-total-chat@1440 | WARN | footerTotal=1 | ≤3 | companion chat@1440 | CALM_BUDGET.md B3-footer-total · ≤3 WARN, ≥4 HARD |
| PASS | B3-rest@1440 | HARD | checkRestHasStatus=true | true | companion Check@1440 | CALM_BUDGET.md B3-rest · Check resting helper or last-run status |
| PASS | B3-footer-primary-check@1440 | HARD | footerPrimary=1 | ≤1 | companion Check@1440 | CALM_BUDGET.md B3-footer-primary · footer primary ≤ 1 |
| PASS | B3-lab-count@1440 | HARD | productFaces=3 [Chat · Spark · Inbox] context=lab | ≤3 | companion lab@1440 | CALM_BUDGET.md B3-lab-count · lab faces ≤ 3 |
| PASS | B3-graph-count@1440 | HARD | productFaces=3 [Chat · Inspect · Inbox] context=graph | ≤3 | companion graph@1440 | CALM_BUDGET.md B3-graph-count · graph faces ≤ 3 |
| PASS | B4-lab-empty-filter@1440 | HARD | cards=0 filterWhenEmpty=false | false | Lab@1440 | CALM_BUDGET.md B4-lab-empty-filter · no filter when cards=0 |
| PASS | B4-lab-kind-strips@1440 | HARD | kindFullStrips=0 | ≤1 | Lab@1440 | CALM_BUDGET.md B4-lab-kind-strips · kindFullStrips ≤ 1 |
| PASS | B4-craft-desktop | HARD | chipVisibleCount=5 [char-dev,plot-progress,world-build,relationship,setup] foundStrip=true | ≤5 | Draft craft@1440 | CALM_BUDGET.md B4-craft-desktop · craft visible ≤ 5 + overflow |
| PASS | B4-canon-propose@1440 | WARN | proposeExpanded=false | collapsed | Canon@1440 | CALM_BUDGET.md B4-canon-propose · propose collapsed until D4 (WARN) |
| PASS | B4-canon-view@1440 | WARN | viewW=2 filterW=2 | view ≥ filter | Canon@1440 | CALM_BUDGET.md B4-canon-view · view accent > kind filter (WARN pre-D4) |
| PASS | B5-overflow@1440 | HARD | overflowX=false | false | shell@1440 | CALM_BUDGET.md B5-overflow · overflowX = false |
| PASS | B5-focus | HARD | focus=true binder=false work=true | focus + work, no binder | Focus mode | CALM_BUDGET.md B5-focus · Focus hides rails; type column only |
| PASS | B6-top-job | HARD | topJobPrimaryCount=0 | =0 | topbar | CALM_BUDGET.md B6-top-job · solid job primaries = 0 |
| PASS | B2-job-primary@390 | HARD | topJobPrimaryCount=0 | =0 | topbar@390 | CALM_BUDGET.md B2-job-primary · Continuity/Export/Research/Review/New top primary = 0 |
| PASS | B2-ecosystem@390 | HARD | ecosystemVisible=3 [Draft,Lab,Canon] | =3 | topbar@390 | CALM_BUDGET.md B2-ecosystem · ecosystemVisible = 3 |
| PASS | B2-truncation | HARD | placeLabelClipped=0 | =0 | topbar@390 | CALM_BUDGET.md B2-truncation · placeLabelClipped = 0 @390 |
| PASS | B2-top-count-warn | WARN | topControlCount=7 | ≤8 | topbar@390 | CALM_BUDGET.md B2-top-count-warn · top controls > 8 without overflow |
| PASS | B3-writing-count@390 | HARD | productFaces=5 [Chat · Write · Check · Inbox · Research] more=false context=writing | ≤5 | companion writing@390 | CALM_BUDGET.md B3-writing-count · writing faces ≤ 5 |
| PASS | B3-default-face@390 | HARD | face=chat context=writing | chat | companion@390 | CALM_BUDGET.md B3-default-face · writing default = Chat |
| PASS | B3-inbox-wall@390 | HARD | chatProposalsWall=false | false | companion chat@390 | CALM_BUDGET.md B3-inbox-wall · chatProposalsWall = false |
| PASS | B3-wrap | HARD | faceRows=1 labels=[Chat · Write · Check · Inbox · Research] | =1 | companion@390 | CALM_BUDGET.md B3-wrap · faceRows @390 = 1 |
| PASS | B3-overflow-shape | HARD | rows=1 hasMore=false | one row; More ok | companion@390 | CALM_BUDGET.md B3-overflow-shape · extras behind one More |
| PASS | B3-footer-primary-chat@390 | HARD | footerPrimary=1 | ≤1 | companion chat@390 | CALM_BUDGET.md B3-footer-primary · footer primary ≤ 1 |
| PASS | B3-footer-total-chat@390 | WARN | footerTotal=1 | ≤3 | companion chat@390 | CALM_BUDGET.md B3-footer-total · ≤3 WARN, ≥4 HARD |
| PASS | B3-rest@390 | HARD | checkRestHasStatus=true | true | companion Check@390 | CALM_BUDGET.md B3-rest · Check resting helper or last-run status |
| PASS | B3-footer-primary-check@390 | HARD | footerPrimary=1 | ≤1 | companion Check@390 | CALM_BUDGET.md B3-footer-primary · footer primary ≤ 1 |
| PASS | B3-lab-count@390 | HARD | productFaces=3 [Chat · Spark · Inbox] context=lab | ≤3 | companion lab@390 | CALM_BUDGET.md B3-lab-count · lab faces ≤ 3 |
| PASS | B3-graph-count@390 | HARD | productFaces=3 [Chat · Inspect · Inbox] context=graph | ≤3 | companion graph@390 | CALM_BUDGET.md B3-graph-count · graph faces ≤ 3 |
| PASS | B4-lab-empty-filter@390 | HARD | cards=0 filterWhenEmpty=false | false | Lab@390 | CALM_BUDGET.md B4-lab-empty-filter · no filter when cards=0 |
| PASS | B4-lab-kind-strips@390 | HARD | kindFullStrips=0 | ≤1 | Lab@390 | CALM_BUDGET.md B4-lab-kind-strips · kindFullStrips ≤ 1 |
| PASS | B4-craft-phone | HARD | collapsed=true chips=0 detailsOpen=false | true (disclosure collapsed; absence ≠ pass) | Draft craft@390 | CALM_BUDGET.md B4-craft-phone · craft collapsed disclosure default @390 |
| PASS | B4-canon-propose@390 | WARN | proposeExpanded=false | collapsed | Canon@390 | CALM_BUDGET.md B4-canon-propose · propose collapsed until D4 (WARN) |
| PASS | B4-canon-view@390 | WARN | viewW=2 filterW=2 | view ≥ filter | Canon@390 | CALM_BUDGET.md B4-canon-view · view accent > kind filter (WARN pre-D4) |
| PASS | B5-touch-chrome | HARD | touchFailChrome=0 | =0 fails | chrome@390 | CALM_BUDGET.md B5-touch-chrome · min hit ≥ 44×44 chrome @390 |
| PASS | B5-touch-fail | HARD | touchFailChrome=0 | =0 | chrome@390 | CALM_BUDGET.md B5-touch-fail · touchFailChrome = 0 |
| PASS | B5-overflow@390 | HARD | overflowX=false | false | shell@390 | CALM_BUDGET.md B5-overflow · overflowX = false |
| PASS | B6-primary-per-job@draft-empty | HARD | maxPerJob=1 solids=1 · rails binder=open/default agent=open/default atDesk=true | ≤1 solid primary per job | Draft empty@1440 dual-rail | CALM_BUDGET.md B6-primary-per-job · ≤1 solid primary per job (empty Draft dual-rail) |
| PASS | B6-primary-per-job@canon-empty | HARD | maxPerJob=1 solids=2 graphEmpty=canon · rails binder=open/default agent=open/default atDesk=true | ≤1 solid primary per job | Canon true-empty@1440 dual-rail | CALM_BUDGET.md B6-primary-per-job · ≤1 solid primary per job (Canon true-empty dual-rail) |

## HARD failures

_None._

## WARN band

_None._

## Notes

- Measurements require proven workspace/face preconditions via helpers.
- Wrong-surface PASS is blocked: precondition misses are HARD fails.
- B4-canon-* stay WARN until D4 lands (doc).
- Offline fixture LLM routes installed; no live model.
