<!--
  Tracked decision record.
  Author: ox
  Kind: design-authority
  Task: S (green-vs-calm read of CALM_BUDGET)
  Decided: r3 revision proposals below. Pig owns the file edit; ox does not commit product/docs landings.
  Evidence: eye reviews D1/D5/D6/L2/P/V/W + calm-budget.mjs + calm-budget-run @ 5e087f3 (stale rails) + D1 post-shots @ a2ed7bd.
  Landing: Task AG (buffalo/pig) — judgments below are verbatim ox; §7.1 landing note added only for provenance status (item 7 resolved by badger seal).
-->

# CALM_BUDGET r3 — green-vs-calm (ox Task S)

**From:** ox  
**To:** pig (doc owner) · badger (checker) · rat (queue)  
**Question:** Does PASS mean calm? Does FAIL mean not calm?  
**Answer in one line:** Not yet. Structure checks that fire are doing real work. Several ratios and duplicates are decorative or false-green. Provenance is a precondition, not a note.

Doctrine stays: a budget that passes a loud UI or fails a calm one is worse than none.

---

## 0. How this was judged

| Source | Role |
|---|---|
| Eye reviews D1, D5, D6, L2, P, V, W | ground truth of calm / loud |
| `docs/CALM_BUDGET.md` r2 @ origin/dev `4327572` | authority text |
| `e2e/calm-budget.mjs` (e2e-health worktree, dirty) | what CI would actually assert |
| `calm-budget-run` HEAD `5e087f3` | scoreboard on **pre-D1** rails (380px) — useful for checker behavior, **not** current desk geometry |
| D1 eye post-merge `a2ed7bd` | current dual-rail Draft: work **61.1%**, chrome **38.9%** |

Rule used for every line:

1. Failing it should predict a screen ox would reject by eye.  
2. Passing it must not green-light a screen ox would reject.  
3. A check that never fails on real product paths is **delete or rewrite**, not keep-for-confidence.

---

## 1. False greens — PASS today, ox would REJECT

These are the load-bearing findings.

### FG1 — Canon propose “collapsed” by accident of `<details>` / measure scope  
**Checks:** B4-canon-propose, (post-D4 intended HARD), B6-canon-chrome  
**What happens:** Checker looks for visible `input/textarea/select` inside a propose form. A closed `<details>` or a form not matching selectors yields `proposeExpanded=false` → PASS.  
**Eye truth:** Pre-D4 desktop Propose was **always open** and stole the fold (R1 P1). Phone happened to use disclosure, so phone could PASS while desktop was loud — or the opposite if selectors miss the open panel.  
**Class:** **false green by implementation luck, not design.**  
**r3 fix:**  
- Measure **product state**, not tag soup: `details.graph__editor[open]` / controlled `editorOpen` / `aria-expanded` on the summary.  
- Assert **default load** collapsed (navigate fresh to Canon, do not click).  
- Assert **map/stage height ≥ header+toolbar+collapsed-editor** in the first viewport (fold ownership on Canon, not only Draft).  
- Until D4 lands on dev: keep WARN, but stop calling a selector-miss a PASS — missing editor is **precondition fail**, not collapsed.

### FG2 — B4-canon-view weight equality can PASS a loud toolbar  
**Check:** B4-canon-view (`viewWeight >= filterWeight`)  
**What happens:** Crude class heuristic. Current run: `viewW=2 filterW=2` → PASS. Equal weight **passes**.  
**Eye truth:** Kind filters wearing the same accent recipe as Network/Family is the loud pattern D4 is fixing. `≥` encodes “view not weaker,” not “view wins.”  
**r3 fix:**  
- HARD post-D4: pressed **view** uses accent recipe; pressed **kind** must **not** (background/color/border distinct; kind font-size ≤ view; kind not accent fill).  
- Fail on **equal** accent. Replace `viewW >= filterW` with `viewPressedStyle ≠ kindPressedStyle` AND `kind is not accent`.  
- Pre-D4: WARN is fine; do not claim PASS means hierarchy is correct.

### FG3 — B1-fold only runs on Draft, so Canon/Lab fold theft is invisible  
**Check:** B1-fold HARD  
**What happens:** `measureLayout` + foldOwner only recorded under `width >= 1200` Draft path. Canon sheet-in-binder (D5 class) and open Propose never hit this HARD in the current runner shape.  
**Eye truth:** Loudest fold failures in this product were **Canon**, not Draft paper. Draft fold PASS is real and cheap; it does not cover the bug class that motivated the check.  
**r3 fix:**  
- Run foldOwner on **Draft, Lab, Canon** at 1440 default.  
- Canon default: foldOwner = map/stage (not propose body, not binder sheet form).  
- When `data-sheet-open=true`, foldOwner may be binder sheet **only if** center is not claiming a competing full form (D5 stack rule) — prefer explicit `data-sheet-open` + center empty/map, not area heuristics alone.

### FG4 — Face **count** PASSes while the strip is still loud  
**Checks:** B3-writing-count ≤5, B3-lab-count, B3-graph-count  
**What happens:** Count ceiling PASSes with Chat·Write·Check·Inbox + More (4 product faces).  
**Eye truth:** Pre-D6 five equal primaries and wrap were the loud parts. Count alone never caught wrap (R1 P3) or Research-as-peer weight. D6 fixed product; the **count check did not force the fix**.  
**r3 fix:**  
- Keep count as a **ceiling backstop** (HARD), not the primary calm signal.  
- Primary narrow signal stays **B3-wrap = 1 row** and **B3-overflow-shape = one More**.  
- Add: writing primary strip (not More menu) **≤ 3 equal peers** + Inbox badge path + optional More — this matches shipped D6 without reopening “≤3 product redesign.” Name it `B3-writing-primary-peers`, HARD. Count≤5 remains “no sixth face,” not “looks calm.”

### FG5 — B3-rest can PASS on weak copy match  
**Check:** B3-rest  
**What happens:** Regex on body text (`Nothing checked yet|Last Continuity|…`) or a status node. Easy to satisfy with a one-word ghost, or to miss a real empty state if copy changes.  
**Eye truth:** R1 P4 was empty middle + footer-only. The **structure** is “body has orientation before the footer primary,” not “string matches last week’s copy.”  
**r3 fix:**  
- Prefer structure: Check face body has **visible non-footer text block OR last-run status region** with min height / non-empty accessible name.  
- Snapshot-test the empty copy in unit/e2e separately if needed. Do not let a stray “Check” label in chrome satisfy rest.

### FG6 — B2-ecosystem = 3 PASSes while labels lie  
**Mitigated if B2-truncation is real.**  
**Eye truth:** R1 P2 `Ca` / clipped project. Count without truncation is a known false green.  
**r3:** Keep both HARD. **Never ship ecosystem count without truncation on the same viewport.** Checker already pairs them @390 — good. Extend truncation to **project title** in the topbar switcher (not only Draft/Lab/Canon). Missing today.

### FG7 — Provenance ghost PASS (meta false green)  
**Not a budget line — a runner sin.**  
**Unpinned `:5173` / dirty foreign HEAD produced PASS/FAIL on the wrong desk (pre-D1 380 rails while D1 was 280).**  
**r3 fix (doc + checker):**  
- HARD precondition: owned stack OR explicit allowlist with printed `head + shell.css hash`.  
- Exit 2 (refuse) if unproven. A refuse is not a green.  
- Scoreboard rows without provenance are **historical only**.

### FG8 — Phone Canon / Lab “calm” via empty project accident  
Isolated e2e projects often have **zero cards, zero edges, zero sheets**. Empty Canon + collapsed propose looks calm; a real project with filters + open chrome does not.  
**r3 fix:**  
- Structure checks that need density must seed **minimum fixtures** (D4 shot script pattern: 2 characters + edge).  
- Empty-bench checks (B4-lab-empty-filter) stay on empty.  
- Canon hierarchy / fold checks run on **seeded** Canon. Split surfaces: `Canon@empty` vs `Canon@seeded`.

---

## 2. False reds — FAIL (or WARN) on screens ox would ACCEPT

### FR1 — B1-work-hard ≥55 (already dropped)  
Confirmed correct drop. Dual-rail Draft at ~47 was accepted calm in R1. D1 now ~61. Do not revive ≥55.

### FR2 — B1-work-hard ≥40 after D1 — still real, but **soft as a desk-majority gate**  
**Current eye:** default 1440 dual work **61.1%**. Floor 40 only catches catastrophe (one rail wider than sense, or CSS broken).  
**Would ox reject 41% work?** Yes if rails ate the page. **Would ox accept 41%?** No — but 41% is already a disaster path, not a tuning knob.  
**r3 stance:**  
- **Keep HARD ≥40** as pathological floor (cheap, correct).  
- **Do not pretend ≥40 means “manuscript owns the desk.”** Desk majority is a **different** check:  
  - **B1-work-majority (HARD)** on **default rails @1440**: `workPct ≥ 55` **only when** measuring the **product default rail state** after D1 (binder open, companion open at desk).  
  - Wait — that reintroduces the FR1 problem for any pre-D1 or intentional dual-rail dense mode.  
**Better r3:**  
- **B1-work-hard ≥40** HARD (catastrophe).  
- **B1-work-warn <50** WARN on default dual @1440 post-D1 (soft push; 47 historic dual was accepted, 61 is target — WARN band 50–55 is optional).  
- **Delete decorative comfort:** if we will not fail merges between 40 and 55, say so. The **real** majority lock is already in `railBudget.test.ts` / TOKENS §4 (≥60 default). **Point CALM_BUDGET at that arithmetic** instead of duplicating a weaker %.  
**Recommendation:**  
- Keep B1-work-hard ≥40 HARD.  
- Change B1-work-warn to: WARN if default dual @1440 `workPct < 55` **OR** if default dual chromePct > 45 (post-D1 expected ~39).  
- Add **B1-rail-budget-link** (HARD): default dual @1440 satisfies TOKENS rail budget (work ≥ 60) — single source of truth with `railBudget.test.ts`. This is not decorative: D1 exists to hold it.  
- Do **not** HARD-fail Focus-off dual-rail Draft at 47 on old builds; provenance + rail-budget link handle “are we on D1 desk.”

### FR3 — B1-rail-warn as implemented (checker drift)  
**Doc r2:** rail >24 **or** chromePct >**58** WARN; dual ~53 expected PASS.  
**Checker:** chrome >**55** and rails ≤24 — dual 26.4/26.4/52.8 → **WARN** on the accepted pre-D1 calm Draft.  
**Eye:** Pre-D1 dual Draft was accepted; WARN on 53% chrome trains people to ignore WARN.  
**r3:**  
- Align checker to doc: chrome >**58** only; single rail >**28** (post-D1 rails are ~19–21% at 1440; pre-D1 26% should not WARN if chrome ≤58).  
- Or **delete B1-rail-warn** entirely and rely on B1-rail-pathological + B1-rail-budget-link. A WARN that fires on every historic dual-rail run is noise.

### FR4 — B3-writing-count if someone measures More-open as faces  
If the menu open state counts Research as a fifth visible tab in a second row, wrap/count can false-fail a correct More pattern.  
**r3:** Measure **resting** face row only (More closed). Document it.

### FR5 — B5-touch on non-chrome or double-counted nodes  
Run showed Chat/Inspect/Inbox twice; Lab twice. Duplicate samples inflate fail count but the underlying 38px hits are **real fails** ox agrees with.  
**Not a false red on substance.** Fix sampler dedupe; keep HARD ≥44.

### FR6 — B4-craft-phone FAIL with chips=8  
If phone truly shows 8 craft chips expanded, FAIL is correct. If measureCraft is counting badges outside craft (graph/lab leakage), false red.  
**r3:** Scope craft to Draft manuscript craft disclosure only (checker comments say this; verify). Seed known 5 tags; phone must show disclosure not 8 chips.

---

## 3. Structure over ratios — keep / replace / delete

### Keep (structure or structure-backed) — these earn their slot

| ID | Why it earns the slot |
|---|---|
| B1-fold (expanded surfaces) | Catches form-steals-fold; ratios cannot |
| B1-rail-pathological | True chrome-owns-desk |
| B1-rail-budget-link (new) | Locks D1 TOKENS arithmetic; not a vibe % |
| B2-job-primary / B6-top-job | IA law; eye-validated |
| B2-ecosystem + B2-truncation | Pair is mandatory; alone each lies |
| B3-wrap + B3-overflow-shape | Model check (face count’s smarter sibling) |
| B3-rest | Emptiness is loud; no ratio sees it |
| B3-inbox-wall | Behavioral IA |
| B3-default-face | Home is Chat |
| B3-footer-primary | One primary |
| B4-lab-empty-filter | D3 empty calm |
| B4-lab-kind-strips | Dedupe > chip count |
| B4-craft-desktop / phone | D8 structure |
| B4-canon-propose (state) | Default collapsed |
| B4-canon-view (style recipe) | Journey > job |
| B5-touch-chrome (deduped) | Fitts; real fails today |
| B5-overflow | Horizontal trap |
| B5-focus | J1 purity |
| Provenance refuse | Meta-HARD |

### Keep but demote / narrow (ratios that still work)

| ID | r3 role |
|---|---|
| B1-work-hard ≥40 | Pathological floor only |
| B1-work-warn | Retune or replace with rail-budget-link + chrome ceiling |
| B3-*-count ceilings | Backstop only; peers/wrap are primary |
| B3-footer-total | Keep WARN@3 HARD@≥4 |
| B5-graph-nodes | WARN only (already) |

### Delete or merge (decorative / duplicate / noise)

| ID | Action | Why |
|---|---|---|
| B2-job-count | **Merge into B2-job-primary** | Same predicate twice |
| B5-touch-fail | **Merge into B5-touch-chrome** | Duplicate HARD |
| B1-rail-warn (current checker form) | **Delete or retune** | Fires on accepted dual-rail; trains WARN blindness |
| B6-top-job | **Merge into B2** | Identical |
| B6-draft-header / B6-lab-chrome / B6-binder as unimplemented WARN | **Either implement or remove from scoreboard** | Listed WARN that never runs = false confidence in the doc |
| Full-page chrome% as a standalone story | **Do not HARD** | Already doctrine; don’t reintroduce |
| Scoreboard “PASS expected” rows without a dated owned run | **Mark stale** | Decorative green ink |

### Replace ratio with structure (summary)

| Old instinct | Structural replacement |
|---|---|
| work% feels majority | default rail budget lock (TOKENS / railBudget.test) + foldOwner |
| chrome% too high | pathological rail>work; optional chrome>58 only |
| face count calm | primary peers ≤3 + one row + one More |
| craft count | desktop ≤5+overflow; phone **collapsed disclosure** |
| canon not loud | propose default closed + map owns fold + view≠kind accent |
| topbar not loud | 0 job primaries + 3 unclipped places + project title not clipped |

---

## 4. Missing checks — what can go wrong today with no catch

Higher value than threshold tweaks.

### M1 — Binder resting void  
Empty project blank binder (pre-9578f69). No calm check.  
**Add B6-binder-rest HARD:** on empty project, binder shows ≥3 group labels + ≥1 CTA per empty group (or the binder-resting.mjs contract). Structure, not %.

### M2 — Default companion policy below desk  
D1: companion closed below 1366. Checker forces companion open for measurement (OK for face checks) but never asserts **default** rails.  
**Add B1-default-rails HARD:** fresh session @1280 → agent closed; @1440 desk → both open (Focus off). Do not yank-on-resize (optional).

### M3 — Sheet stack / Draft bleed (D5)  
Sheet open outside Canon, or sheet replacing map incorrectly.  
**Add B4-sheet-stack HARD:** `data-sheet-open` only in Canon (or allowed contexts); Draft workspace not showing sheet editor chrome; binder hosts sheet.

### M4 — Equal-weight choice walls (Lab kinds / filter+composer)  
Otter’s D3 “seven equal choices” class. `kindFullStrips≤1` helps but does not catch **seven equal primaries inside one strip**.  
**Add B4-choice-wall WARN→HARD:** in one toolbar group, equal-weight visible choices ≤5 before overflow (Hick scan). Applies Lab composer kinds and any full filter strip.

### M5 — Project title truncation @390  
B2-truncation is places only. Task P: places beat project name, but project still must not become `H…` in a way that confuses identity without a title attribute.  
**Add B2-project-truncation WARN:** project switcher label either fully visible or has `title`/accessible name with full string; must not clip place labels to save project (already P).

### M6 — Check / Inbox / Write doors discoverable at rest  
Task W resting sweep: doors OK today, not locked.  
**Add B3-doors-rest WARN:** Write/Check/Inbox reachable in one click from default Chat without extra More for the three primaries (Research may stay under More).

### M7 — Canon seeded fold (see FG8)  
**Add B1-fold-canon-seeded HARD** post-D4.

### M8 — Long binder titles: clip vs wrap  
D1 long title wrapped cleanly. A future `ellipsis` CSS would silent-regress.  
**Add B6-binder-title-wrap WARN:** chapter/sheet row `scrollWidth` not greater than client with ellipsis-only single line unless `title` attr present; prefer wrap up to 2 lines.

### M9 — Secondary surface phone ecosystems  
Ecosystem measured on Draft topbar. Confirm Lab/Canon routes still show 3 places (should be same topbar — smoke once).

### M10 — Checker/doc drift gate  
**Add process check:** calm runner thresholds must match CALM_BUDGET.md quoted numbers (chrome 58 not 55). Unit test or header parse. Drift is how false red/green land.

### M11 — No “primary count per region”  
Multiple `variant=primary` in one viewport region (graph header + propose submit + companion).  
**Add B6-primary-per-region HARD:** ≤1 solid primary per region (topbar / graph toolbar / companion face / binder footer).

---

## 5. What the current scoreboard gets right

Do not throw these away in r3:

- Zero top job primaries (B2) — correct HARD, eye-clean Draft topbar.  
- Ecosystem = 3 + truncation pair.  
- Face wrap = 1 @390 after D6.  
- Check rest helper present (when measure is honest).  
- Lab empty filter off; one kind strip.  
- Focus hides rails.  
- overflowX false.  
- Craft desktop ≤5 when scoped right.  
- Refusal to measure without helpers/preconditions (directionally right; finish provenance).

Stale run HARD fails ox **agrees** with on substance if still true on current dev:  
- B5-touch 38px chrome  
- B4-craft-phone expanded chips  

Those are **true reds**. Fix product or accept debt; do not loosen the budget to green them.

---

## 6. r3 proposed budget text (replacement sections)

Pig may paste/adapt. Only deltas from r2 called out.

### 6.1 Principle (add)

```text
Provenance is part of the budget. A PASS without head + served shell.css hash is void.
Prefer structure (state, fold, wrap, rest, truncation, accent recipe) over width ratios.
A check that cannot fail on a known loud screen must be rewritten or deleted.
Default product rail state is in scope; forced-open measurement for faces is allowed
but must be labeled and must not be used as the B1 default-rail result.
```

### 6.2 B1 rewrite

| ID | Rule | Sev | Notes |
|----|------|-----|-------|
| B1-work-hard | default dual @1440 `workPct ≥ 40` | HARD | Catastrophe floor only |
| B1-rail-budget | default dual @1440 `workPct ≥ 60` (TOKENS §4 / railBudget.test) | HARD | Desk majority after D1; single source with tokens |
| B1-work-warn | delete **or** WARN if `workPct < 55` on default dual @1440 | WARN | Optional soft band; must not duplicate rail-budget |
| B1-rail-warn | **delete** (noise) **or** chromePct > 58 only | WARN | Never WARN on expected dual ~39–53 |
| B1-rail-pathological | any rail width > work width | HARD | keep |
| B1-fold-draft | foldOwner=work on Draft @1440 | HARD | keep |
| B1-fold-lab | foldOwner=work (bench/composer-as-work when empty) @1440 | HARD | new |
| B1-fold-canon | foldOwner=map/stage on Canon default @1440 seeded | HARD | new; post-D4 for propose interaction |
| B1-default-rails | fresh @1280 agent closed; @≥1366 dual open | HARD | new (D1 policy) |

**Drop:** any implication that ≥40 alone means calm desk.

### 6.3 B2 rewrite

| ID | Rule | Sev |
|----|------|-----|
| B2-job-primary | top job primaries = 0 (Continuity/Export/Research/Review/New) | HARD |
| B2-ecosystem | places visible = 3 @1440 and @390 | HARD |
| B2-truncation-places | placeLabelClipped = 0 @390 | HARD |
| B2-truncation-project | project label full or titled; must not steal place pixels | WARN→HARD when stable |
| B2-top-count-warn | keep WARN >8 @390 without overflow pattern | WARN |

**Delete:** B2-job-count duplicate.

### 6.4 B3 rewrite

| ID | Rule | Sev |
|----|------|-----|
| B3-writing-primary-peers | resting primary peers ≤3 (Chat·Write·Check) + Inbox badge + optional one More | HARD |
| B3-writing-count | product faces ≤5 including overflow targets | HARD backstop |
| B3-lab-count / B3-graph-count | ≤3 | HARD |
| B3-wrap | faceRows@390 = 1 (More **closed**) | HARD |
| B3-overflow-shape | extras only under one More | HARD |
| B3-footer-primary | ≤1 | HARD |
| B3-footer-total | ≤3 WARN; ≥4 HARD | keep |
| B3-default-face | Chat | HARD |
| B3-rest | Check body has non-footer orientation or last-run region (structure) | HARD |
| B3-inbox-wall | no proposal wall on Chat | HARD |
| B3-doors-rest | Write/Check/Inbox one click from default Chat | WARN |

### 6.5 B4 rewrite

| ID | Rule | Sev |
|----|------|-----|
| B4-craft-desktop | ≤5 + overflow on Draft | HARD |
| B4-craft-phone | collapsed disclosure default @390 | HARD |
| B4-lab-empty-filter | no filter strip when cards=0 | HARD |
| B4-lab-kind-strips | kindFullStrips ≤1 | HARD |
| B4-choice-wall | equal-weight choices in one group ≤5 before overflow | WARN now / HARD when otter lands |
| B4-canon-propose | default collapsed on fresh Canon (state attribute) | WARN→**HARD on D4 merge** |
| B4-canon-view | view pressed accent ≠ kind pressed; kind quieter | WARN→**HARD on D4 merge** |
| B4-canon-fold | map h ≥ header+toolbar+collapsed editor (seeded) | HARD on D4 merge |
| B4-sheet-stack | sheet open only in binder/Canon rules (data-sheet-open) | HARD |

**Canon measures require seeded project.** Empty Canon may only assert empty-state copy, not hierarchy.

### 6.6 B5 rewrite

| ID | Rule | Sev |
|----|------|-----|
| B5-touch-chrome | min(w,h) ≥44 for topbar, places, faces, disclosures @390; **dedupe samples** | HARD |
| B5-overflow | overflowX false | HARD |
| B5-focus | Focus hides rails; work remains | HARD |
| B5-graph-nodes | WARN only | WARN |

**Delete:** B5-touch-fail duplicate.

### 6.7 B6 rewrite

| ID | Rule | Sev |
|----|------|-----|
| B6-binder-rest | empty project binder structure + CTAs | HARD |
| B6-binder-actions | global list actions ≤2 | WARN (implement or drop) |
| B6-canon-chrome | ≤4 chrome peers when D4 lands (view, filter, propose entry, overflow) | HARD post-D4 |
| B6-primary-per-region | ≤1 solid primary per region | HARD |
| B6-draft-header / B6-lab-chrome | implement WARN measures or remove from doc | — |

**Delete:** B6-top-job (use B2).

### 6.8 One-line bar (r3)

```text
Provenanced run only. Default desk: work ≥60% (rail budget) and ≥40% catastrophe floor.
Fold owned by work on Draft/Lab/Canon. Zero L0 job primaries. Three unclipped places on phone.
Writing: ≤3 primary peers + one row @390 + optional More; Check never empty-rest; no Chat proposal wall.
Craft ≤5 desktop / collapsed phone. One Lab kind strip; no empty-bench filter.
Canon (seeded, post-D4): propose collapsed, map owns fold, view accent beats kind filters.
Chrome touch ≥44; no overflowX; Focus pure; binder never a void; sheet stack respects Canon.
```

---

## 7. Checker obligations (badger) — non-optional with r3

1. **Owned stack default**; refuse exit 2 without head+css hash.  
2. Thresholds **parsed from or tested against** CALM_BUDGET.md (chrome 58, work 40/60).  
3. **Default-rail** measurement path separate from **forced-open companion** path.  
4. Canon hierarchy/fold on **seeded** fixture; lab empty on **empty** fixture.  
5. Dedupe touch samples.  
6. Propose collapsed = product state, not “no inputs found.”  
7. View vs kind = computed style recipe, not integer weight ≥.  
8. Do not mark PASS when precondition skipped — already partly done; extend to canon editor missing.  
9. Stop treating WARN band noise (dual-rail 53) as success theater — delete or retune.

### 7.1 Landing note (Task AG — not an ox judgment)

| Ox item | Landing status |
|---------|----------------|
| §7.1 / FG7 unproven `:5173` / wrong-HEAD scoreboard | **RESOLVED** by badger seal (owned stack + provenance + 5× fingerprint). Not an open checker debt. Remaining §7 items still apply for r3 checker alignment. |

---

## 8. Priority order if only some of r3 lands

1. Provenance refuse (stops lying scoreboards)  
2. B1-rail-budget HARD + fold on Canon  
3. B4-canon propose state + view≠kind (on D4 merge)  
4. B3-writing-primary-peers + wrap (model pattern)  
5. B6-binder-rest  
6. Delete duplicates / noisy B1-rail-warn  
7. Choice-wall + sheet-stack + default-rails  
8. Retune work WARN cosmetics last  

---

## 9. Explicit non-goals

- Do not tune thresholds so current touch/craft fails go green.  
- Do not HARD-gate writing faces ≤3 as a product redesign.  
- Do not use full-document chrome% as merge blocker.  
- Do not trust `npm run calm` on :5173 until owned-stack is mandatory.  
- Do not block D4 on calm green; block D4 on **eye + D4 structure asserts**, then promote Canon lines HARD.

---

## 10. Verdict for rat

| Question | Answer |
|---|---|
| Does PASS mean calm? | **Not reliably.** False greens: Canon propose/view measure, Draft-only fold, face count without peers/wrap, unseeded empty Canon, unproven server. |
| Does FAIL mean not calm? | **Usually yes** for touch, craft-phone, true rest emptiness, wrap, job primaries. **No** for noisy rail-warn @53% and any unproven-head fail/pass. |
| Is ≥40 still doing work? | **Yes as catastrophe floor. No as calm certificate.** Desk calm is rail-budget ≥60 + fold + structure. |
| Is <45 WARN decorative post-D1? | **Mostly yes** on default dual (61%). Replace with rail-budget link; don’t keep a WARN that never fires. |
| Model check to clone | **B3-wrap / overflow-shape** (and D6 peers): structure over count. Apply same pattern to Canon, binder rest, choice walls. |

**r3 is a revision proposal, not a landed file edit.** Pig applies to `docs/CALM_BUDGET.md`. Badger aligns checker. Ox re-reviews wording on request.

— ox
