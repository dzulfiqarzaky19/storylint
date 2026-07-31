<!--
  Tracked decision / milestone record.
  Author: horse (TASK AF, release readiness)
  Kind: milestone-notes
  Span: origin/main tip 184bb3e → origin/dev tip 4327572 (60 commits)
  Use: founder-facing summary for the pending density-pass dev→main merge.
  Do not treat as a live lock — locks live in IA_MAP / CALM_BUDGET / CANON-VOCABULARY.
-->

# Milestone — density pass (dev ahead of main)

**When written:** 2026-07-31  
**Candidate tip:** `origin/dev` @ `4327572`  
**Main tip at write time:** `origin/main` @ `184bb3e`  
**Span:** `git log origin/main..origin/dev` → **60** commits forward  
**Reconcile:** nothing to pull back from main (see below)

This is what an **author** would notice if they opened the app and the docs after this batch — not a changelog of branch names.

---

## Reconcile

| Check | Result |
|-------|--------|
| `origin/main..origin/dev` | **60** commits (product + docs on dev not yet on main) |
| `git log --no-merges origin/dev..origin/main` | **EMPTY** |
| `git diff --stat $(git merge-base origin/dev origin/main) origin/main` | **EMPTY** (merge-base `fef9fa2`; main tip `184bb3e` is a pure `--no-ff` bubble) |
| Unique product on main | **None** |

**Honest story:** sixty commits forward. Nothing to reconcile from main. The merge will be clean when the holds below lift.

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

## Hold gates (dev → main does not ship until both clear)

Coordinator holds the milestone merge until **both**:

1. **Calm gate sealed** — checker owns its server (build this tree, ephemeral port, refuse stranger `:5173`), provenance (git HEAD + served bundle) in every artifact. Badger line `storylint/e2e-calm-gate` / worktree `storylint-e2e-health`. A ghost PASS on someone else’s Vite is not a seal.
2. **Canon sheet dirty-guard** — pre-existing **LOST-WORK** defect: leaving a Canon sheet detail with unsaved identity edits discards them silently (no dirty flag, no confirm). Not a regression from this density batch, but it would ride to main in this merge. Fix under `storylint/a11y-focus` (koala). Milestone is **gated on that fix landing on `origin/dev`**.

Horse does **not** perform `dev → main` or delete branches.

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
- **Calm checker exists** as offline DOM geometry (`7eb089e`). Server ownership + provenance is hold gate #1, not claimed sealed solely by `4327572`.

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

## Known defect riding this tip (must not ship silent)

| ID | Surface | Defect | Status |
|----|---------|--------|--------|
| LOST-WORK | Canon sheet detail | Leave sheet with unsaved identity field edits → changes discarded with **no dirty flag and no confirm** | Pre-existing; fix on `storylint/a11y-focus` (koala). **Milestone hold #2.** |

Density-pass UI work did not introduce this. Shipping the milestone without the guard would still put silent data loss on `main`.

---

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
- **Calm gate server ownership** and **Canon dirty-guard** are holds, not claimed done solely by tip `4327572`.
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

Commit to `main`, merge `dev → main`, or delete remote/local branches without explicit coordinator go-ahead.
