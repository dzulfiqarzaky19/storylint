<!-- author: ox · kind: binding-product-model · decided: 2026-08-01 · source: hawk finding via rat -->

# Design ruling — Lab promote consent + card provenance

**From:** ox  
**To:** rat · hawk · octopus · dolphin  
**Status:** binding product model  
**Evidence:** hawk — LLM title reaches stored chapter state via `/api/chat` → `createLabCard` → one-click Promote; `LabCard` has no provenance field  
**Cite:** standing 1 · 20 · 25 · 25a · A1 empty promote title (`4a451cd`) · [chapter-create-title](./chapter-create-title.md) · [lab-lifecycle-ends](./lab-lifecycle-ends.md)

## The finding (not closed by A1)

A1 closed: **the product** must not invent chapter titles (`Untitled` / `Chapter N`). Promote stores empty when the author did not supply a title.

Still open: **the model** invents a title on a Lab card; author clicks Promote once; that string becomes **stored chapter title** and can **export**. No Accept-style preview of the destination payload. No field that says who wrote the card.

Two different authors of the words. A1 fixed factory text. This rules **model text** and **consent shape**.

## Principle

**Consent is destination-shaped, not origin-shaped.**  
Lab is the author's workbench. Putting model text **onto a Lab card** is fine (Spark is a Lab tool). Crossing a boundary into a **system of record** (Canon sheet facts, or a **stored manuscript chapter field**) requires the same honesty Accept already has: the author must be able to see **what will be written where** before it is written.

**Provenance is measurement infrastructure.**  
Standing rule 1 in another costume: if the data cannot state where a value came from, no future check can either. Same shape as T-004's `base` field — without origin, conflict and audit are impossible.

## Split the promote paths (do not treat "Promote" as one moral)

| Path today | What it writes | Canon / manuscript? | Ox |
|---|---|---|---|
| Spark / place / lore → **sheet-proposal** | Pending proposal pack | **No** until Inbox **Accept** | **FINE** as one-click — Accept is the consent gate |
| Beat → **chapter-stub** | `chapters[]` row with `title` from card (or input) and empty body | **Yes — stored chapter state immediately** | **NOT FINE** as silent one-click of model text into stored title |

Sheet promote is already the Accept pattern. Chapter promote is the hole.

## Binding answers

### 1. Is one-click Promote of a model-authored card acceptable consent?

**Depends on destination — not on a blanket yes/no.**

| Destination | Consent rule |
|---|---|
| **Sheet proposal** (pre-canon) | **One-click Promote OK.** Card on bench + later Accept is enough. Promote is "send to pipeline," not "write truth." |
| **Chapter stub** (stored chapter) | **Not OK as blind one-click into stored title.** Author must confirm the **title that will be stored** (and that body stays empty) before the chapter row is created. |

**Chapter confirm contract (binding):**

- Before `chapters[]` mutates, show a small confirm (inline or dialog — implementer choice, calm ghost/secondary primary):  
  - **Title field** prefilled from card title (editable)  
  - Explicit line: body will be empty stub  
  - Quiet source line when known: `From Spark` / `From your note` (requires provenance — §2)  
  - Actions: **Create chapter** · **Cancel** (Cancel does not promote; card stays active)
- Empty title after edit is allowed (A1 / chapter-create-title still holds — store `''`, display Untitled).
- This is **not** a second Accept for Canon facts. It is **title ownership** for manuscript structure.

**Reject:** requiring full manuscript preview chrome for sheet sparks. Wrong altitude.

**Reject:** "Promote is always fine because Lab is the author's bench." Lab ownership does not transfer consent to **stored chapter fields**.

**Reject:** blocking model cards from Promote entirely. Spark → Lab is the product; the gate is at the boundary, not at card birth.

### 2. Should LabCard carry provenance regardless?

**Yes — binding. Always.** Independent of §1.

| Field | Rule |
|---|---|
| **`source`** | `'author' \| 'model'` required on every new card |
| **Author path** | Manual create / edit-origin cards → `author` |
| **Model path** | Chat / Spark / any agent `createLabCard` → `model` |
| **Missing on load** | Migrate legacy cards → `source: 'author'` (unknown history; do not invent `model`) |
| **Edits** | If author edits title or body of a `model` card, set **`source: 'author'`** and keep optional `sourceWas: 'model'` or `modelTouchedAt` only if cheap — v1 may simply flip to `author` (author took the pen). Prefer flip-to-author on substantive edit so Promote treats it as owned text. |

Optional later (not required v1): `sourceDetail: 'spark' | 'chat' | 'manual'`. `author|model` is the moral bit.

### 3. If provenance is added, what may it change?

| Use | v1 |
|---|---|
| **Display** | Quiet badge/chip on card: `Spark` / no badge for author (or muted "Yours") — calm, not a third face |
| **Chapter promote** | Confirm UI **required when `source === 'model'`** (and allowed always — showing confirm for author beats is OK and simpler). Minimum: model path must confirm. |
| **Sheet promote** | **No gate** from provenance — still one-click to pending proposals; Accept remains the write gate |
| **Export / Continuity** | No change — Lab still ignored for continuity digest; export uses stored chapter titles after promote |
| **Hard block** | Do **not** hard-block Promote on `model` — confirm is the fix, not a dead control |

## Why not "FINE like Accept" as a whole?

Accept shows the proposal payload and writes Canon only on explicit Accept.  
Chapter Promote today shows a Lab card and writes a **chapter title** without a destination preview. The consent structures are **not** the same. Equating them is the error.

Sheet Promote **is** like Accept's front half (enter pipeline). Keep it.

## Relation to ownership rulings

| Ruling | What it protects |
|---|---|
| [chapter-create-title](./chapter-create-title.md) / A1 | Product never invents stored titles |
| **This file** | Model text does not become stored chapter title without title confirm; all cards know their source |
| Standing 20 | Canon facts still only Accept / sheet Save |
| Standing 25 | Lab stays transient; Promote is a boundary, not a second forever-store |
| Standing 25a / T-004 | Named intermediate state needs enough provenance to reason about ends |

## Non-goals

- Replacing Spark  
- Model watermark inside exported manuscript prose  
- Provenance on every Canon fact (proposal path already carries model origin via proposals)  
- Multi-step wizard for sheet promote  
- Requiring Accept for chapter stubs (stub is structural; title confirm is enough)

## Implementation sketch

1. `LabCard.source: 'author' | 'model'` in types + createLabCard input + chat/Spark adapters set `model`.  
2. Legacy migrate → `author`.  
3. Author edit of title/body on model card → `source = 'author'`.  
4. Chapter promote UI: confirm title when `source === 'model'` (or always).  
5. Domain **must not** auto-pick model `card.title` — see amendment [lab-promote-domain-title.md](./lab-promote-domain-title.md). UI confirm passes explicit `chapterTitle`.  
6. Fixtures: model beat → Promote → confirm shows title → Create → stored title matches confirm; Cancel → no chapter. Author beat may keep one-click or same confirm. Sheet model spark → Promote → pending only.  
7. Calm: no new solid primary wall; confirm is one quiet step.

## Ticket shape (for rat)

P1 product-model follow-on (not P0 crash-loss). Blocks "we cannot audit title origin" and closes hawk's only Sprint-1-exceeding product finding. Owner: implementer rat assigns (octopus Lab-adjacent is natural).

— ox | consent is destination-shaped; provenance is always; chapter title confirm for model; sheet path keeps Accept

## Amendment

**Enforcement layer:** [lab-promote-domain-title.md](./lab-promote-domain-title.md) — pick **(b)** domain never inherits model card title; UI confirm remains how humans supply `chapterTitle`. UI-only gate is not sufficient.
