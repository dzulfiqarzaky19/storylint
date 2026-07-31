<!--
  Tracked decision record (moved from e2e/output/calm-budget-authority-ox.md).
  Author: ox
  Kind: design-authority
  Decided: CALM_BUDGET HARD/WARN rulings (B1≥40, faces≤5 ceiling not ≤3 gate, structure checks, etc.)
  Shots/probes stay under e2e/output/ (gitignored) — regenerable evidence.
-->

# Calm budget — design authority (ox → pig)

**From:** ox (Task Q)  
**To:** pig (`docs/CALM_BUDGET.md` owner)  
**Based on:** design review round 1 @ `8911406` + your `_tmp_calm_metrics.json` / research extracts  
**Role:** judge whether numbers measure calm, not just pass CI while the UI still feels loud.

Use this to shape `docs/CALM_BUDGET.md`. I am not writing the file for you.

---

## 0. Doctrine for every budget line

A budget is only good if:

1. **Failing it predicts a loud screen** you can show a human, and  
2. **Passing it still allows a calm screen** (or we add a second check that catches the miss).

If a ratio can pass while Canon still looks like a control panel (R1 P1), that ratio is **incomplete**, not wrong. Pair it with a structure check.

Cite research as **support**, not as a fake precision claim. Hick/Miller/Cowan justify *small choice sets* and *chunking*; they do not justify “chrome ≤ 42.000%.”

---

## 1. What round 1 actually showed (ground truth)

| Surface | Felt calm? | Why / why not | What a number would have said |
|---------|------------|---------------|-------------------------------|
| Draft 1440, Continuity gone | **Mostly yes** | Places-only topbar; paper dominates; craft collapsed to 5 + `n tags` | Top primary actions OK; craft collapse OK |
| Draft 390 | **Mixed** | Ecosystem kept (good) but **project + Canon clip** (`Harbor Dr…`, `Ca`) | Width ratio may pass while **label truncation** fails the eye |
| Companion Check 1440 | **Job OK, rest cold** | Run Continuity present; **empty middle** (P4) | Face count ≤5 passes; **resting-state emptiness** invisible to ratios |
| Companion 390 | **Loud chrome** | Faces **wrap** (Inbox second row) | Face **count** passes; **row count / wrap** fails |
| Lab empty | **OK** | No filter row; composer owns kinds | “Filter hidden when 0 cards” is the right check |
| Lab with cards | **OK** | All + Kinds overflow | Dedupe check > chip count alone |
| Canon map 1440 | **Loud** | Propose always open; kind filters ≈ view weight | **Chrome-to-work can still look “fine” if map min-height is large while propose steals the fold below the first screen** — need fold ownership, not only full-page % |
| Binder park D9 | **OK** | Editor not stuck outside Canon | State machine, not a density ratio |

Your sample metrics still include **Continuity** as a topbar primary (`topN: 9`, Continuity primary class). **Re-measure on current `dev` @ ≥8911406** before locking numbers. Stale baselines will bake the old sin into the budget.

---

## 2. Right things to measure (keep / change / add)

### A. Shell / topbar

| ID | Measure | Proposed threshold | Severity | R1 note |
|----|---------|-------------------|----------|---------|
| T1 | Count of **place** controls in ecosystem | exactly **3** (Draft·Lab·Canon) | **HARD** | Locked IA |
| T2 | Topbar **job** controls that are not places (Continuity, Export, Research, Review, New…) | **0** permanent | **HARD** | User ruling; Continuity removal |
| T3 | Topbar interactive controls (icons + places + project) excluding overflow menus | **≤ 8** desktop; **≤ 8** phone visible without horizontal trap | **HARD** desktop / **WARN** if phone needs one overflow | R1 phone still tight after Continuity removal |
| T4 | **Truncation** of ecosystem or project label (ellipsis / clipped glyph) at 390 | **0** clipped place names | **HARD** on 390 | P2 — ratio will not catch `Ca` |
| T5 | Touch target min on topbar icons @ ≤640 | **≥ 44px** (`--size-touch-min`) | **HARD** | Non-negotiable a11y |
| T6 | Continuity (or Check tools) as `variant=primary` in topbar | **0** | **HARD** | Equal weight forbidden |

**Eye-fail while number-pass:** T3 passes with 8 controls but project title is unreadable. **T4 is mandatory** beside any count.

### B. Chrome-to-work ratio

Define regions explicitly or the metric lies:

- **work** = `#workspace` primary surface (manuscript paper / lab grid / graph canvas|stage)  
- **chrome** = topbar + binder rail/drawer + companion rail/drawer + in-workspace tool strips (craft row, graph header+toolbar+editor, lab filter+composer)

| ID | Measure | Threshold | Severity | Caveat |
|----|---------|-----------|----------|--------|
| R1 | At **1440 Draft**, both rails open: `work / (work+chrome)` height or area | **≥ 0.45** work share (**WARN** if 0.40–0.45; **HARD** if &lt; 0.40) | split | Your snapshot ~0.47 work — calm enough on Draft |
| R2 | At **1440 Draft Focus**: binder+companion hidden | work share **≥ 0.85** | **HARD** | Focus must feel pure |
| R3 | At **1440 Canon**, Propose **collapsed**: map/stage height **≥** sum(header+toolbar+collapsed editor) | map owns fold | **HARD** | Catches P1 better than full-page % |
| R4 | At **1440 Canon**, Propose **open**: allowed; but default load must start collapsed | default `open=false` | **HARD** | State, not ratio |
| R5 | Full-page chrome % alone | **do not HARD-fail on this alone** | — | Can pass while first fold is tools |

**Eye-fail while number-pass:** Full document chrome 48% but the **first viewport** is 70% form. Prefer **first-fold work share** (viewport intersection) over document height.

Recommended primary metric: **viewport work share @ load** for Draft and Canon, rails in default open state for desktop.

### C. Companion faces

| ID | Measure | Threshold | Severity |
|----|---------|-----------|----------|
| F1 | Face tabs per context | writing **≤ 5**; lab **≤ 3**; graph **≤ 3**; details **≤ 4** | **HARD** |
| F2 | Face **rows** at 390 (wrap count) | **1 row** | **HARD** on ≤640 | R1 P3 |
| F3 | Footer primary actions on a face | **≤ 1** true primary; total footer actions **≤ 3** | **WARN** at 3, **HARD** at ≥4 |
| F4 | Resting empty face (no list, no copy, only footer) on default Check | **forbidden** — need ≥1 line orientation or last-run status | **HARD** | R1 P4 — **no ratio catches this** |
| F5 | Inbox badge as count only (not a second permanent proposal wall on Chat) | Chat must not list all proposals by default | **HARD** | IA |

### D. Chips / filters

| ID | Measure | Threshold | Severity |
|----|---------|-----------|----------|
| C1 | Desktop craft tags visible before overflow | **≤ 5** + one “n tags” control | **HARD** | D8 accepted |
| C2 | Phone craft | single disclosure row collapsed default | **HARD** | D8 |
| C3 | Lab kind filter full strip when `liveCards===0` | **hidden** | **HARD** | D3 |
| C4 | Lab filter when cards exist | All + overflow (not full duplicate of composer) | **HARD** | D3 |
| C5 | Canon kind filters visual weight vs Network/Family | filters must not use accent-primary language equal to view switch | **HARD** (style assertion or computed contrast/weight) | D4 |
| C6 | Visible equal-weight chips in one toolbar group | **≤ 5** before overflow | **WARN** at 6, **HARD** at ≥8 | Hick / scan |

### E. Primary actions

| ID | Measure | Threshold | Severity |
|----|---------|-----------|----------|
| P1 | Simultaneous **primary** (`variant=primary` or accent fill) in one viewport region | **≤ 1** | **HARD** |
| P2 | Permanent topbar primaries that are jobs | **0** | **HARD** |
| P3 | Competing accent hues in one region (topbar, graph toolbar, companion face row) | **≤ 1** accent family | **WARN** (hard later if measurable) |

### F. Touch / type

| ID | Measure | Threshold | Severity |
|----|---------|-----------|----------|
| A1 | Interactive hit ≥44px on max-width 640 | **100%** of topbar + face + summary controls | **HARD** |
| A2 | Desktop hit ≥ `--size-control` | **100%** | **HARD** |
| A3 | Distinct text sizes in one region (topbar / face row / graph toolbar) | **≤ 2** | **WARN** |
| A4 | Body/paper contrast vs chrome | paper not same surface as tool strips | **WARN** |

---

## 3. Missing from a pure ratio set (must include)

These failed or would fail the **eye** in R1 without failing a naive chrome%.

1. **Resting-state emptiness (P4)** — Check with only footer buttons.  
   - Measure: `face body has meaningful content OR last-run status OR one helper line`.  
   - **HARD**.

2. **Fold ownership** — who wins the first screenful.  
   - Measure: largest content box in viewport center band is work surface, not form.  
   - **HARD** for Canon default; **WARN** for Lab composer-heavy empty state (composer is the work when empty).

3. **Truncation / clip** — ellipsis on place names.  
   - **HARD** at 390 for Draft·Lab·Canon labels.

4. **Wrap** — face tabs or ecosystem onto row 2.  
   - **HARD** at 390 for faces; **WARN** for ecosystem if overflow scroll is intentional and labeled.

5. **Equal weight / accent competition** — Continuity-as-primary was the sin; map kind filters still rhyme with it.  
   - Measure pressed styles: journey switch may use accent; job filters may not match that recipe.  
   - **HARD** once D4 lands; **WARN** until then if you need a ship gate.

6. **Duplicate affordances** — same kind list in filter + composer.  
   - Structural: filter hidden or overflow when redundant.  
   - **HARD** (D3 pattern).

7. **Gate visibility without chrome growth** — Inbox badge count OK; dumping proposals on Chat not OK.  
   - **HARD** behavioral.

8. **Motion / parallax** — not density; skip unless reduced-motion broken.

---

## 4. Hard fail vs warning (policy)

### HARD fail (CI should block merge when asserted)

- T1, T2, T4 (390 places), T5, T6  
- R2 Focus purity; R3–R4 Canon fold + default collapsed propose (after D4)  
- F1, F2, F4, F5  
- C1–C4; C5 after D4  
- P1, P2  
- A1, A2  
- D3/D8 structural locks already accepted in R1  

### WARN (report, don’t block yet)

- R1 Draft work share 0.40–0.45  
- F3 footer action count = 3  
- C6 chip groups 6–7  
- A3 type-size variety  
- A4 surface competition  
- T3 phone control count when overflow pattern exists  
- Full-page chrome% without viewport fold context  

### Do not automate as hard truth

- Exact Miller 7±2 as a chip cap without chunk structure  
- Single global chrome% for all ecosystems (Lab empty is composer-first on purpose)  
- “Feels calm” screenshot AI scores as gate  

---

## 5. Suggested default numbers (if you need a starter table)

Recheck with a fresh probe on current dev; these are **authority targets**, not sacred.

| Budget | Starter number | Severity |
|--------|----------------|----------|
| Ecosystem places | 3 | HARD |
| Topbar job tools | 0 | HARD |
| Desktop work share Draft, rails open (viewport) | ≥ 0.45 | WARN &lt;0.45; HARD &lt;0.40 |
| Focus work share | ≥ 0.85 | HARD |
| Canon default: propose collapsed | true | HARD (post-D4) |
| Canon collapsed: map h ≥ chrome stack h in workspace | true | HARD (post-D4) |
| Writing faces | ≤ 5 | HARD |
| Lab faces | ≤ 3 | HARD |
| Face rows @390 | 1 | HARD |
| Check resting helper/status | required | HARD |
| Craft desktop visible | ≤ 5 + overflow | HARD |
| Lab filter if 0 cards | absent | HARD |
| Primary buttons per region | ≤ 1 | HARD |
| Touch @≤640 | ≥44px | HARD |

Citation pairing (short):

- **Small face/place sets:** Hick–Hyman; Cowan/Miller chunking (your cluster B/C).  
- **Cut extraneous chrome:** Sweller EL (cluster A) — justifies topbar job ban + Focus purity.  
- **Progressive disclosure:** craft/lab/canon collapse — your progressive-disclosure notes + IA §12.  
- **44px:** platform a11y targets (Apple HIG / WCAG 2.5.5 AAA interpretation as product floor on touch profile).  

Do not cite Miller as “therefore 5 craft tags” — cite **scan cost + R1 accept of D8** for the 5.

---

## 6. Where your draft will lie if you only ship ratios

| Loud UI | Passes naive budget? | Need |
|---------|----------------------|------|
| Canon propose open (P1) | Often yes if map min-height large | Default collapsed + fold ownership |
| Check empty (P4) | Yes (≤5 faces, ≤3 footer) | Resting content rule |
| Phone face wrap (P3) | Yes (count ≤5) | Row count |
| Phone `Ca` clip (P2) | Yes (3 places exist) | Truncation assert |
| Kind filters accent = view (D4) | Yes (chip count ≤4) | Weight/accent recipe |

---

## 7. Process

1. Re-probe metrics **without** Continuity on current `dev`.  
2. Encode HARD rows as e2e asserts; WARN as report-only JSON.  
3. Ping ox when `docs/CALM_BUDGET.md` is up for a second pass on wording.  
4. Round 2 product review still preempts this if rat assigns.

— ox
