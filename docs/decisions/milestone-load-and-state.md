<!--
  Tracked decision / milestone record.
  Author: horse (release readiness / process hardening)
  Kind: milestone-notes
  Span (write-time snapshot): origin/main tip de58c14 → origin/dev tip 8ce391f (59 commits)
  Status: PREPARED — not shipped to main. Coordinator holds until binder scroll@68 verified.
  Use: founder-facing summary of the load-and-state batch after the density pass.
  Do not treat as a live lock — locks live in IA_MAP / CALM_BUDGET / CANON-VOCABULARY.
-->

# Milestone — load and state (prepared, not shipped)

**When written:** 2026-07-31  
**Write-time candidate tip:** `origin/dev` @ **`8ce391f`**  
**Main tip at write time:** `origin/main` @ **`de58c14`** (density-pass ship — do not move without go-ahead)  
**Write-time forward count:** **59** (`git rev-list --count origin/main..origin/dev`)  
**Shipped main:** *none yet for this batch*  
**Hold:** octopus binder scroll restore drift at **68 sheets** (scrollTop 2080 → Back restores 1147). Diagnosed live regression that rode the first milestone uncaught because load was only ever verified at fixture size. Coordinator will call the merge after that fix lands and is verified at 68 sheets.

**Through-line (different from milestone one):**  
Milestone one made empty states honest and built a gate we could trust.  
Milestone two looked at **every surface under real load and at every state we had never examined** — volume, composition, seeded third state, false signifiers, busy perimeter, and the land path agents actually use under tip pressure.

This is what an **author** would notice — not a changelog of branch names.

---

## Reconcile (write-time)

| Check | Result |
|-------|--------|
| `origin/main` | **`de58c14`** (unchanged; hold) |
| Write-time `origin/dev` | **`8ce391f`** |
| Write-time `origin/main..origin/dev` | **59** |
| Unique product on main beyond density bubble | **None** expected (`git log --no-merges origin/dev..origin/main` should stay empty of product commits) |
| Trees at ship (future) | Re-run `git diff --stat origin/main origin/dev` after the hold fix lands |

**Honest story:** density-pass already shipped. This batch is the next natural ship point (≈50–60 commits, fully green at write time) **held on purpose** for one diagnosed load regression, not because the gate is red.

### How to check divergence on this repo

Same rule as milestone one. `git log origin/dev..origin/main` non-empty is **not** a warning — `--no-ff` main bubbles never sit as first-parent tips on dev.

Real divergence tests (both must be empty before calling main “ahead with unique work”):

```
git log --no-merges origin/dev..origin/main
git diff --stat $(git merge-base origin/dev origin/main) origin/main
```

---

## Hold gates (dev → main) — this batch

### Green at write time — **not sufficient alone**

Coordinator evidence on `origin/dev` @ `d06e114` (pre-land-script tip of the green window; land bubble `8ce391f` is docs/process on top):

```
unit 115/115
calm HARD fails 0 / checks 50
FINGERPRINT 401c3c9f
```

Both prior serialising reds closed in this window:

- **B3-inbox-wall@volume** — dolphin Inbox fold + measurement fix (check was sampling Chat, not Inbox)
- **export-slug untitled** — pig seeded-default empty title assertion

### Active hold — binder scroll @ 68 sheets

| Item | Detail |
|------|--------|
| Symptom | Binder scroll restore drifts under load: scrollTop **2080 → Back restores 1147** at **68 sheets** |
| Why it matters | Push-stack promise fails at the size an author with a real bible would notice |
| Why it shipped once | First milestone verified binder park/restore only at **fixture size** |
| Owner | octopus (in flight at write time) |
| Ship condition | Fix lands + verified at **68 sheets**, then coordinator calls merge |

Do **not** ship a second milestone carrying a regression already diagnosed.

### Process that now owns topic→dev

**`npm run land`** self-hosted on this tip:

- First self-test (absolute-green gate): **refused** correctly on pre-existing calm HARD `B3-inbox-wall@volume` — refusal is the proof.
- Ruling (rat): gate = **no-worse** vs a fresh `origin/dev` `test:green` in the same run (failure **identity** compare). Pre-existing reds named, not blocking; introduced reds abort; fixed reds reported. No `--skip-tests`.
- Self-host proof: **`8ce391f`** — `Merge storylint/land-script into dev: npm run land with no-worse gate; milestone records de58c14 ship` (parents `d06e114` + `c12024e`).

---

## What an author would notice

### Composition and empty doors

- **One solid primary per job across the whole viewport.** Empty Canon no longer paints two solid “New sheet” doors (map owns the fold; binder demotes while true-empty). Empty Draft dual-rail keeps one create primary (binder wins when both rails show). Calm **B6-primary-per-job** fixtures lock empty Canon + empty Draft. Rule: [one-primary-door-per-job.md](./one-primary-door-per-job.md).
- **Empty Canon Send is quiet until there is something to relate.** Solid Send proposal stays off until **2+ sheets** (`empty-canon-send` / `b64c7ca`).

### Seeded default is a third state

- First boot still seeds a blank chapter so the desk looks like a desk. **New project stays empty** ([new-project-vs-first-boot.md](./new-project-vs-first-boot.md)).
- Seed is no longer “Chapter One” with a solid Continuity button on empty prose. P1: ownership title (**Untitled** / empty + placeholder), Continuity gated until body has prose, prefer body focus ([seeded-default-first-impression.md](./seeded-default-first-impression.md); lands `3ab02a7` / `3fabc25` / `835bcc4`).
- Export slug for empty title is **`untitled`**, not a lying chapter name.

### Companion under honesty pressure

- **Inbox is a fold + rail-bounded scrollport**, not a wall that overflows the rail (AY). Calm **B3-inbox-wall@volume** measures the **Inbox** face at volume 30, not Chat (`fa17e40` + fold `134669d`).
- **Busy labels name only the in-flight op** (AL). Global busy perimeter: Research gated while busy; nav/Inbox stay free (AV `621933e`).
- **AU live dialect** for Inbox/busy/push; meta de-chatter so status does not narrate machinery the author cannot act on (`68797c5`).
- Job-vs-decision lock alignment kept Continuity prose gate after Inbox merge (`d4e65e4` / `7c2fc22`).

### Contrast and empty chrome (a11y)

- Empty-row copy uses **muted ink** (AW P1) so quiet structure still reads as structure (`d2c9031`).
- Ghost controls keep a **visible border** meeting 1.4.11 silhouette (AW P2) — quiet is not invisible (`f55fcfb`).

### Measurement that finally matches the claim

- **slice-j owns its projects** — create both sides; never `selectOption('default')` (ninth lie). `data-binder-back` for Back (`715e866`).
- **`reload`+`networkidle` banned suite-wide** via `reloadApp` + guard (`c4c5e2b`). slice-j drop alone cut the smoke to ~2s (`c90207b`). Residual: first-`goto` `networkidle` still widespread (including calm) — open, not forgotten.
- **Class-over-instance** standing rule written so the next “one flake” becomes a mechanism count ([STANDING_RULES](./STANDING_RULES.md) §12–13).
- **False-state** class named in research: false affordance, stale status, false signifier — checks that sample the wrong wall are the same disease as green buttons that discard input ([08-false-state.md](../research/ui-ux/08-false-state.md)).
- Decisions corpus map + standing rules page so the next agent finds the ruling without opening six files (`99c3ff2`).

### Land path agents actually use

- **`npm run land -- storylint/<topic> --summary "…"`** is the topic→dev instruction. Fresh baseline on `origin/dev`, merge into topic, second `test:green`, **no-worse identity compare**, detach, `--no-ff` bubble, unfiltered `push HEAD:dev`, print origin hash. Self-host proof on this tip: **`8ce391f`**.

---

## Known open defects (ride unless fixed before ship)

Deliberate debt. Understood. Not forgotten.

### Ship hold (blocks this main merge)

1. **Binder scroll restore drifts at 68 sheets.** scrollTop 2080 → Back restores 1147. Fixture-size park/restore green does not prove load. octopus fix + 68-sheet verify required before coordinator merge.

### Product debt (known, not the hold)

2. **Lab lifecycle ends are incomplete.** Archive is a trapdoor with no restore; **Promoted** is append-only. Literature says archive/trash + filter stays under Lab — no fourth place ([08-false-state.md](../research/ui-ux/08-false-state.md) gap b). Not designed this batch.

3. **Network graph hairball at ~68 nodes.** Layout/model deferred; graph remains a map of accepted truth, not a force-directed toy. Do not claim large-bible graph is calm.

4. **Pass-on-absence class audit in flight (badger).** Visibility / absence / collapsed still a measurement class; standing rule holds ([rule-visibility-not-geometry.md](./rule-visibility-not-geometry.md)).

5. **Research Pin/Propose lack a local working affordance** when the author is mid-read — face shape stands; local working set UX does not.

6. **Refresh / tab-close still drops unsaved Canon identity edits.** In-app leave guard landed in milestone one; durable fix remains **draft persistence**, not `beforeunload` ([sheet-identity-refresh-loss.md](./sheet-identity-refresh-loss.md)).

7. **Lab kinds authored in three places** (LabBench / Companion Spark / agent parse) — still no single owner.

8. **First-`goto` `networkidle` residual** after suite-wide reload ban — gate wait policy, not only speed (`2699530`).

9. **slice-j original bare-worktree failure mode** still unexplained after the create-both fix. Ambient-gitignored-data mechanism **disproven**. Open question preferred over false cause ([STANDING_RULES](./STANDING_RULES.md) §11).

---

## What we learned

### Load is a different product than fixture

Park/restore, graph, Inbox, and primary-door composition can all be green at fixture size and wrong at author size. **68 sheets** is the number that made binder scroll’s lie visible. Future calm/smoke fixtures must include at least one **volume** path for stack and scroll promises — or the promise is untested.

### States we had never examined

| State | Why it lied before |
|-------|--------------------|
| **Seeded default** (chapter exists, body empty) | Treated as “populated” for create doors and as “ready” for Continuity — third state |
| **True-empty composition** | Each surface’s empty door correct alone; dual solid primaries in one viewport |
| **Inbox at volume** | Check named wall A, sampled wall B (Chat) |
| **Busy global flag** | Nine controls looked live while another lane owned the job |
| **Uncreated test entity** | Smoke selected ambient `default` — measured the machine |
| **Land under tip pressure** | Absolute-green gate serialises every agent behind every open red |

### Process

- **Refusal is evidence.** Absolute-green `land` abort on inherited red proved the procedure before no-worse made the tool usable.
- **No-worse keeps the gate honest under multi-agent load.** Identity compare, fresh baseline each run, no `--skip-tests`.
- **Class over instance** is now standing procedure, not advice.
- **False state** is the umbrella name for UI and checks that claim a world that is not true.

Citable land gate = no-worse vs fresh `origin/dev` `test:green` in the same run. Citable product green for main still = coordinator `npm run test:green` on the merge result, plus the **68-sheet binder scroll** verify for this hold.

---

## What we deliberately did NOT do

1. **Did not merge to main** while the 68-sheet binder scroll regression is diagnosed and open. Green unit/calm is not a waiver.
2. **Did not add a fourth ecosystem** for Lab archive, Research working set, or graph complexity. Archive stays a Lab object/filter if it ships; Research stays a face; graph model stays deferred.
3. **Did not collapse first boot into New-project empty.** Seed stays; P1 makes it honest ([seeded-default-first-impression.md](./seeded-default-first-impression.md)).
4. **Did not keep absolute-green as the land gate.** That path disables the script under pressure. No-worse is the ruling.
5. **Did not rewrite bad bubbles** already on the graph. History honesty over beauty.
6. **Did not delete remote topic branches** while agents are mid-task. Same hygiene hold as milestone one.
7. **Did not paper the scroll bug with a fixture-only green.** The hold exists because fixture green already lied once.

---

## Merge bubbles worth skimming (first-parent style on dev, post-`de58c14`)

Process / land: `8ce391f` land no-worse self-host · `1a13a59` land v1.

Seed / first impression: `d06e114` / `b613828` seeded-default P1 · `835bcc4` export slug.

Companion load/honesty: `78aee53` AY Inbox fold · `01a3c07` busy labels · `621933e` AV busy perimeter · `cc40b64` B3 inbox-at-volume.

Composition / empty: `01232e2` B6-primary-per-job · `b64c7ca` empty-Canon Send.

Measure / class: `584b20a` ban reload-networkidle · `794ab83` slice-j owns projects · `3e3698b` class-over-instance · `42ab953` ninth-lie correct · `d66b196` false-state brief.

A11y chrome: `d4f7c86` muted empty-row + ghost border · `583e897` AU live dialect.

Docs map: `02e16a7` decisions index / standing rules.

---

## Branch hygiene snapshot (delete nothing without go-ahead)

Same rule as milestone one. Agents are mid-task (octopus scroll fix, badger absence audit, others). **No deletes** until coordinator orders them. Report candidates only after the main ship call.

---

## Horse must not

Force-push or rewrite `main`/`dev`, delete branches without go-ahead, bury mutate inside filtered verify, or call this batch shipped before the **68-sheet binder scroll** hold clears. Land topic→dev with `npm run land`. Main merge only on coordinator order after that verify.
