# Design ruling — companion is one assistant

**From:** ox  
**To:** rat · dolphin · koala  
**Status:** binding product model  
**Trigger:** Task AL — global `sending` flag, no run id; AL-2 mutual exclusion; AL-4 vocabulary sprawl

## Product answer

**The companion is one assistant doing one thing.**

From the author’s point of view there is a single desk partner, not a rack of independent workers that share a panel. “The companion is working” is a **truthful single state**. Dual status, dual spinners, or “Continuity running while Chat sends” would force a novelist to reason about concurrency. Reject that.

## Consequences for structure

| Choice | Rule |
|---|---|
| **Global busy** | Correct model, not a temporary hack. One in-flight companion job at a time. |
| **Run ids / per-lane parallel** | **Over-engineering** for this product. Do not introduce unless the product model changes (it has not). |
| **Mutual exclusion** | Gate **both ways** across companion mutation lanes (Chat/agent, Continuity, co-write, Spark, Research mutate). Review↔Craft already exclude inside a lane — extend the *same* idea across lanes. |
| **Vocabulary** | One busy word family. Prefer **Working…** (or one chosen verb) everywhere a companion job is in flight. Kill Sending / Running / nothing as competing peers for the same state (AL-4). Lane-specific detail may sit in secondary text (“Checking this chapter…”) under the one busy chrome. |
| **Controls mid-flight** | Anything that would start another companion job disables or no-ops while busy (AL-1 Spark kinds, Send, Continuity, etc.). Pattern: Chat already gates — clone it. |
| **Failure vs last success** | A failed run must not leave a prior success summary as the face truth (AL-3). Face shows **this run’s** outcome; global banner alone is not enough. Stale “no issues found” after a failed Continuity is a **lie** — P1 stands. |

## What “one thing” includes

Companion-originated work that mutates project truth or occupies the assistant:

- Chat / agent turn  
- Continuity run  
- Co-write / skills  
- Spark / brainstorm  
- Research query (live)

**Not** the same busy lock (unless they literally call the same pipeline):

- Local UI (open face, scroll, type into idle composer before send)  
- Inbox Accept/Edit/Reject on an **already arrived** card (author decision, not assistant run) — may proceed unless the accept handler itself needs the agent lane  
- Pure navigation Draft/Lab/Canon  

If Accept triggers a write that can race Continuity, gate that write path; do not freeze the whole shell.

## Open item closed

Dolphin was right not to build run ids in AL. **Record: run ids not wanted under current model.** Global flag + consistent busy chrome + cross-lane gate is the design. Encoding more lanes against the global boolean is **correct**, not technical debt — it is implementing the one-assistant model.

If a future product wants parallel research + chat, that is a **model change** requiring a new ruling, new chrome (“Research working” as a distinct peer), and then run identity. Do not pre-build it (cardinality rule: build what current model justifies).

## AL fix priority (design sign-off)

| ID | Design | Fix |
|---|---|---|
| AL-1 | Controls must not accept start while busy | FIX — disable Spark kinds mid-send |
| AL-3 | Face must not show stale success after failure | FIX — Check face owns this-run error/empty; banner optional amplify |
| AL-2 | One companion job | FIX — mutual exclusion both ways |
| AL-4/5 | One busy lexicon | FIX — unify copy |

Proved-correct items (Chat double-Enter, cowrite disable, Continuity double-click, live Inbox badge): keep as regression anchors.

— ox | one assistant, one job, one busy word
