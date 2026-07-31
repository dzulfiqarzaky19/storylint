<!--
  Tracked decision / milestone record.
  Author: horse (TASK AF, release readiness)
  Kind: milestone-notes
  Span (write-time snapshot): origin/main tip 184bb3e → origin/dev tip 4327572 (60 commits)
  Shipped main: de58c14 (Merge dev into main: density and calm milestone)
  Forward count at main merge: 128 (parents 184bb3e + 2b2cc4d)
  Use: founder-facing summary of the density-pass milestone and what verification taught.
  Do not treat as a live lock — locks live in IA_MAP / CALM_BUDGET / CANON-VOCABULARY.
-->

# Milestone — density pass (shipped to main)

**When written:** 2026-07-31  
**Write-time candidate tip:** `origin/dev` @ `4327572` (historical snapshot — not current)  
**Main tip at write time:** `origin/main` @ `184bb3e` (pre-ship)  
**Shipped main:** `origin/main` @ **`de58c14`** — `Merge dev into main: density and calm milestone`  
**Merge parents:** `184bb3e` (old main) + **`2b2cc4d`** (`origin/dev` tip at merge)  
**Forward count at main merge:** **128** (`git rev-list --count 184bb3e..de58c14`)  
**Historical forward counts (do not reuse as current):** 60 @ write · 87 @ `cc8f224` · 110 @ `888d192`  
**Post-ship `origin/dev`:** continues forward; trees matched at ship. Re-count later with `git rev-list --count origin/main..origin/dev`.  
**Reconcile:** nothing unique on main beyond the milestone bubble (see below)

This is what an **author** would notice if they opened the app and the docs after this batch — not a changelog of branch names.

---

## Reconcile

| Check | Result |
|-------|--------|
| Write-time `origin/main..origin/dev` | **60** (historical) |
| At ship: second parent of main | **`2b2cc4d`** |
| At ship: forward count | **128** |
| `git log --no-merges origin/dev..origin/main` at ship | **EMPTY** (main bubble only) |
| Coordinator post-ship: `git diff --stat origin/main origin/dev` | **EMPTY** |
| Unique product on main beyond the milestone | **None** |

**Honest story:** the density-pass batch shipped as one `--no-ff` bubble on main. Dev kept moving after; that is expected.

### How to check divergence on this repo

Do **not** treat `git log origin/dev..origin/main` being non-empty as a warning. Every `--no-ff` merge into `main` leaves a merge bubble on main that `dev` has never had as a first-parent tip. Expected steady state.

Real divergence tests (both must be empty before calling main “ahead with unique work”):

```
git log --no-merges origin/dev..origin/main          # must be empty
git diff --stat $(git merge-base origin/dev origin/main) origin/main   # must be empty
```

If either is non-empty, stop and tell the coordinator. That is unique content or a tree fork, not a bubble.

(Also land this aside in [GIT_WORKFLOW.md](../GIT_WORKFLOW.md) so the next agent does not burn a cycle on the false alarm.)

---

## Hold gates (dev → main)

### Original three — **all lifted**

1. ~~**Calm gate sealed**~~ — **LANDED** `d031c58` (`storylint/e2e-calm-gate` / badger). Owned stack, provenance in artifacts, stranger default refused.
2. ~~**Canon sheet dirty-guard (in-app leave)**~~ — **LANDED** `cc8f224` (`20c5c3c`). Refresh/tab-close still open debt — see defects.
3. ~~**Smoke repair**~~ — **LANDED** deer `99c952f` / `d0b4b5c`. Lifted earlier.

### Seal’s first real output (proof it works)

On a provenanced calm run against owned UI:

```
provenance head=888d192 owned=true shell=2c416be35924 ui=http://127.0.0.1:52050/
```

A smoke pointed at the stranger default now **REFUSES** with `Refusing stranger default :5173` instead of ghost-passing on someone else’s Vite.

### Fourth hold — `npm run test:green` — **LIFTED / SHIPPED**

Historical red on `888d192` (test-side F + L) held main until fixed. Ship evidence of record is the coordinator run **on main itself** after `de58c14` landed:

```
provenance head=de58c14 owned=true shell=2c416be35924 ui=http://127.0.0.1:56371/
guard PASS · build clean · unit 115/115
smokes 8/8 PASS — e, f, g, h, i, j, k, l
calm HARD fails 0 / checks 47
```

### How main actually moved — both facts

1. **Process was wrong.** Horse pushed `de58c14` to `origin/main` by **operational accident**: a mutating `git push origin HEAD:main` was buried inside a verification one-liner whose success output was swallowed by `findstr`. The single `test:green` horse had run on that merge result was **red** (slice-j). A push you cannot see is an **unattributed action** — same defect class as an unattributed measurement. Rule: never combine verify with mutate; never filter mutator output. Encoded in [GIT_WORKFLOW.md](../GIT_WORKFLOW.md) and `npm run land`.
2. **Outcome was correct.** Coordinator verified the shipped tree green on main (evidence block above). `git diff --stat origin/main origin/dev` empty at verify. Parents exactly `184bb3e` + `2b2cc4d`. **Main stays at `de58c14`.** No revert, no force-push, no theatre. History honesty over a tidier process story.

Horse reported the accident immediately with full facts and stopped. That is why it cost minutes, not a day.

### Process fix that followed — `npm run land`

Three agents the same day produced correct **content** through wrong **process** after reading the docs (buried filtered push; reverse first-parent bubble; raw non-merge tip on dev). Documentation was not the failing part. **`npm run land -- storylint/<topic> --summary "…"`** is now the land instruction: clean tree → merge `origin/dev` into topic → `test:green` on that result → detach `origin/dev` → `merge --no-ff` → `push HEAD:dev` unfiltered → fetch and print the origin hash. Manual sequence remains fallback only. Bad bubbles already on the graph are **not** rewritten.

---

## What an author would notice

### Structure (where things live)

- **Three places stay three places.** Top bar is Draft · Lab · Canon. Continuity is **not** a top-bar job button anymore — it lives only as the Companion **Check** face action (`8911406` / `27e3f49`, ruling `fe9d999` / `f5805ca`).
- **Narrow top bar keeps the three ecosystems.** Phone width no longer drops Lab/Canon off the chrome (`fef1406` / `b65ffd2`; legibility follow-up `cbceb68` / `0510b22`).
- **Sheets stay in the binder stack.** Opening a Canon (or Lab) sheet is Level-3 **in the binder**, list still mounted underneath — not a second center app (`4196e3c` after ox adjudication). Center job per place stays one job (Canon center = map of accepted truth).
- **Empty project still has a binder.** The left rail paints its structure even with no chapter selected (`9578f69` with D1 rail work `1af399e` / `a2ed7bd`). An empty desk is not a void with a floating manuscript.
- **Binder park/restore (D9)** and Lab/craft density batch keep the list from feeling like a stuck editor outside Canon (`019a727` / `5750714`).

### Density (how loud the desk feels)

- **Manuscript owns the desk.** D1 rail budget: work column gets the majority; rails are sized so the page is the product (`1af399e`, merge `a2ed7bd`).
- **Phone chrome hits are real targets.** Project menu and ecosystem controls pushed toward 44×44 on narrow (`2bbd343`).
- **Lab empty is quieter.** No filter row when there are zero cards; kind UI does not shout on first open (`019a727` + calm B4 checks).
- **Craft tags collapse.** Desktop craft stays a short visible set + overflow; phone craft is meant to start collapsed (budget + surface work; phone collapse still flaky under calm — gate ownership is separate).
- **There is a number bar, not vibes.** `docs/CALM_BUDGET.md` + `npm run calm` (`99a84be`, r2 `9126c49` / `3c233c7`, nits `f0d32b2` / `270a7d5`, checker `7eb089e` / `0163a42`). HARD fails exit nonzero; WARN does not. Scoreboard tracked at `e2e/output/calm-budget-run.md` (`aee8833` / `5774886`, split rule `c5079ac`).

### Empty states and first run

- **Check face rests with instruction**, not a dead panel: “Nothing checked yet” + how Continuity works, then status after a run (D6 resting — `ccb729f` / `5db610c`).
- **Inbox is a badge face**, not a wall of proposals inside Chat (`ccb729f`).
- **Canon kind labels speak plain language** in the binder: Characters / Lore / World / Organizations (see also “deliberately not” — the wrong rename was tried and undone).
- **Binder empty / structure** readable without inventing a fourth place.

### Companion (right rail)

- **Writing chrome shape:** Chat · Write · Check as the daily loop; **Inbox** always present (badge when pending); **Research** behind **More** (`ccb729f`, accept `5db610c` / design-review-d6).
- **One face row on phone** — wrap disabled; horizontal strip preferred to a second row of tabs.
- **Footer discipline:** ≤1 primary on Check (Run Continuity); Write keeps co-write skills without a fake hero button.
- **Default face stays Chat.** Continuity is a verb on Check, never a top-bar peer to Draft/Lab/Canon.

### Determinism and test honesty

- **E2E smokes isolate projects** and harden draft/sheet selectors so parallel agents and leftover `data/projects` stop poisoning runs (`66170e3` / `5e087f3`).
- **Deterministic LLM fixtures + hard timeouts** on smokes so a live model cannot hang the suite (`7aef882`).
- **Calm checker exists** as offline DOM geometry (`7eb089e`). Server ownership + provenance **sealed** at `d031c58`; write-time tip `4327572` never claimed that seal alone.

### Docs and process (why the next person does not rebuild the wrong product)

- **Corpus map** at `docs/README.md` — one owner per rule family; “new engineer wrong turns” list (`e1a135c` / `4d7ab50`).
- **CANON-VOCABULARY** locks user-facing words (`b8fa22a` / `a5929c2`).
- **DOCTRINE_AUDIT** ranks contradictions that almost caused wrong builds (`93d103d` / `70c0bd2`); IA_MAP status annotations after (`e645b39` / `ae9687c`).
- **`docs/decisions/`** holds judgments that survive clone/clean (`9679617` / `3fc7aa7`, reconcile `b0cefce`).
- **CODE_VERIFY** adversarial matrix: VERIFIED/STALE with file:line vs origin/dev (`0506429` / `4327572`).
- **GIT_WORKFLOW hardening:** push is part of merge; branch off `origin/dev`; report origin hash; worktree scars (`845f1a1` / `6763a39`).
- **AGENT_PROTOCOL:** report on state change, shippable slices, no silent progress (`5be6b5c` / `5cdb6da`).
- **Research pack** overwhelm evidence restored and wired (`886ff2b`, `1f54dec`).

### Binder / Canon polish (Task L line, after L2)

- Binder polish and plain-language Canon entry kept (`1e422bd` / `e64da20`).
- Kind **rename experiment removed** — see next section (`f98510d` / `83a48e9`).

---

## Known open defects (ride into main unless fixed)

Deliberate debt. Understood. Not forgotten. Act here before rediscovering by accident.

1. **Refresh / tab-close still drops unsaved Canon identity edits.** Koala’s guard (`20c5c3c`, merge `cc8f224`; `sheetIdentityDirty.ts`) covers **in-app** leave only (Back, binder sheet switch, ecosystem Draft/Lab/Canon → Save/Discard/Cancel). Reload and tab close still discard draft identity with no prompt. Real fix is **draft persistence**, not `beforeunload`. Cite koala’s note / commit message on `storylint/a11y-focus`.

2. **Checker measurement correctness after seal.** Even with badger’s owned server + provenance, some checks can still conflate **hidden / absent / collapsed**. Standing rule: [rule-visibility-not-geometry.md](./rule-visibility-not-geometry.md) (bear, Task AG) — never infer visibility from geometry; use `checkVisibility` + closed-`<details>` guard; absence is not a pass. Audit found **9 visibility decision sites** in `e2e/` (27 geometry reads; only decisions need the predicate). Sibling false-green classes M1–M3 in [calm-budget-r3-ox.md](./calm-budget-r3-ox.md).

3. **Lab kinds authored in three places, three vocabularies.** (a) `LabBench.tsx` `KIND_LABEL` map, (b) Companion Spark presets (`AgentPanel` / `Shell` spark kinds + labels), (c) `src/agent/run.ts` parse `Set` / model prompt kind union. Nothing enforces they move together. Single-owner task queued — **not done**.

4. **bible → Canon dialect sweep incomplete.** Done on Companion writing badges (`@canon` in `AgentPanel` / topbar path, `7ad8557` / `86f8c85`). **Still open:** graph kind chips raw enums (C5) — CODE_VERIFY special #1 @ `RelationshipGraph.tsx` filter/node labels; deer D4 map chrome landed structure but C5 labels remain debt. Do not claim the dialect sweep finished.

5. **B4-craft checks load-bearing on copy.** `e2e/calm-budget.mjs` `measureCraft` still leans on `[aria-label*="craft" i]` / Tags strings alongside class selectors. Manuscript owns `aria-label="Chapter craft tags"`. A copy audit that rewrites that string can false-green or false-red craft collapse without a product change. Prefer stable `data-*` / owned class contracts over label substrings.

6. **slice-j / uncreated entity (9th verification lie).** Smoke must create every project it uses; never `selectOption('default')` against ambient identity. See verification table. Horse bare-worktree reds during the main merge attempt were **correct stops**. Badger follow-ups (create both projects; drop `networkidle`) landed on `origin/dev` after main ship. Main @ `de58c14` still carries the pre-fix smoke; post-ship dev is ahead for that repair.

---

## What we learned about verification

**Root cause:** a check that cannot say **what it measured** (on which HEAD, which bundle, which element, visible how) is not evidence. Ways checks lied this session — same disease (unattributed input):

| Lie | What we saw |
|-----|-------------|
| Ghost PASS | Green calm/scoreboard on someone else’s Vite / wrong HEAD |
| Geometry-as-visibility | Non-zero box inside closed `<details>` counted as “present” |
| Dead selector | Class list never matched real DOM; PASS because measure was empty |
| Absence = pass | `chips.length === 0` treated as “correctly collapsed” |
| Label ownership | Asserting on aria-label / visible copy the product may rewrite |
| Unproven scoreboard | Historical PASS rows reused as current desk truth |
| Split-origin stack | Owned UI + stranger API (e.g. smoke UI owned, API still on `:4174`) — still an **unattributed** measurement |
| Uncreated entity (9th) | `slice-j` selected a project it did not create (`'default'`). Same disease as #1: **unattributed input**. Pass/fail looked like a flake across worktrees until the test line was read. **Property that holds:** a test may only use entities it created in-run; never select ambient `'default'`. **False mechanism (discarded):** “needs gitignored `data/project.json` seed” — server always synthesises `default` (`http.ts`); badger negative control wiped `data/` and old smoke still found `default`. Horse bare reds / warm greens were real variance with a still-open residual cause after the create-both fix path; do not re-label as flake. |

**Rules (keep):**

1. **Provenance or it is not evidence.** Owned server, git HEAD, served bundle hash — or refuse (not green). Provenance must cover **every origin a test talks to**, not only the one it renders.
2. **Never infer visibility from geometry.** `checkVisibility` + closed-`<details>` — [rule-visibility-not-geometry.md](./rule-visibility-not-geometry.md).
3. **Absence is not a pass.** PASS / FAIL / **NOT-MEASURED**; NOT-MEASURED fails the gate.
4. **Assert on behaviour, never on a label you do not own.** Prefer roles, `data-*`, and stable structure over marketing copy.
5. **A test may only interact with entities it created in that run.** (ninth lie — verified property; ambient-data mechanism discarded)
6. **Never combine verify with mutate; never filter mutator output.** Same principle applied to actions — [STANDING_RULES](./STANDING_RULES.md) §9–10.
7. **A fix can be correct while its stated cause is wrong.** Prefer an open question over a confident false mechanism — [STANDING_RULES](./STANDING_RULES.md) §11.
8. **A defect found once is a hypothesis about a class** — grep the mechanism, count sites, fixer owns the sweep — [STANDING_RULES](./STANDING_RULES.md) §12–13.

### Scar — rat (coordinator), same hour, twice

Inferred mechanism from symptom without reading the code that settles it:

1. Pass/fail variance → “race/flake.”
2. Pig’s bare-worktree seed remark → “ambient gitignored `data/project.json`.”

Badger’s negative control (wipe `data/`, old smoke still finds `default`) and a read of `src/server/http.ts` disproved (2). The fix (create both projects) stands. The false cause does not. Written here so the rule set stays credible when the enforcer is the one who broke it.

**The gate held the milestone.** Two test-side failures, no product impact, and we waited anyway. A gate that can be overridden by the person who built it is advisory, not a gate.

These outlive every feature in this milestone. Citable green = `npm run test:green` only.

---

### Class over instance (session pattern)

Standing rule: [STANDING_RULES](./STANDING_RULES.md) §12–13. Detail here so the short rule stays short.

**Infrastructure — one surface, shared mechanism:**

| Looked like | Actually was |
|---|---|
| Bad calm verdict | Missing **server-ownership** layer used by every measurement |
| One wrong visibility check | Wrong **rect predicate** in nine sites + a guard shaped wrong even where present |
| One broken smoke “Back” | **Locator convention** coupling three smokes to copy they did not own |
| slice-j slow (60s) | `reload`+`networkidle` in **nineteen** places (five in helpers, two in the gate) |

**Product — each part fine, composition wrong:**

| Looked like | Actually was |
|---|---|
| Empty-state primary doors each OK | **Composition** dual-primary across regions ([one-primary-door-per-job](./one-primary-door-per-job.md)) |
| Nine busy controls each locally reasonable | **Global flag** forced into a specific claim (busy label lie) |

Every time, grepping the mechanism found more sites than the reporter had seen. Fix the class (or inventory it); do not only patch the instance.

## What we deliberately did NOT do

These are the landmines. Someone reading only today’s code will re-propose them in three weeks unless this section stays.

### 1. Vocabulary rename of sheet kinds (tried, reverted)

- **Tried:** friendlier binder chips such as People / Places & things / Groups (Task L direction).
- **Rejected / reverted:** restore **Characters / Lore / World / Organizations** (`f98510d`, merge `83a48e9`; accept [design-review-l2.md](./design-review-l2.md)).
- **Why:** user-facing lexicon is owned by [CANON-VOCABULARY](../design/CANON-VOCABULARY.md). Dialect split binder↔sheet Kind was closed by **reverting**, not by inventing a second taxonomy. Graph still has residual raw-enum chrome in places — that is C5 follow-up, not permission to rename binder kinds again.

### 2. D5 “open sheet in the center” (pain real, architecture rejected)

- **Tried (as a density-audit fix story):** Canon sheet detail hijacks the binder → move sheet to **center**, keep binder as list, map collapses/splits.
- **Adjudication:** **RETRACTED** as architecture ([adjudication-d5-sheet-binder.md](./adjudication-d5-sheet-binder.md)). IA_MAP §2 / §4.4 **binder Level-3 stack STANDS**.
- **What we did instead:** fix under the stack — sheet form + list mounted, Canon-only form residue F1/F3 (`4196e3c`), park/restore, no second center app.
- **Why:** depth-3 accounting is not pedantry. One center job per place. Center sheet would make Canon into Map-app + Sheet-app and reopen the whole IA.

### 3. Face-count budget as a hard “≤3 writing faces” gate

- **Temptation:** calm means fewer Companion tabs — gate writing faces at **≤3** and delete or bury Research/Inbox.
- **Authority ruling:** writing allow-list **ceiling ≤5**, not a ≤3 ship gate ([calm-budget-authority-ox.md](./calm-budget-authority-ox.md); live bar [CALM_BUDGET.md](../CALM_BUDGET.md)). D6 shape is Chat · Write · Check + Inbox badge + More→Research (`ccb729f` / `5db610c`).
- **Why:** Research is a real episodic tool face, not settings cruft. Inbox must stay findable with a count. Collapsing to three peers without More/Inbox recreates the “everything is primary” problem or hides Continuity’s outputs. Structure checks (wrap, footer primary, resting Check, inbox-not-in-chat-wall) matter more than shaving the allow-list.

### 4. Other non-goals in this batch (so they are not “forgotten features”)

- **No fourth ecosystem.** Research / Graph / Review / Agent remain tools, not places.
- **No Continuity return to the top bar.** Ruling stands after `8911406`.
- **No silent force-push / history rewrite** to paper over multi-agent drift — workflow docs hardened instead.
- **Calm seal** landed (`d031c58`). **In-app** Canon dirty-guard landed (`cc8f224`); refresh/tab-close draft loss remains open debt. **Main shipped** at `de58c14` (see hold section). Write-time tip `4327572` is historical only.
- **Graph kind labels / `@bible`→`@canon` badge** called out as open/wrong-turns in CODE_VERIFY — not silently “fixed” by this pass.

---

## Merge bubbles worth skimming (first-parent style on dev)

Density / product: `5750714` surfaces → `b65ffd2`/`8911406` topbar → `e64da20` binder → `5db610c` companion → `83a48e9` kind revert → `a2ed7bd` rails → sheet stack `4196e3c`.

Calm / measure: `0163a42` checker → `3c233c7` r2 → `270a7d5` nits → scoreboard track `5774886`.

Docs / process: `70c0bd2` doctrine → `a5929c2` vocabulary → `3fc7aa7` decisions → `5e087f3` e2e-health → `6763a39` git scars → `5cdb6da` agent protocol → `4d7ab50` corpus map → `4327572` code verify.

---

## Branch hygiene snapshot (delete nothing without go-ahead)

See AF report to coordinator. Remote `origin/storylint/*` at write time: **15** fully merged into `origin/dev` (safe-to-delete candidates), **3** keep (`auto-f-to-h`, `auto-i-to-k`, `clean` — unique commits, mostly harness-local chore). Local `storylint/calm-rest` @ `6763a39` is already an ancestor of `origin/dev` (no unique work).

---

## Horse must not

Force-push or rewrite `main`/`dev`, delete remote/local branches without explicit coordinator go-ahead, or bury a mutating git command inside a filtered verification one-liner. Land topic→dev with `npm run land`. Main milestone merges still require coordinator order and unfiltered, separate verify-then-push steps.
