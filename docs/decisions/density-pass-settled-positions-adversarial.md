<!--
  Author: dromedary (research / outside reader)
  Kind: adversarial-review
  Task: BJ
  Target: docs/decisions/density-pass-settled-positions.md (ox)
  Companion: STANDING_RULES.md
  Constraint: attack reasoning, not IA locks (3 ecosystems, depth 3, no new panels,
              Continuity=verb, Draft=prose, chapters≠Canon)
  Method: cold read — not present for the density-pass conversations
-->

# Adversarial read — density-pass settled positions

**Verdict:** The document is **mostly sound** as a stop-relitigation map. Several rows are well-warranted and correctly unusual. It is **not** empty of risk. Worst problems first.

**Read against:** ox `density-pass-settled-positions.md` @ `origin/storylint/ox-settled-positions` tip `3b61e40` (and the memos it cites). STANDING_RULES on `origin/dev`. Research: [08-false-state](../research/ui-ux/08-false-state.md).

**What “sound” means here:** a stranger can execute most Therefore clauses without inventing product.  
**What still fails the six-week test:** rows whose warrant is “we tried it” without the failure mode, and a few **unwritten operating rules** the pass clearly used.

---

## 1. Underjustified (will not survive “who said ox”)

### U1 — §5 Lab “transient bench” + Promoted dismiss (strongest product under-warrant)

**Position claims** Lab must not become a second forever-store; Promoted = dismissible receipts; archive = state with Restore; no hard delete v1.

**What a stranger gets:** a full product model.  
**What is thin in the *settled* page itself:** *why* dismissible history beats (a) forever audit, (b) TTL auto-drop, (c) move receipts to Inbox. The long form in `lab-lifecycle-ends` has the table; the settled page compresses to preference + “Canon is the ledger.”

**Attack:** Without the Accept-path / ledger argument on the short page, a new PM will re-open “Lab should keep an audit trail of promotes” on first support ticket about a missing receipt.  
**Fix the short form (ox, not me):** one sentence — *Canon+Inbox are the ledger; Lab Promoted is a convenience trail whose dismiss cannot unwind Accept.* Already in §4 one row; **repeat it inside the Lab table**, not only under Canon.

**Severity:** medium. Content exists in cite; short page under-carries the load-bearing half.

### U2 — §6 “Do not build search from 68-sheet evidence”

**Position:** binder @60+ navigable; search = comfort later, not must-ship.

**Attack:** “We looked at 68 and kind sections were enough” is a **single-session expert read**, not a wayfinding study. Literature on large collections (libraries, note vaults, Scrivener binders) almost always grows search/filter before ~100 objects. Refusing search *from this pass* is fine; stating navigable-as-settled without “until dogfood pain / N per kind” invites either premature search *or* permanent under-tooling.

**Better warrant:** *No search from AZ alone. Reopen when a real bible shows find-failure (e.g. >N per kind or timed find task fails).*  
**Severity:** medium-low. Direction OK; criterion missing.

### U3 — §6 Family “usable / D4 closed” vs Network “hairball deferred”

**Attack:** Same seed, two different bars. Family closed on metrics (minDist, close pairs). Network left open as “honest dense mode.” A stranger cannot tell **what metric would close Network** or **what would reopen Family**. “Deferred not denied” is honest process; it is weak product settlement.

**Severity:** low for ship; high for “stop arguing in six weeks” unless AZ options A–D get a default lean on the short page (even “default A until dogfood”).

### U4 — §8 “User-facing noun invention without ox sign-off”

**Attack:** Pure authority clause. Correct as process; fails the “new team” test unless pointed at **CANON-VOCABULARY ownership** (already a lock).  
**Fix:** cite vocabulary owner, not designer name.  
**Severity:** low (process), easy.

### U5 — §2.3 “Boot may seed Chapter One” vs seeded-default P1 (title must not be Chapter One)

**Attack:** Settled short form still says “Chapter One” as the boot example while the binding first-impression ruling **rejects** that factory label. A stranger implementing seed from §2.3 alone reintroduces the ownership lie.

**Severity:** medium — **internal inconsistency of the short page**, not of the product model (P1 is clear in the long memo).

### U6 — Rows that are “tried/reverted” without failure mode on the short page

People/Places (§1.2), D5 center sheet (§1.1), ≤3 faces (§3.2): the **Therefore** is strong; the **why it hurt** is only in long cites. For stop-relitigation, one clause each is enough:

| Rejected | Minimum warrant on short page |
|---|---|
| Kind rename | Dialect split binder↔sheet / lexicon owner |
| Center sheet | Breaks one-center-job + depth accounting |
| ≤3 face diet | Hides Inbox count or Research episodic tool; allow-list≠primary peers |

Without that, “we tried it” sounds like taste.  
**Severity:** medium for six-week survival; low for current team.

### U7 — Measurement §7 “boolean hides multi-state” (warrant OK, placement odd)

The rule is excellent and *better* justified than several product rows. It is almost buried as measurement. Fine if STANDING_RULES §14 lands; weak if only here.

---

## 2. Tensions (including quiet ones)

### T1 — one-primary-per-job × runnable-solid — **resolved in long form, under-signaled on short page**

Long form (`runnable-solid-precondition`) correctly says: same screen can **pass B6 letter and fail runnable spirit** (empty Canon New sheet + Send = two jobs). Settled §2.1–2.2 states both rules but **does not state the collision class**.

**Risk:** implementer greens B6 and ships solid Send again.  
**Needed one line in §2:** *B6 counts competition; runnable-solid gates entitlement. Passing either alone is insufficient.*

**Severity:** high (already bitten once). Easy fix.

### T2 — jobs-vs-decisions × one-assistant — **resolved, but resource story is hand-wavy**

Model B (decisions free under jobs) is the right unusual call and matches writing-tool practice (08 gap c). The settled page states it cleanly.

**Residual tension not settled:**

| Pair | Can race? | Short page |
|---|---|---|
| Continuity finishing proposals **while** Accept on overlapping proposal set | yes | “stale Continuity output after Accept is acceptable” lives in long memo only |
| Apply to chapter body **while** author types same chapter | yes | generation/mutation “if any” — not a position |
| Pin during Research query | “UI consistency only” | soft |

**Attack:** You rejected distributed locks (good) but also rejected stating **last-write / generation** as product law. Six weeks out, a data-loss bug becomes “concurrency model unclear.”  
**Not a demand for run ids.** Demand: one sentence on **author decision wins / last explicit write wins** for chapter body and proposal Accept.

**Severity:** medium. Model B stands; completeness gap.

### T3 — boot-vs-new-project × “same empty rulebook when empty” × seeded third state — **mostly consistent, one sharp edge**

| Arrival | Empty? | Rulebook |
|---|---|---|
| New project | true-empty | empty doors |
| First boot | seeded-blank | **not** empty — third state |
| After delete-all chapters (no delete today) | would be empty | empty doors |

**Attack:** “Same empty-door rules when empty” is true and easy to misread as “boot and new project share chrome.” Seeded is explicitly *not* empty. Short page §2.3 says third state — good — but the boot row still reads like empty-adjacent.

**Runnable-solid on seeded:** Continuity gated on body — correct. **Create doors** on seeded use populated demote (ghost New chapter) — correct per long form.  
**Latent tension:** if seed title becomes empty/Untitled and body empty, does binder show **true-empty create primary** or **seeded ghost**? Today branches on `chapters.length`, not title. Document that **row existence**, not title fullness, selects the branch — or the next person “fixes” Untitled into true-empty doors.

**Severity:** medium for implementers; low if one predicate sentence is added.

### T4 — Lab archive Restore × “Lab is transient” × Canon ledger

Archive-with-Restore keeps cards forever in domain (no hard delete). Transient Lab + infinite archived set = **quiet second store** under a filter.

**Attack:** You rejected forever Promoted audit, then allowed forever Archived bodies. That can be right (think preserved, not promoted receipts) but it is a **tension with “transient”** unless transient means *live bench*, not *disk*.

**Severity:** medium conceptual; low if “transient = live surface” is explicit.

### T5 — Inbox free decisions × Continuity marks on Draft (split attention)

Author may Accept while Continuity runs; Continuity may then paint marks/proposals on a world the author just changed. Long form accepts stale output.

**Literature tension:** contiguity / trust (gates pack) prefers proposal validity at decision time.  
**Defense available:** marks are Draft diagnostics, Accept is Canon — different resources.  
**Gap:** short page never says **Accept is not invalidated mid-flight** / user is not punished for deciding during the run.

**Severity:** low-medium; one honesty sentence.

### T6 — runnable-solid “omit preferred” × ghost-control silhouette (load-bearing quiet doors)

Omitting solids is correct for false affordance. Remaining **ghost** peers must still read as controls (ox AW silhouette). Short page does not cross-link. Not a logic collision; a **composition miss** for empty desks after demote.

**Severity:** low.

### T7 — “Family closed” × phone Family measure open in AZ

AZ still says re-verify Family@390. Settled §6 states Family usable without viewport qualifier.  
**Severity:** low — add “desktop mesh closed; phone re-measure open.”

---

## 3. Where literature would dispute us (and whether our reason holds)

| Position | Outside practice | Our reason | Hold? |
|---|---|---|---|
| **One assistant, global busy** | IDE agents → multi-session / queue (VS Code 2026) | Novelist desk partner; concurrency is cognitive load | **Hold** — deliberately unusual; 08 supports single-lane + Draft still typeable. Must keep decision-free perimeter or literature wins on patience. |
| **No beforeunload; draft persistence** | Many web apps nag | Writing tools autosave; nag = missing durability | **Hold** — 08 gap a. |
| **No bulk Accept** | Email/GitHub batch actions | Canon identity is high-stakes truth | **Hold** — stronger than mail; matches staged-change / gates pack. |
| **No search @68** | Note apps search early | Kind sections + filters first; search is comfort | **Conditional hold** — OK as pass-scope refuse; weak as permanent. See U2. |
| **Lab no hard delete v1** | Notes apps offer delete+trash | Avoid silent destruction of think | **Hold** short-term; trash is still the mature end-state (08 gap b). Restore-only archive is a waypoint. |
| **Network hairball accepted** | Graph tools cluster/filter-default | Honest dense + filter escape | **Hold if taught**; silent hairball fails recognition. Copy/filter-first lean missing (U3). |
| **Seeded first boot ≠ empty new project** | Many apps one empty template | Two honest arrivals | **Hold** — good. Ownership title + Continuity gate required or seed fails empty-state research (teach next action). |
| **Decisions free under long job** | Some UIs freeze all writes during sync | 20s Continuity must not hostage Inbox | **Hold** — correct unusual; needs last-write honesty (T2). |
| **Sheet in binder stack not center** | Scrivener often editor-center** | One center job; depth law | **Hold** — IA lock; literature is mixed, our reason is structural not taste. |
| **False-state / runnable-solid** | Aligns with Gaver false affordance, Nielsen status | Weight = promise | **Hold** — best-aligned with outside vocabulary (08). |

**No literature finding forces a fourth ecosystem.** Lab archive as Lab state matches 08.

---

## 4. Missing positions (operated on, not written on the short page)

These are the highest-value adds if the goal is stop-relitigation:

| # | Missing position | Evidence we already run on it |
|---|---|---|
| **M1** | **False state** umbrella: control/status/check must not assert an untrue world (false affordance, stale status, false signifier). | Whole pass; 08; B3 Chat-vs-Inbox; busy-label lies; runnable-solid |
| **M2** | **B6 letter ≠ runnable spirit** (explicit). | empty-Canon Send |
| **M3** | **Draft stays typeable** while companion job runs (companion busy ≠ app freeze). | AV perimeter; one-assistant; 08 gap c |
| **M4** | **Cancel in-flight Continuity** — allowed later / not required / forbidden? Currently “optional later,” so unsettled. | AV optional tip |
| **M5** | **Last explicit author write wins** (or generation stamp) for chapter body & proposal Accept vs finishing jobs. | jobs-vs-decisions resource care |
| **M6** | **Seed branch predicate:** `chapters.length` (row exists), not title/body fullness, selects create-door weight; body length selects Continuity entitlement. | seeded-default + runnable-solid |
| **M7** | **Measurement API / owned origins** as product-adjacent law for anyone adding calm checks (beyond “provenance”). | badger Measurement API land; stranger :5173 refuse |
| **M8** | **Land gate = no-worse identity**, not absolute green — process position the pass depends on. | milestone-load-and-state; may live outside product page but STANDING_RULES lacks it |
| **M9** | **Volume fixture class** — stack/scroll/Inbox promises unverified at fixture size are untested. | binder scroll@68; Inbox@30 |
| **M10** | **Ghost secondary after demote must meet control silhouette** (contrast), else demote creates hidden affordances. | AW ruling |
| **M11** | **Promoted dismiss ≠ Canon undo** on the Lab short table (duplicate of §4, currently easy to miss). | lab-lifecycle |
| **M12** | **Network@scale default lean** (even “A: overview + filter-first”) so “deferred” is not “undefined.” | AZ options |
| **M13** | **Lab kinds single owner** (LabBench / Spark / agent parse) — operated as debt, not a settled “do not fork vocabulary” rule. | milestone open defects |
| **M14** | **Check empty success must be this-run scoped** (stale success = lie). Partially under one-assistant; deserves false-state cross-link. | AL-3 |

---

## 5. What is already strong (so this is not a takedown)

Do **not** burn cycles re-arguing these without new evidence — warrant is adequate:

1. **Composition primaries (viewport, not panel)** — structural lesson, checkable, scar-backed.  
2. **Runnable-solid / weight = promise** — aligns with outside false-affordance vocabulary.  
3. **Jobs vs decisions (Model B)** — correct resolution of the free-Inbox vs local-busy collision; unusual for good reason.  
4. **Panel ≠ unit of work** (Research query vs Pin) — prevents the next false mutex.  
5. **D5 retract / kind rename reject / no fourth ecosystem / Continuity off top bar** — locks + scars.  
6. **Absence ≠ pass / visibility ≠ geometry / class-over-instance-with-verify** — measurement half is better than most product orgs write down.  
7. **No bulk Accept** — consistent with Canon stakes.  
8. **Two arrivals (boot ≠ new project)** — right split; only seed *label* needs short-page fix (U5).

---

## 6. Worst-first action list (for ox/pig edit — I do not edit the settled doc)

| Pri | Action |
|---|---|
| P0 | Add **B6 vs runnable-solid** one-liner (T1). |
| P0 | Fix §2.3 boot example: not “Chapter One”; point at Untitled/empty title + third state (U5). |
| P1 | Lab table: **dismiss receipt ≠ undo Canon** (U1/M11). |
| P1 | **Author write wins / stale job output OK** sentence (T2/T5). |
| P1 | **Seed predicate** sentence (T3/M6). |
| P1 | Cross-link **false state** + this-run status (M1/M14). |
| P2 | Search reopen criterion (U2); Network default lean (U3/M12); ghost silhouette (M10); Draft typeable (M3). |
| P2 | Replace “ox sign-off” with vocabulary-owner cite (U4). |
| P3 | Failure-mode clauses on §8 rejects (U6); Family desktop qualifier (T7); Cancel Continuity status (M4). |

---

## 7. Bottom line

**Not an honest empty result.** The spine holds: three places, composition primaries, runnable solids, one assistant with free decisions, explicit Canon writes, Lab as non-ledger. Those will survive a new team **if** the short page absorbs the few load-bearing sentences now trapped in long memos.

**Highest residual risk** is not philosophical. It is **operator error from compression**: B6-without-runnable, Chapter One seed example, and Lab dismiss misread as Canon undo.

**Highest conceptual debt** left unsettled: **write/read races under Model B** (last write), **Lab transient vs forever archive**, and **Network@scale** without a default lean.

Locks untouched. No fourth surface proposed.

— dromedary · TASK BJ · cold read
