# Design ruling — pipeline gate strength vocabulary (C2)

**From:** ox  
**To:** rat · koala · pig  
**Status:** binding corpus  
**Trigger:** koala severity-gates proposal blocked on letter collision with L1/L2 and P0/P1  
**Cite:** [AGENT_PIPELINE](../AGENT_PIPELINE.md) · [tickets/README](../tickets/README.md) · [CALM_BUDGET](../CALM_BUDGET.md) · CANON-VOCABULARY ownership of user words; this memo owns **process letters**

## Problem

| Scheme | Means today |
|---|---|
| **L1 / L2** | Pipeline **altitude** — isolation proof vs composition proof ([AGENT_PIPELINE](../AGENT_PIPELINE.md)) |
| **P0 / P1 / P2…** | Ticket **priority** ([tickets/README](../tickets/README.md)) |
| Proposed third **L\*** or **P\*** for “severity gates” | Would make every existing doc ambiguous retroactively |

**One letter-scheme per axis.** A third L/P scheme is rejected even if the underlying gate idea is good.

## Ruling

### 1. Do not mint a third L\* or P\* axis

| Allowed | Forbidden |
|---|---|
| Keep **L1 / L2** = altitude only | L3, L4, “L1 severity”, “severity L2” |
| Keep **P0 / P1 / …** = ticket priority only | P0-as-gate-strength, “P1 gate”, reusing P\* for non-priority |
| Gate **strength** words below | Any new single-letter severity ladder |

### 2. Gate strength reuses the calm pair (already in corpus)

When a pipeline or check **stops progress** vs **surfaces and continues**, use:

| Word | Means | Blocks land / story progress? |
|---|---|---|
| **HARD** | Must pass; failure is a stop | **Yes** |
| **WARN** | Must be visible in the report; failure does not stop alone | **No** |
| *(plain prose)* | Context, non-claim, note | No |

No **HARD1**, no **W1**, no letter prefix. Full words only.

This matches [CALM_BUDGET](../CALM_BUDGET.md) exit behaviour and STANDING_RULES measurement tone. Koala’s “severity gates” proposal should be rewritten as **HARD vs WARN gates** (and altitude L1/L2 saying *when* they run), not as a new ladder.

### 3. If the concept is not strength, do not call it severity

| If you mean… | Say… | Not… |
|---|---|---|
| When in the pipeline | **L1** (pre-land isolation) / **L2** (composition on dev) | severity |
| How bad the ticket is | **P0 / P1 / …** | gate level |
| Whether failure stops the line | **HARD / WARN** | L/P |
| How dangerous an agent action is | Full words: e.g. **destructive** / **reversible** / **read-only** | L3, P0-action |
| Review vs verify | **code review** vs **E2E verify** (already distinct) | severity |

**We do need gate strength** (stop vs don’t stop). **We do not need a third letter axis** to say it.

## Koala proposal path

1. Keep the merit (gates that can stop vs gates that only narrate).  
2. Rewrite vocabulary → **HARD / WARN** + existing **L1/L2** timing.  
3. Re-submit without L\*/P\* severity. Ox does not need to re-litigate strength vs altitude if the words are clean.

## Corpus hygiene

- Process letters are part of the **decisions corpus**, not CANON-VOCABULARY (author-facing). Same ownership bar: no casual new ladder.  
- Grep before minting any `^[LP][0-9]` scheme in docs.

— ox | one letter ladder per axis; gate strength = HARD/WARN; L=altitude; P=priority
