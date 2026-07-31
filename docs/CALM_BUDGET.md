# CALM_BUDGET

**Status:** enforceable density bar · **r3** (ox Task S + rat Task AG + badger checker)  
**Date:** 2026-07-31  
**Owns:** measurable density **numbers** + severity (HARD/WARN). **Does not own:** IA structure — [IA_MAP.md](./IA_MAP.md).  
**Authority memo:** [decisions/calm-budget-r3-ox.md](./decisions/calm-budget-r3-ox.md) (green-vs-calm). Prior: [decisions/calm-budget-authority-ox.md](./decisions/calm-budget-authority-ox.md).  
**Checker:** `e2e/calm-budget.mjs` (`npm run calm`). Scoreboard: [e2e/output/calm-budget-run.md](../e2e/output/calm-budget-run.md).  
**Doctrine:** a budget that passes a loud UI or fails a calm one is worse than none. **Do not tune numbers so a surface passes** — fix pixels or accept debt.

---

## Severity

| Level | Meaning |
|-------|---------|
| **HARD** | Merge blocker when assertion exists **and** the related feature has landed |
| **WARN** | Scoreboard / review signal only until two rounds agree |

### Principles (r3)

1. **Provenance is part of the budget.** A PASS without owned stack (or explicit allowlist) + printed `head` + served `shell.css` hash is **void**. Unproven → runner **exit 2 refuse**, never green. (FG7 — **resolved** by badger owned-stack seal.)
2. Prefer **structure** (state, fold, wrap, rest, truncation, accent recipe) over width ratios.
3. A check that cannot fail on a known loud screen must be rewritten or deleted.
4. Default product rail state is in scope. Forced-open companion for face checks is allowed but **labeled** and must not be used as the B1 default-rail result.
5. **Every check records when it last failed.** A check that has never failed is decorative or untested — review for deletion next pass.
6. Checker thresholds must match this file (**M10** HARD). Drift is how false red/green land. On disagreement mid-seal, **checker implementation wins** and this file follows (rat AG).

---

## How to measure

Viewports: **1440×900** desktop, **390×844** narrow. Theme light.

**Default product rails (B1):** binder open when the layout shows a rail; **companion open by default only ≥ `bp.desk` (1366)** — below that agent starts closed (`useShellState.defaultRailsAt`). At 1440 measure dual-rail default; at 390 measure real defaults (usually binder drawer + agent closed).

**Forced-open path (B3 faces etc.):** companion may be opened for measurement; label the surface; do not report those widths as B1 default-rail.

Prefer **viewport** shares, not full-document geometry when they diverge.

| Metric key | Definition |
|------------|------------|
| `workPct` | work surface width ÷ viewport width × 100 |
| `chromePct` | (binder + agent) width ÷ viewport × 100 |
| `binderPct` / `agentPct` | each rail ÷ viewport × 100 |
| `topJobPrimaryCount` | topbar **job** controls with primary/solid weight (not place switches) |
| `ecosystemVisible` | count of labeled Draft · Lab · Canon controls |
| `placeLabelClipped` | any place label ellipsized/clipped @390 |
| `projectLabelOk` | project switcher fully visible **or** has `title`/accessible full name |
| `faceTabCount` | product faces for the context (More closed; resting row) |
| `writingPrimaryPeers` | equal-weight primaries in writing strip excluding More menu + Inbox badge path |
| `faceRows` | wrapped rows of face tabs @ viewport (More **closed**) |
| `chipVisibleCount` | fully expanded craft chips on **Draft manuscript only** |
| `kindFullStrips` | count of **full** Lab kind strips (filter+composer both full = 2) |
| `choiceWallCount` | equal-weight visible choices in one toolbar group before overflow |
| `labFilterWhenEmpty` | filter strip present when card count = 0 |
| `primaryPerJobMax` | max solid/`ui-button--primary` count for any single **job key** across binder + fold + companion in one viewport |
| `touchFailChrome` | unique topbar / faces / disclosures / ecosystems with min(w,h) < 44 @390 (**dedupe samples**) |
| `overflowX` | `scrollWidth > clientWidth` |
| `foldOwner` | largest center-band box in the **first viewport** |
| `checkRestHasStatus` | Check body has non-footer orientation block **or** last-run status region (structure, not chrome label) |
| `chatProposalsWall` | pending proposals rendered as a wall on Chat (badge-only is OK) |
| `proposeExpanded` | product state: open editor (`details[open]` / `aria-expanded` / controlled flag) — **not** “no inputs found” |
| `viewKindDistinct` | pressed view accent recipe ≠ pressed kind; kind is not accent fill |
| `railBudgetWork` | TOKENS §4 / `railBudget.test` default dual work share (**≥ 60**) |

**Job primary (top bar)** = Continuity · Export · Research · Review · New (peers) as solid/primary in the **top bar**.
**Job key (viewport, B6-primary-per-job)** = same create/open destination across regions (e.g. create-chapter = binder New chapter · companion Write first chapter · center Write; create-sheet = binder New sheet · map New sheet). `data-job` wins when present; else accessible name clusters above.  
**Place controls** (Draft / Lab / Canon) are wayfinding — pressed place must **not** count as a job primary.  
One segmented control = one choice set, not N primaries.

**Canon density / hierarchy / fold:** run on **seeded** Canon (min ~2 characters + edge). Empty Canon may only assert empty-state copy. Lab empty-filter stays on **empty** fixture.

---

## Budgets

**Last failed** column: date + short note of last known HARD/WARN fire on a proven run. `never` = untested or always-green → review next pass. Update when scoreboard lands.

### B1 — Work vs rails @1440 (default dual rails)

| ID | Rule | Sev | Why | Last failed |
|----|------|-----|-----|-------------|
| B1-work-hard | default dual @1440 `workPct` **≥ 40** | **HARD** | **Catastrophe floor only** — not a calm certificate. Below ~40% the job is gone. | never (floor; D1 dual ~61) |
| B1-rail-budget | default dual @1440 work share **≥ 60** (TOKENS §4 / `railBudget.test`) | **HARD** | Desk majority after D1. Asserts **design arithmetic**, not a gamed render pad. Single source with tokens test. | never (new r3; unit lock exists) |
| B1-work-warn | default dual @1440 `workPct` **< 45** | **WARN** | Soft band (badger checker). Must not duplicate B1-rail-budget story. | never post-D1 (~61) |
| B1-rail-warn | either rail **> 24** pct **or** `chromePct` **> 55** | **WARN** | **Aligned to checker** (badger AG). Doc follows implementation — not legacy doc 58. | pre-D1 dual ~53 chrome (historic WARN noise) |
| B1-rail-pathological | either rail width **>** work width | **HARD** | Chrome owns the desk. | never |
| B1-fold-draft | `foldOwner` = work on Draft @1440 | **HARD** | Form-steals-fold class. | never on Draft paper |
| B1-fold-lab | `foldOwner` = work (bench/composer-as-work when empty) @1440 | **HARD** | Lab fold theft. | never (new) |
| B1-fold-canon | `foldOwner` = map/stage on Canon default @1440 **seeded** | **HARD** | Loudest fold bugs were Canon (post-D4 interact). | pre-D4 propose stole fold (eye) |
| B1-default-rails | fresh @1280 agent **closed**; @≥1366 dual **open** (Focus off) | **HARD** | D1 policy; forced-open face path is separate. | never (new) |

**Dropped / deleted r3:** HARD `workPct ≥ 55` as calm certificate (FR1). Implication that **≥40 alone means calm desk**.  
**B1-rail-warn** kept with **checker numbers** (≤24 / chrome≤55), not deleted — badger owns threshold.

---

### B2 — Top bar jobs + ecosystems

| ID | Rule | Sev | Why | Last failed |
|----|------|-----|-----|-------------|
| B2-job-primary | Continuity / Export / Research / Review / New as top primary = **0** | **HARD** | Job tools are L2 (IA §12.2–12.3). | Continuity top primary (pre-remove) |
| B2-ecosystem | `ecosystemVisible` **= 3** on 1440 **and** 390 | **HARD** | Wayfinding; depth law on phone. Pair with truncation. | never post-retain |
| B2-truncation-places | `placeLabelClipped` **= 0** @390 | **HARD** | Visible-but-clipped “Ca” lies (R1 P2). Never ship count without this. | R1 P2 clip |
| B2-truncation-project | project label full **or** titled; must not steal place pixels | **WARN** | Identity without eating Draft/Lab/Canon. → HARD when stable. | Task P residual |
| B2-top-count-warn | topbar controls **> 8** @390 without overflow pattern | **WARN** | Crowded phone chrome. | never |

**Deleted r3:** `B2-job-count` (duplicate of B2-job-primary).

---

### B3 — Companion faces (not a product redesign gate)

Measure **resting** face row (More **closed**).

| ID | Rule | Sev | Why | Last failed |
|----|------|-----|-----|-------------|
| B3-writing-primary-peers | resting primary peers **≤ 3** (Chat·Write·Check) + Inbox badge + optional one More | **HARD** | Model calm signal (D6). Not “delete Research.” | pre-D6 five equal primaries |
| B3-writing-count | product faces **≤ 5** (allow-list ceiling) | **HARD** backstop | No sixth face; count alone ≠ calm. | never as sole catch |
| B3-lab-count | lab faces **≤ 3** | **HARD** | Chat · Spark · Inbox. | never |
| B3-graph-count | graph faces **≤ 3** | **HARD** | Chat · Inspect · Inbox. | never |
| B3-wrap | `faceRows` @390 **= 1** (More closed) | **HARD** | Real narrow fail is wrap (R1 P3). | R1 P3 wrap |
| B3-overflow-shape | extras only behind **one** labeled More | **HARD** | Disclosure without a new chrome band. | pre-D6 |
| B3-footer-primary | footer primary **≤ 1** | **HARD** | [03-ux.md](./03-ux.md). | never |
| B3-footer-total | footer actions ≤3 **WARN**; **≥4 HARD** | WARN/HARD | Footer ≠ tool wall. | never |
| B3-default-face | writing default **= Chat** | **HARD** | Not Check-as-home. | never |
| B3-rest | Check body: non-footer orientation **or** last-run region (structure) | **HARD** | Empty middle + footer-only is loud (R1 P4). | R1 P4 empty rest |
| B3-inbox-wall | `chatProposalsWall` **= false** (Inbox badge OK) | **HARD** | Chat is transcript, not pending dump. | never |
| B3-doors-rest | Write/Check/Inbox one click from default Chat (Research may stay under More) | **WARN** | Resting discoverability (Task W). | never |

---

### B4 — Chips, Lab kinds, Canon

| ID | Rule | Sev | Why | Last failed |
|----|------|-----|-----|-------------|
| B4-craft-desktop | craft visible **≤ 5** + overflow on Draft only | **HARD** | D8; scope manuscript craft strip. | never when scoped |
| B4-craft-phone | craft collapsed disclosure default @390 | **HARD** | Expanded 8 chips = true red if real. | craft-phone expanded (stale run) |
| B4-lab-empty-filter | no Lab filter strip when cards = 0 | **HARD** | D3 empty-bench calm. | pre-D3 |
| B4-lab-kind-strips | `kindFullStrips` **≤ 1** | **HARD** | One full kind strip max. | dual strips pre-D3 |
| B4-choice-wall | equal-weight choices in one group **≤ 5** before overflow | **WARN** → HARD when otter lands | Hick “seven equal choices” class. | eye D3 |
| B4-canon-propose | default **collapsed** on fresh Canon (product state) | **WARN** → **HARD on D4 merge** | Missing editor = precondition fail, not PASS. | pre-D4 always-open propose |
| B4-canon-view | view pressed accent **≠** kind pressed; kind quieter (not `≥` weight) | **WARN** → **HARD on D4 merge** | Fail equal accent. | equal weight false green |
| B4-canon-fold | map h ≥ header+toolbar+collapsed editor (**seeded**) | **HARD on D4 merge** | Fold ownership on Canon. | propose stole fold |
| B4-sheet-stack | sheet open only under binder/Canon rules (`data-sheet-open`) | **HARD** | No Draft bleed / center sheet (D5 retracted). | D5 class history |

---

### B5 — Touch + overflow

| ID | Rule | Sev | Why | Last failed |
|----|------|-----|-----|-------------|
| B5-touch-chrome | min hit **≥ 44×44** @390 for topbar, places, faces, disclosures; **dedupe samples** | **HARD** | Fitts. True reds at ~38px stay fails — do not loosen. | 38px chrome samples |
| B5-overflow | `overflowX` **= false** | **HARD** | Extraneous horizontal scroll. | never |
| B5-graph-nodes | SVG node radius vs 44 | **WARN** only | Not chrome. | n/a |
| B5-focus | Focus hides rails; work remains | **HARD** | IA §12.4 J1 purity. | never |

**Deleted r3:** `B5-touch-fail` (duplicate of B5-touch-chrome).

---

### B6 — Region caps at rest

| ID | Rule | Sev | Why | Last failed |
|----|------|-----|-----|-------------|
| B6-binder-rest | empty project: binder structure + CTAs (≥3 group labels + CTA/empty group or binder-resting contract) | **HARD** | Binder void class (M1). | binder void pre-fix |
| B6-binder-actions | global list actions **≤ 2** | **WARN** | Implement or drop next pass if never measured. | never |
| B6-binder-title-wrap | long titles wrap ≤2 lines or have `title`; no silent ellipsis-only regress | **WARN** | D1 wrap win. | never |
| B6-canon-chrome | ≤4 chrome peers post-D4 (view · filter · propose entry · overflow) | **HARD post-D4** | Map chrome budget. | pre-D4 open form |
| B6-primary-per-region | ≤1 solid primary per region (topbar / graph toolbar / companion face / binder footer) | **HARD** | Multiple primaries = loud. | never (new) |
| B6-primary-per-job | empty Canon + empty Draft dual-rail @1440: ≤1 solid primary **per job key**; true-empty fold solid = New sheet only (no Send while sheets<2) | **HARD** | Composition defect (ox one-primary-door-per-job + empty-canon-send-proposal-weight). Fixtures via `claimEmptyProject`. Closed `details` guts excluded. | never (new; AM weight demotes pre-gate) |
| B6-draft-header | title+meta OK; extra chrome **≤2** | **WARN** | Implement or remove next pass. | never |
| B6-lab-chrome | empty composer is work; extra chrome **≤3** | **WARN** | Implement or remove next pass. | never |
| B6-companion | owned by B3 | via B3 | — | — |

**Deleted r3:** `B6-top-job` (use B2-job-primary).

---

## Missing checks registry (ox M1–M11)

| M# | Budget ID | Sev | Status |
|----|-----------|-----|--------|
| M1 | B6-binder-rest | HARD | **in bar** — checker TODO |
| M2 | B1-default-rails | HARD | **in bar** — checker TODO |
| M3 | B4-sheet-stack | HARD | **in bar** — checker TODO |
| M4 | B4-choice-wall | WARN→HARD | **in bar** — checker TODO |
| M5 | B2-truncation-project | WARN | **in bar** — checker TODO |
| M6 | B3-doors-rest | WARN | **in bar** — checker TODO |
| M7 | B1-fold-canon (+ B4-canon-fold) | HARD | **in bar** — post-D4 / seeded |
| M8 | B6-binder-title-wrap | WARN | **in bar** — checker TODO |
| M9 | B2-ecosystem on Lab/Canon routes | HARD (same B2) | smoke once in checker |
| M10 | **Checker/doc drift** | **HARD** | thresholds in `calm-budget.mjs` must match this file (incl. B1-rail-warn chrome **55**, work **40**, rail-budget **60**). Unit test or header parse. |
| M11 | B6-primary-per-region | HARD | **in bar** — checker TODO |
| M12 | B6-primary-per-job | HARD | **in bar** — empty Canon + empty Draft dual-rail fixtures; checker in `calm-budget.mjs` |

Also required with r3: **B1-rail-budget**, **B3-writing-primary-peers**, fold on Lab/Canon, last-failed updates on each owned scoreboard commit.

---

## Checker alignment (badger)

| Topic | Doc r3 | Checker (at AG draft) |
|-------|--------|------------------------|
| B1-work-hard | ≥40 HARD catastrophe | **same** |
| B1-work-warn | <45 WARN | **same** |
| B1-rail-warn | rail>24 or chrome>**55** WARN | **same** (doc aligned to checker) |
| B1-rail-budget ≥60 | HARD | **TODO** (tokens unit exists) |
| B1-rail-pathological / B1-fold-draft | HARD | **same** (fold Draft only today) |
| B2-job-primary, ecosystem, truncation-places, top-count | as above | **same** |
| B2-job-count | **deleted** | not required |
| B3-* existing | as above | **same**; peers/doors TODO |
| B4-canon-* | WARN pre-D4; state/style recipe | WARN today; recipe TODO |
| B5-touch-chrome | HARD deduped | HARD; dedupe TODO; **drop B5-touch-fail** |
| B5-touch-fail / B6-top-job | **deleted** | drop in follow-up |
| M1–M11 | in bar | mostly TODO |
| M12 B6-primary-per-job | empty dual-rail ≤1/job HARD | **in checker** (empty fixtures) |
| Provenance refuse exit 2 | HARD meta | **done** (owned stack) |

---

## Scoreboard

Do not treat rows without provenance as live. Re-run `npm run calm` on owned stack; commit `e2e/output/calm-budget-run.md` when the measurement is history.

Historical QA3 / pre-fix density faults are **not** the live fail list — see [decisions/density-audit-qa3.md](./decisions/density-audit-qa3.md).

True reds ox agrees with if still present: **B5-touch** ~38px, **B4-craft-phone** expanded chips. Fix product; do not loosen.

---

## Out of scope

- New ecosystems / panels / depth → [IA_MAP.md](./IA_MAP.md)  
- Apply/Accept verbs → IA_MAP §8  
- Tokens paint → [design/TOKENS.md](./design/TOKENS.md) (rail **budget arithmetic** is in scope via B1-rail-budget)  
- Graph node hit geometry as chrome touch  
- Face-count product redesign (≤3 writing allow-list amputation)  
- Tuning thresholds to green current surfaces  

---

## Assertion sketch (HARD core)

```text
// provenance
assert ownedStack || allowlistWithHeadAndCssHash
// refuse exit 2 if unproven

assert workPct(1440, rails=default) >= 40   // catastrophe only
assert railBudgetDefaultDual(1440) >= 60    // TOKENS / railBudget.test
assert not (railWidth > workWidth)
assert foldOwner(Draft|Lab|Canon seeded) == workSurface
assert defaultRails(1280).agent == closed && defaultRails(1440).dual == open
assert topJobPrimaryCount(continuity|export|research|review|new) == 0
assert ecosystemVisible(1440) == 3 && ecosystemVisible(390) == 3
assert placeLabelClipped(390) == 0
assert writingPrimaryPeers <= 3 && faceTabCount(writing) <= 5
assert faceTabCount(lab) <= 3 && faceTabCount(graph) <= 3
assert faceRows(390, more=closed) == 1
assert defaultFace(writing) == Chat
assert checkRestStructure == true
assert chatProposalsWall == false
assert craftChipVisible(1440) <= 5
assert craftCollapsedDefault(390) == true
assert labFilterAbsentWhenEmpty == true
assert kindFullStrips(lab) <= 1
assert sheetStackRespectsCanon == true
assert binderRestEmptyProject == true
assert primaryPerRegion <= 1
assert primaryPerJobMax(emptyCanon|emptyDraft dual@1440) <= 1
assert touchFailChrome(390) == 0  // deduped
assert overflowX(*) == false
assert focusHidesRails == true
assert checkerThresholdsMatch(thisFile)  // M10
// post-D4:
// assert canonProposeDefaultCollapsed == true  // product state
// assert viewPressedAccent != kindPressedAccent
// assert canonMapOwnsFold(seeded)
```

---

## One-line bar (r3)

**Provenanced run only. Default desk: work ≥60% (rail budget) and ≥40% catastrophe floor. Fold owned by work on Draft/Lab/Canon. Zero L0 job primaries. Three unclipped places on phone. Writing: ≤3 primary peers + one row @390 + optional More; Check never empty-rest; no Chat proposal wall. Craft ≤5 desktop / collapsed phone. One Lab kind strip; no empty-bench filter. Canon (seeded, post-D4): propose collapsed, map owns fold, view accent beats kind. Chrome touch ≥44; no overflowX; Focus pure; binder never a void; sheet stack respects Canon; empty Canon/Draft dual-rail ≤1 solid primary per job. Checker matches this file.**
