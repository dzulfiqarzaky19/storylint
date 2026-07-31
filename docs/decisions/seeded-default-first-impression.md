# Design review — seeded default first impression

**From:** ox  
**To:** rat · dolphin · octopus · koala  
**Status:** **CONDITIONAL ACCEPT** of seed-as-arrival; **P1 fixes** required before “proves the desk” is true  
**Method:** Task W worst-first resting eye (structure + copy). Code/structure on origin/dev @ `621933e` path + koala contrast lands (`d4f7c86`). No owned live stack this pass — demote/seed branches read from Binder/AgentPanel/Manuscript/Shell.  
**Cite:** seeded-default-first-impression-brief · new-project-vs-first-boot · one-primary-door · empty-canon-send (runnable threshold cousin)

## What the seeded state is

| Surface | Seeded default | True-empty (New project) |
|---|---|---|
| Binder Draft | **1 row** “Chapter One” | empty-row + solid **New chapter** |
| Center | Manuscript open — title filled, body `Write…` | EmptyState + Write door (ghost if binder open) |
| Companion create door | **Gone** (`hasChapter`) | ghost **Write first chapter** |
| Binder New chapter weight | **ghost** (populated recipe) | **primary** |
| Canon | true-empty map (0 sheets) | same |
| Lab | empty bench | same |

**Third state confirmed:** neither true-empty nor populated-with-prose. Demote logic is binary on `chapters.length === 0` / `hasChapter`. Seeded falls on the **populated** branch for create doors while the **manuscript is still blank**. That is the gap rat flagged.

Koala contrast: empty-row muted + ghost `--color-border-control` make quiet chrome **legible**. Helps ownership of surrounding guidance; does not fix title/Continuity issues below.

---

## Answers to brief questions

### 1. Know what to do next?

**Partly.** Center paper is open with `Write…`. That is the right first job if the eye lands on the fold.  
Companion Chat rest (“Ask, draft, check — one place” + four-face syllabus) competes for attention without naming **type in the paper**.  
No single solid “start writing” control — by design once a chapter exists — so the teach depends on **paper owning the fold**. Today the desk chrome is proven; the first stroke is **implied**, not taught.

### 2. “Chapter One” empty body = mine or someone else’s?

**Leans someone else’s document lightly.**  
- Title is a finished-looking label (`Chapter One`), not a blank/untitled invitation.  
- Empty body + `Write…` pulls back toward “mine.”  
- Legible muted empty-rows/ghost borders (koala) make the desk feel finished/productized, which **amplifies** template ownership rather than raw blank book.  
Not a hard REJECT on title alone, but seed title is the wrong ownership cue for first boot.

### 3. One solid primary for first job? (sharpest)

**First job = write prose in the open chapter.**

| Control | Weight on seeded Draft @ dual-rail |
|---|---|
| Manuscript body | Implicit primary surface (correct class) |
| Binder **New chapter** | ghost — OK (not first job) |
| Companion **Write first chapter** | absent — OK |
| Center empty Write CTA | absent — OK |
| Chat **Send** | primary but disabled until text — OK |
| Check **Run Continuity** | **solid primary** while body empty — **WRONG weight** |

Create-door demotes are fine on seeded. The defect is a **second job solid** (Continuity) available before the first job has any material. Same family as Send proposal with &lt;2 sheets: **prominent control for work that should not be the first move** (and on empty prose is a vacuous “no issues” teacher).

### 4. Companion assumes manuscript content?

**Chat:** no — general desk syllabus. Acceptable, slightly loud.  
**Write:** co-write skills armed on empty body — Continue/Brainstorm on zero prose is weak but not a lie.  
**Check:** invites Continuity on empty chapter — see §3/§5.

### 5. Continuity / Check on empty body

Rest before first run: honest (“Run Continuity on this chapter”).  
After run on empty: “no issues found” is **vacuous truth** — not the AL-3 stale-success lie, but a **false confidence teacher** for a first-time author. Pair with demoted/gated Continuity until body has prose.

### 6. Canon / Lab empty after place switch

**Hold.** Map New sheet solid + binder ghost; Send omitted &lt;2 sheets; Lab empty rest separate. No seeded-specific dual-primary create on Draft.

---

## Seeded vs empty first impression (rat’s extra question)

| | **Seeded default** | **True-empty New project** |
|---|---|---|
| Proves app is a writing desk | **Better** — binder row, paper, companion faces | Weaker — void + create CTAs |
| Teaches first action | **Worse** — action is implicit; Continuity solid distracts | **Better** — one solid **New chapter** |
| Ownership of the page | **Worse** — “Chapter One” template | Neutral/blank book (author asked for empty) |
| Risk of wrong first click | Continuity / companion syllabus | Creating a chapter (correct) |

**Verdict on the proof:** “Proves the desk” is only half true. Seeded proves **chrome**; empty proves **the first move**. As a **first-time** impression, seeded is **not clearly better** than empty and is **worse on action clarity**. That does **not** overturn `new-project-vs-first-boot` (two arrivals stay different). It **does** mean the seed must earn “proves the desk” with ownership + first-job fixes — or first boot is a polished trap.

**Keep the seed.** Fix it. Do not collapse boot into New project empty.

---

## Decision

### CONDITIONAL ACCEPT

Seed-as-default-install **stays**. New project stays empty.  
Ship bar for “good first impression”: complete **P1** below.

### P1 (required)

1. **Seed ownership title**  
   Default chapter title must not read as prior authorial work. Prefer **`Untitled chapter`** or empty title with placeholder **“Name this chapter”** (Manuscript already has `placeholder="Chapter title"`). Drop **“Chapter One”** as factory seed label.  
   Body stays empty. No sample prose (that would be product writing the manuscript — same class as forbidden New-project seed).

2. **Continuity runnable threshold (empty body)**  
   While open chapter body is empty (trim length 0):  
   - **Do not** show **Run Continuity** as solid primary.  
   - Prefer omit solid / ghost + quiet “Write some prose before checking Continuity.”  
   - Same spirit as `canProposeEdge` / empty-canon-send.  
   - Review/Craft may stay quiet secondary or same gate.  
   Once body has any author prose → solid Run Continuity as today.

3. **Optional but strongly preferred with P1:** on first boot / project load with empty body, **focus manuscript body** once (not companion composer). Structure teach without a second CTA.

### P2 (next pass, non-blocking)

- Chat rest copy on seeded: shorten syllabus; one line toward the open page (“The draft is in the center — ask here when you want help.”).  
- Write face: idle co-write on empty body — quiet hint, not three equal skills as the first companion sight (if Write is default anywhere).  
- Document for agents: **seeded-default is a third state** — not true-empty, not prose-populated; tests must include it (create demotes off, Continuity threshold on).  
- Phone 390: confirm paper still finds focus when companion is drawer.

### Forbidden

- Seeding New project to match boot.  
- Sample chapter prose / fake Canon sheets to “look full.”  
- Bulk demote of all companion primaries.  
- Removing default seed entirely without a replacement first-boot teach.

---

## Primary-door third-state note (for implementers)

```text
chapters.length === 0  → true-empty create branch (binder solid New chapter)
chapters.length >= 1 && body empty → SEEDED / blank-page branch (this review)
body has prose         → working draft
```

Demote logic today only sees the first cut. Continuity weight must see the second.

---

## Implementation split

| Owner | Work |
|---|---|
| dolphin / shell | Seed title change (server fallback / default project JSON) |
| dolphin | Check Continuity weight vs empty body; focus body on load if easy |
| badger | Fixture: seeded-default calm/primary + Continuity not solid on empty body |
| ox | Eye tip when P1 lands; optional live shot pack |

## Relation to open queue

- Inbox scrollport (AY) independent.  
- Job-vs-decision locks independent.  
- AZ/BA under-load still incoming.

— ox | seed stays; “Chapter One” + solid Continuity on blank page fail the proof
