<!--
  Tracked decision record.
  Author: ox
  Kind: design-authority
  Task: T (copy audit — empty states, hints, CTAs, badges)
  Decided: worst-first findings + target copy. Eng may land tone fixes within locked nouns;
            noun swaps still need design sign-off per CANON-VOCABULARY.md.
  Head judged: origin/dev @ 4327572 (+ known D4 tip not required for this audit).
-->

# Copy audit — Task T (ox)

**Scope:** every empty state, hint, CTA, badge, and status notice authors see.  
**Voice test:** one novelist’s desk, one dialect ([CANON-VOCABULARY.md](../design/CANON-VOCABULARY.md)).  
**Priority order:** (1) implies work is gone when it is not · (2) lies · (3) stale screen · (4) dialect split · (5) points at the thing above it · (6) too long for the rail · (7) tone.

**Not in scope:** agent/LLM system prompts (flag only if they leak to UI). Export path `bible/…` may stay internal.

---

## P0 — Lost-work scares (fix first)

### T-P0-1 · Lab filtered empty says the bench is empty

| | |
|--|--|
| **Where** | `LabBench.tsx` — `visible.length === 0` → title **Nothing on the bench** |
| **Bug** | `visible` is **filter-aware**. Cards can exist on the board while a kind filter hides them. Copy claims the bench is empty → author thinks work is gone. |
| **Class** | Lost-work scare (highest priority). |
| **Fix** | Split empty states: |
| | **True empty** (`live.length === 0`): title **Bench is clear** · hint **Add a card below, or ask the companion to brainstorm.** |
| | **Filtered empty** (`live.length > 0 && visible.length === 0`): title **No {Kind} cards in this view** · hint **{n} cards are hidden by the kind filter.** CTA **Show all** (sets filter to All). |
| **Do not** | Reuse “Nothing on the bench” for filtered. |

### T-P0-2 · (Watch) Continuity “No issues found” vs marks elsewhere

| | |
|--|--|
| **Where** | Check / tool card: **No issues found** |
| **Risk** | Fine if scoped to “this run / this chapter.” If marks from a prior run remain visible on paper while copy says none, that is a scare. |
| **Rule** | Always scope: **No issues in this run** or keep **Last Continuity …: no issues found** (already better on Check summary). Prefer the scoped form on the tool card too. |

---

## P1 — Lies and dialect lies (bible vs Canon)

CANON-VOCABULARY §3 already lists these. They are **shipping lies** relative to the locked place word **Canon**.

| ID | Surface | Says now | Target | Notes |
|----|---------|----------|--------|-------|
| T-P1-1 | Chat / Fill badge | `@bible` | `@canon` | Shell already uses `@canon` for graph context chip — writing still says bible. Two dialects in one chrome band. |
| T-P1-2 | Lab Chat tip | “not bible” | “not Canon” | “Results land as Lab cards — not Canon.” |
| T-P1-3 | Graph header lede | “Accepted bible facts only…” | “Accepted links only” (title holds full rule) or “Accepted Canon facts only. Pending proposals never render as edges.” | D4 tip shortens to **Accepted links only** — accept that direction. |
| T-P1-4 | Graph empty (network) | “create a **bible** sheet” | “create a **Canon** sheet” | |
| T-P1-5 | Graph aria | “Bible relationship network” / “Bible family tree” | “Canon relationship map” / “Canon family tree” | aria is user-facing via AT. |
| T-P1-6 | Agent sheet pack message (if shown in transcript) | “into the bible” | “into Canon” | `agent/run.ts` user-visible message path. |
| T-P1-7 | Inspect empty | “Select a node in **Graph**” | “Select a node on the **map**” | Graph is not a place word. |

**Rule:** one pass across all `@bible` / “bible” **UI** strings, or don’t start. Export folder `bible/` can remain.

---

## P1 — Copy that points at the control above it (redundant hint)

| ID | Surface | Now | Problem | Target |
|----|---------|-----|---------|--------|
| T-P1-8 | Lab true-empty hint | “Use the **composer above** for a place, beat, or what-if…” | Points at the thing directly above; wastes fold; fails desk voice. | Drop “above.” **Add a card, or ask the companion to brainstorm.** Keep promote verbs only if room: optional second line, not required on empty. |
| T-P1-9 | Binder Draft empty | “No chapters yet. **Start with New chapter.**” | CTA **New chapter** is the next control. Hint narrates the button. | **No chapters yet.** (row) · button stays **New chapter**. |
| T-P1-10 | Binder Lab empty | “No boards yet. Open Lab to start a bench.” | Button **Open Lab** sits under it. | **No boards yet.** |
| T-P1-11 | Binder Canon empty (sheets=0) | “World truth lives here. Add a sheet, or promote from Lab.” | Long for 272px rail; “Add a sheet” ≈ **New sheet** button. | **No sheets yet.** or **Canon is empty.** Keep promote path once, shorter: **Promote from Lab, or New sheet.** — one short line max. |

---

## P2 — Stale / over-teaching / wrong job framing

| ID | Surface | Now | Issue | Target |
|----|---------|-----|-------|--------|
| T-P2-1 | Check empty hint | “Check is the only Continuity entry. Run Continuity… never auto-canon.” | True but essay-length; “auto-canon” is eng dialect. | **Run Continuity to scan this chapter. Findings go to marks and Inbox — nothing writes Canon until you Accept.** |
| T-P2-2 | Research empty title | “Research without chat clutter” | Marketing slogan, not a state. | **No research yet** |
| T-P2-3 | Research hint | Long; OK on doctrine | Trim. | **Cited results only. Pin or propose to Canon — neither Accepts for you.** |
| T-P2-4 | Chat tip (writing) | “Run Continuity from Check, or ask me to draft a character sheet. Try: /sheet Kael” | Fine doors; `/sheet` may be stale if slash commands aren’t taught elsewhere. | Keep Continuity + sheet doors. Drop `/sheet` **or** document slash in one place. Prefer: **Open Check to run Continuity, or ask for a character sheet.** |
| T-P2-5 | Graph filter chips | raw `character` `lore` `world` `organization` | Enum dump; binder says Characters / Organizations. | Use `SHEET_KIND_LABEL` (Characters, Lore, World, Organizations) or short singular set consistently — **one helper**, design already locked kinds. |
| T-P2-6 | Inbox clear | “Inbox clear” / “Pending proposals and Apply cards land here.” | OK voice. | Keep. Optional: **Nothing pending.** |
| T-P2-7 | Start this project | doors Write / Start in Lab | OK. | Keep. |
| T-P2-8 | Loading | “Opening your binder and latest draft.” | OK. | Keep. |
| T-P2-9 | Lab header | “Pre-canon bench. Continuity and Canon ignore everything here.” | Good doctrine, slightly cold. | Keep or **Pre-canon bench. Continuity and Canon ignore Lab until you promote.** |
| T-P2-10 | Lab notices | Promote / create notices | Good gate teaching. | Keep Accept / Inbox verbs. |
| T-P2-11 | Graph notice | “pending in the **agent panel**” | Companion is the user word. | **…pending in Companion Inbox.** |
| T-P2-12 | Fill placeholder | “Propose facts for this sheet…” | OK. | Keep. |
| T-P2-13 | Binder kind empty | “None yet” | Short; OK at 272. | Keep. |
| T-P2-14 | Sheet editor | Save sheet / Facts / field hints | OK craft voice. | Keep. Dirty-leave dialog copy per ox→koala contract (separate). |

---

## P3 — Length / rail fit (D1 272–280)

| ID | Copy | Fix |
|----|------|-----|
| T-P3-1 | Binder Draft empty long line | See T-P1-9 — shorten. |
| T-P3-2 | Binder Canon blurb long line | See T-P1-11 — one short line. |
| T-P3-3 | Lab empty hint promote essay | Move gate teaching to first promote notice (already exists); empty stays short. |

---

## Verb discipline (cross-cutting)

From Canon dirty-guard + vocabulary:

| Job | Verbs | Not |
|-----|-------|-----|
| Proposal gate (Inbox) | **Accept / Edit / Reject** | Save/Discard |
| Co-write gate | **Apply / Dismiss** | Accept |
| Lab exit | **Promote to Canon** / **Send to Draft** | Accept (until Inbox) |
| Author edits existing Canon sheet | **Save / Discard / Cancel** (leave guard) | Accept/Reject |
| Research | **Pin** / **Propose to sheet** | Accept |

Any new dialog must pick a row. Do not reuse Accept/Reject for author sheet edits.

---

## Durable product rules (for pig / CANON-VOCABULARY)

1. **Canon has exactly one write path and it is explicit** (Accept on a proposal, or Save on an author sheet edit after confirm — never silent, never second hidden path).  
2. **Do not reuse Accept/Reject** outside the proposal gate.  
3. **Empty copy must not claim absence when a filter/search hides rows** (Lab T-P0-1 is the template; apply later to binder search if added).  
4. **Do not narrate the adjacent CTA** (“Start with New chapter” under a New chapter button).  
5. **User-visible bible → Canon** in one sweep; no half-rename.

---

## Recommended fix packs (eng)

| Pack | Items | Owner shape |
|------|-------|-------------|
| **A — Lost work** | T-P0-1 (+ T-P0-2 scope) | Lab only; small; ship first |
| **B — Canon dialect** | T-P1-1…7, T-P2-5, T-P2-11 | One PR, all bible/Graph UI peers |
| **C — Empty trim** | T-P1-8…11, T-P2-1…4, T-P3-* | Copy-only; no nouns invented |
| **D — Dirty leave** | koala guard copy (separate review) | Save/Discard/Cancel contract |

Pack B needs design sign-off only in the sense vocabulary already **Accept**s Canon; this is executing §3, not a new noun.

---

## Inventory (complete enough to audit)

| Region | States / strings judged |
|--------|-------------------------|
| Draft empty | Start this project + Write / Start in Lab |
| Binder | Draft/Canon/Lab empty rows; kind None yet; New chapter/sheet; Open Lab; counts |
| Lab | header, filter, composer placeholders, empty, notices, promote labels, promoted list |
| Canon map | header/lede, empty network/family, notices, propose, filters (enum) |
| Companion | Chat tips, Check empty/rest, Inbox clear, Research empty, Inspect empty, Write/Fill placeholders, @ chips, Continuity tool cards, Spark blurb |
| Sheet | field labels, Save sheet, fact hints, Back |
| Shell | Loading, topbar No chapters / Canon, errors |

---

## One-line bar

**Never tell the author their work is gone when a filter hid it; never say bible when the place is Canon; never narrate the button under the empty row; teach gates once, briefly, at the verb.**

— ox
