# Design ruling — Lab lifecycle ends (TASK BA)

**From:** ox  
**To:** rat · koala · pig · dolphin  
**Status:** binding product model  
**Evidence:** koala Lab-under-load BA — owned-stack @ `5282a3b`, 48 mixed cards (35 active / 3 pinned / 10 promoted), 1440 + 390 operable  
**Cite:** Lab as transient bench · Canon Accept path · runnable-solid (cousin: don’t promise clean if nothing leaves)

## Verdict on density

**Lab is operable at 40+ cards.** Chrome holds. No density-pass redesign of the bench grid.

## The real hole (agree with koala rank)

Lifecycle **ends are missing**. Archive is a one-way disappearance (domain/API/UI on live only; no render, no unarchive). Promoted is append-only title+badge tombstones. No dismiss/clear. Disk keeps archived + promoted forever. Author can “clean” the live bench and still grow a permanent Promoted appendix.

That is not a scrollport bug. It is a **product model** gap.

## What is Lab?

**Lab is the transient ecosystem** — messy think, sparks, half-ideas. If nothing ever leaves, Lab becomes an **archive pretending to be a workbench**, and the surface promise degrades with use.

Canon is where permanence lives (explicit Accept / sheet Save). Lab must not compete as a second forever-store.

## Promoted: which product?

| Model | Meaning | Ox |
|---|---|---|
| **Audit log** (forever, no retention) | Receipt wall that never shrinks | **Reject** as default — kills transient Lab |
| **Temporary outbox** | Holding pen until Canon/Draft settles, then auto-drop | **Reject** as sole model — races Accept; silent loss of receipt |
| **Dismissible history** | Quiet receipt list; author can clear row or clear all; does **not** undo Canon/Draft | **Accept — binding** |

### Binding answer

**Promoted = dismissible history (receipts), not an audit log, not an outbox that auto-deletes.**

| Property | Rule |
|---|---|
| **What a row means** | “This Lab card was sent” — title + destination badge (`Canon proposal` / `sent to Draft`). **Not** a second Canon browser. |
| **Does dismiss undo Canon?** | **No.** Dismissing a Promoted row removes the **Lab receipt only**. Pending proposals and accepted facts stay on their real paths (Inbox / Canon / Draft). |
| **Does dismiss delete the Lab card body forever?** | Soft-remove from Promoted list (status → archived or `dismissed` — implementer choice). Prefer keep in domain for undo window if cheap; not required v1. |
| **Clear all Promoted** | Allowed — quiet control, confirm if count ≥ N (e.g. 10). Same: Lab receipts only. |
| **Retention default** | No forced TTL in v1. Author-driven dismiss is enough to keep the bench honest. Optional later: “older than 30 days” quiet archive. |
| **Why not forever audit** | Receipts without end turn Lab into filing. Real audit of Canon is **Canon + Inbox history of accepts**, not Lab tombstones. |

**Tension with acceptance model (rat):** a promoted card is a receipt that something entered the pipeline. **Destroying Canon is wrong; dismissing a Lab receipt is not destroying Canon.** The Accept path remains the system of record. Lab Promoted is a **convenience trail**, not the ledger.

## Archive: make it a state, not a trapdoor

| Today | Required |
|---|---|
| Archive on live → gone from UI | **Archived** is a real filter/section (or drawer): list archived cards |
| No unarchive | **Restore** → active (or pinned if was pinned — simple → active is fine) |
| No hard delete | **v1: no hard delete** of Lab cards (matches “no silent destruction of think”). Restore + dismiss Promoted is enough. Hard delete = later + confirm, not BA density. |

Pinned stays pin/unpin on live. Archive of pinned = unpin+archive or archive with pin flag dropped — either OK if restore returns **active**.

## Promoted list layout (koala correction)

**Not** the Inbox nested-scrollport defect.

- `.lab__promoted-list`: `scrollH === clientH`, overflow visible, sizes to content  
- Single scroller = `.lab` (document-length tax)

**Do not** “fix” with fixed-height `overflow: auto` **absent a retention/dismiss story**. That hides an unbounded list and lies that the problem was layout.

**After** dismiss/clear exists: long Promoted may use quiet collapse (“N promoted — show”) or natural page scroll. Nested trap scrollport still not required.

## Class-over-instance qualifier (for pig)

Agree with rat: grepping a mechanism tells you **where to look**, not **what to conclude**. Inbox wall and Promoted length tax **present alike** and are **different defects**. Standing class rule needs:

> **Inventory sites; verify each site’s actual failure mode before applying the same fix.**

## Non-goals (this ruling)

- Lab virtualization / density chrome redesign at 40 cards  
- Hard delete purge UI  
- Auto-expiring outbox  
- Moving Promoted into Companion Inbox  
- Changing promote → Canon Accept semantics  

## Implementation sketch (when scheduled — not density-pass panic)

1. **Promoted row:** ghost **Dismiss** (and optional section **Clear promoted**).  
2. **Archived section/filter** + **Restore** on archived cards.  
3. Live **Archive** stays.  
4. Domain: status transitions only; no Canon proposal cascade on dismiss.  
5. Fixture: 10+ promoted → dismiss one → row gone, proposal untouched if any.  
6. Calm: no new solid primary for Clear; quiet ghost/secondary.

## BA density disposition

**ACCEPT operable Lab under load** for chrome/scroll/pin.  
**REJECT lifecycle completeness** until archive restore + promoted dismiss land (product follow-on, not B3-class layout hotfix).

— ox | Lab stays transient; Promoted = dismissible receipts; archive is a state; don’t scrollbar-wash unbounded history
