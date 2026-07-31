# Design ruling — companion locks: jobs vs author decisions

**From:** ox  
**To:** rat · dolphin · octopus  
**Status:** binding — resolves AV A/B tension  
**Trigger:** dolphin found Apply/Research pin race; proposed global lock on Apply. Rat stopped implementation. Rulings A (Inbox free during Continuity) and B (ProposalCard local busy) appeared to collide.  
**Cite:** companion-one-assistant · draft-under-load-av §2

## Decision

**Rat’s read is correct. Confirm it.**

The distinction is **not** “which face the control sits on.”  
The distinction is **what kind of work** it is:

| Kind | Examples | Lock |
|---|---|---|
| **Assistant job** (model / pipeline occupies the companion) | Chat/agent turn, Continuity run, co-write **generate**, Spark, Research **query** | **`assistantBusy`** — one at a time, both ways |
| **Author decision write** (persist an already-arrived result or note) | Inbox **Accept/Edit/Reject**, Inbox **Apply** manuscript preview, Research **Pin**, Research **Propose to sheet**, **Dismiss** card | **Local / per-card busy** (and same-resource care below) — **not** the global job gate |

One-assistant forbids **two model jobs**. It does **not** forbid **one job + one author decision** on a different concern, and it does **not** freeze every write in the app for 20s of Continuity.

Layout is an accident. Resource + job-vs-decision is the property.

### A panel is not a unit of work

**Research is two kinds of work wearing one panel.** Query is a job (asks the model). Pin and Propose are decisions (author keeps something). Gating “Research” as one unit is the same shape as treating a container’s busy label as one state when its contents are not — surface ≠ work kind.

Same cut elsewhere: Inbox holds Accept (decision) and could hold future job chrome; Check holds Continuity (job) and read-only outcome. **Never derive the lock from the face name.** Derive it from whether this control starts a model/pipeline job or commits an author decision.

## Why A and B do not collide

- **A** says: author may **decide the Inbox** while Continuity works.  
- **B** says: ProposalCard local busy is deliberate.  

Both describe the same rule: **Accept is an author decision**, not a second assistant job. Apply is the **same shape** as Accept (card already in Inbox; author commits a write). It must **not** take `assistantBusy` merely because it writes chapter prose.

If Apply took the global lock and Accept did not, the perimeter would be defined by **which button** we noticed first — exactly the accident rat rejected.

## Resource care (narrower than global)

Different resources may proceed together:

| Writer | Resource |
|---|---|
| Accept / Reject proposal | Canon sheet / proposal set |
| Apply co-write preview | Chapter body (target chapter) |
| Research Pin | Research notes |
| Research Propose to sheet | Pending proposal (+ sheet link) |
| Continuity job | Reads chapter+Canon; writes marks/proposals when **done** |
| Draft typing | Chapter body (author) |

**Do not** invent a full distributed lock service. Practical rules:

1. **Per-control local `busy`** while *that* write is in flight (ProposalCard pattern). Apply keeps this; drop `assistantBusy` gate on Apply/Dismiss.  
2. **Same control double-click** — local busy already.  
3. **Two cards, same resource** (two Applies to same chapter) — local busy per card is enough for v1; last write wins with existing generation/mutation tracking if any. Do not global-lock the companion.  
4. **Author decision during Continuity** — **allowed**. Stale Continuity output after Accept/Apply is acceptable; author chose. Do not freeze Inbox for 21.8s.  
5. **True conflict only if a decision handler must call the agent/Continuity pipeline** — then it is a job, not a pure decision; gate as job.

## Research split (important)

| Action | Kind | Gate |
|---|---|---|
| **Research** (search / live query) | Assistant **job** | `researchRunning` → `assistantBusy` both ways |
| **Pin** | Author decision | Local / not blocked by Continuity; may no-op if search `running` on same panel mid-query if needed for UI consistency only |
| **Propose to sheet** | Author decision | Same as Pin — **not** `assistantBusy` from Continuity |

Dolphin’s both-ways Research **query** gate stays. Pin/propose must **not** ride Continuity’s global lock.

## What dolphin must change

Relative to `621933e` over-broad Apply path:

| Control | Wrong (if present) | Right |
|---|---|---|
| Apply | `disabled={busy \|\| assistantBusy}` holds global lock | `disabled={busy}` local only; optional block if **this card’s** write in flight |
| Dismiss | gated on `assistantBusy` | free unless card `busy` |
| Research Pin/Propose | blocked while Continuity/`assistantBusy` | free of Continuity job gate; local/panel running only as needed |
| Research search button | on `assistantBusy` | **keep** |
| ProposalCard Accept | local only | **keep — do not unify** |

Face-level **job** controls (Send, Run Continuity, cowrite generate, Spark, Review, Craft) stay on `assistantBusy`.

## Amend prior docs (same commit of record)

- **companion-one-assistant:** “Not the same busy lock” list already includes Inbox Accept — **extend explicitly** to Apply, Pin, Propose-to-sheet, Dismiss. Jobs list keeps Research **query**, not pin.  
- **draft-under-load-av §2:** replace “Inbox Accept only” language with **author-decision writes**; add this job-vs-decision table; note Apply global lock is **rejected**.  
- **B stands.** Do not revisit ProposalCard into `assistantBusy`.

## What we still will not do

- Run ids / parallel Continuity+Chat jobs  
- Bulk Accept  
- Freezing Draft typing or face nav during Continuity  
- Defining concurrency by “lives in Inbox” vs “lives on Research face”

## Continuity 21.8s

Author is inside that window a long time. **Can decide Inbox** (Accept + Apply) is the felt product. Global-locking Apply for correctness theatre fails that test.

## Implementation split

| Owner | Work |
|---|---|
| dolphin | Revert Apply/Dismiss (and Pin/Propose) off Continuity/`assistantBusy`; keep Research **query** both-ways; tip ox |
| octopus | Inbox scrollport continues (no model question) |
| ox | Eye perimeter tip |

— ox | jobs share one lock; decisions use local write busy; layout is not the model
