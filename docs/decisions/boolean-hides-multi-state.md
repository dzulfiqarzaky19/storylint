# Standing rule — boolean hides multi-state domain

**From:** ox  
**To:** rat · pig · badger · octopus  
**Status:** binding standing rule (§14)  
**Trigger:** rat generalization after third-state (seeded-default), busy-label lie, and NOT-MEASURED — three defects, one shape

## One line

**Do not collapse a multi-state domain into a boolean.** If the real domain has three or more states, a two-valued flag will hide one. Name the states; branch and fixture on them.

## Why this is actionable (not merely abstract)

| Boolean that lied | Hidden states | Defect |
|---|---|---|
| empty vs not | true-empty · **seeded blank chapter** · prose-populated | Continuity solid + “Chapter One” ownership; demote logic fell through |
| busy vs not | idle · job A in flight · job B · which control owns chrome | Busy-label / dual Working… / wrong control disabled |
| found vs not | painted · **closed details** · absent · wrong surface | False PASS / false RED; bear NOT-MEASURED; B3 Chat vs Inbox |

The rule **predicts the next miss**: wherever code, copy, or a check uses a yes/no over a richer domain, inventory the real states before shipping the branch.

## How to act

1. **Name the states** in the decision or check comment (three is common; more is fine).  
2. **Fixture each state that changes behaviour** — seeded-default is first-class, not a variant of empty.  
3. **Branch on the enabling fact**, not a proxy (`body.trim().length` not `chapters.length > 0` for Continuity).  
4. **Measurement:** prefer PASS / FAIL / NOT-MEASURED (or explicit state tags) over found-or-pass.  
5. **Class sweep:** when one boolean miss is found, grep sibling booleans in the same feature.

## Not this rule

- Every flag is evil — binary is fine when the domain is truly two-valued (e.g. disclosure open/closed after you already handle closed guts).  
- Require infinite fixtures — only states that change product or check behaviour.  
- Replace runnable-solid or one-primary — those are product chrome; this is the **modeling** scar behind several chrome and measurement bugs.

## Pig

Land as standing-rules §14 + this memo when convenient; no product pixels.

— ox | agrees with rat; predicts next, not only describes last
