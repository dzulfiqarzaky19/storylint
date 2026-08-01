<!-- author: ox · kind: binding-product-model · decided: 2026-08-01 · follow-on: lab-promote-consent-provenance -->

# Design ruling — chapter promote: domain does not inherit model titles

**From:** ox  
**To:** rat · dolphin · koala · hawk  
**Status:** binding product model (amendment to [lab-promote-consent-provenance](./lab-promote-consent-provenance.md))  
**Trigger:** koala — confirm was kind-only (fixed); dolphin disclosed gate is UI-local (`chapterPromoteConfirm` → LabBench only). Domain `promoteLabCard` and `/api/lab/cards/:id/promote` still accept any beat and may store `card.title` with no source check.  
**Cite:** standing 20 · 25b · A1 · [chapter-create-title](./chapter-create-title.md) · T-004 durable dirty · standing 11a

## The hole

The consent rule landed as a **screen** rule. Today nothing else calls promote, so there is no live multi-caller defect. "No other caller yet" is the assumption that fails quietly — same class as a leave-guard that only hooks one Back button.

Standing **20** is not "Canon Save exists in the sheet UI." It is **exactly one write path** at the mutation boundary. The analogue here: model text becoming a **stored chapter title** must not depend on which surface remembered to confirm.

## Principle (covers T-004 too)

**A system-of-record field may only receive intermediate or model-sourced text through an explicit write argument — never by silently inheriting ambient state.**

| Surface | Intermediate / foreign text | Silent path rejected | Explicit path |
|---|---|---|---|
| **Canon sheet** | durable dirty / form dirty | Draft auto-becomes truth | **Save** with form values |
| **Chapter title from Lab** | model card title | Domain copies `card.title` on promote | Caller passes **`chapterTitle`** (UI confirm supplies it) |

Same principle. T-004 enforces it by giving durable dirty **no write path**. Chapter promote enforces it by giving domain **no auto-pick of model card title**.

UI confirm remains the author-facing honesty. Domain structure makes bypass impossible without lying in the API args.

## Pick: (b) not (a)

| Option | Shape | Ox |
|---|---|---|
| **(a) Domain rejects** model-beat promote without `confirmedTitle` / consent flag | Consent flag is a precondition | **Reject as primary** — new boolean ceremony; every caller invents a flag; easy to forge `confirmed: true` |
| **(b) Domain never auto-picks** model card title — stores empty unless title passed explicitly | Nothing to steal; confirm becomes "fill the title" not "unlock the gate" | **Accept — binding** |

### Why (b)

1. **Composes with A1.** Product already must not invent titles. Model card title is not author-typed into the chapter field until the caller says so. Empty is the honest default — same as A1 blank promote.
2. **Matches T-004.** No hidden write path from intermediate state into the record. Structure, not a checkbox.
3. **Harder to forge than a flag.** A bare promote with no `chapterTitle` cannot smuggle model text into `chapters[].title`. A `consent: true` bit can.
4. **UI confirm stays valuable.** Prefill editable title from card, author edits or accepts, passes `chapterTitle` into promote. Confirm is how humans supply the explicit argument — not a parallel policy engine.
5. **Standing 11a.** Auto-inheriting `card.title` on a path that "promotes" is a quiet discard of the distinction the ticket protects (who wrote the stored title). Empty default refuses that disease.

### What (a) still teaches

Callers should be intentional. Under (b) they already must pass a title to get a non-empty stored title. Do **not** add a separate `confirmed` flag in v1.

## Binding domain contract

`promoteLabCard` / server promote for **chapter-stub** (`kind === 'beat'`):

| Card `source` | `input.chapterTitle` | Stored `chapter.title` |
|---|---|---|
| **`author`** | omitted | `card.title` (owned text — one-click OK) |
| **`author`** | provided (incl. `''`) | `input.chapterTitle.trim()` |
| **`model`** | omitted | **`''`** — never `card.title` |
| **`model`** | provided (incl. `''`) | `input.chapterTitle.trim()` |

Notes:

- Trim only; do not re-invent Untitled / Chapter N (A1 / chapter-create-title).
- Sheet-proposal promote **unchanged** — still one-click to pending; Accept gates Canon. No title-inheritance issue on that path.
- Server route uses the same domain function — no second policy.
- Missing/legacy `source` treats as **`author`** on load (already ruled); do not treat unknown as model.

## UI contract (unchanged moral, clearer job)

- `needsChapterPromoteConfirm` = `kind === 'beat' && source === 'model'` (dolphin/koala fix — keep).
- Confirm prefills card title; on Create chapter, call promote with **`chapterTitle`** set to the field value (may be empty).
- Author beats: one-click; domain may use `card.title`.
- Cancel: no promote.

## Non-goals

- Blocking model promote entirely  
- Consent flags / signed tokens  
- Moving sheet-proposal behind a title confirm  
- Changing T-004 storage mechanics (principle cite only)

## Implementation sketch

1. Domain: chapter branch uses the table above; unit tests for model+omit → `''`, model+explicit → that string, author+omit → card.title.  
2. LabBench confirm submit always passes `chapterTitle`.  
3. API docs / types: `chapterTitle` optional; semantics source-dependent.  
4. No new standing letter ladder — cite this file from 25b.

## Ticket

Follow-on to provenance build. Not a land-blocker for dolphin's source-gate UI fix. Domain table is the acceptance for the architectural close.

— ox | no silent inherit into the record; model titles only via explicit chapterTitle; same principle as Save-only Canon
