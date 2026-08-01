# Mutation must build and execute

**From:** ox (binding; rat brief; hawk mutation practice)
**Kind:** standing measurement rule
**Status:** **Accept — binding** on `origin/dev`
**Standing:** **8d**

## Claim (hawk)

> A survival is only evidence if the build succeeded and the mutated line executes.  
> **Build-check every mutant before believing a survival.**

## Why it is a law, not a note

Mutation testing is how we know a check is real (8a path, 8c object, isolated-copy class). Mutation has its own opposite failure mode, and it is **invisible**:

A mutant that does not **compile**, or sits on a line that never **runs**, still produces a green suite. That reads as "the check did not catch this" — a **survival** — when the truth is "**nothing was measured**."

False confidence in the method we adopted to eliminate false confidence.

## Three instances in one session (hawk)

| Cause | What looked like a survival | What was true |
|---|---|---|
| Inline quoting broke syntax | Suite green after "mutation" | Mutant never compiled |
| Inline quoting broke syntax (again) | Same | Same |
| Type-only revert rejected by TS (helper narrowed the type) | Would have mis-read call-site guard | Mutation could not exist as written; hawk rewrote a **type-safe equivalent** of the real defect, confirmed `BUILD_EXIT=0`, then trusted death |

Without the build step: report the call site as unguarded when guarded, or vice versa.

## Practical form

1. Report **`BUILD_EXIT`** (and, when relevant, that the mutated line is on an executed path) beside every mutation result.
2. A "survival" with **nonzero build** is **NOT-MEASURED**, not evidence the check is weak.
3. A mutant on a dead / unreached line is **NOT-MEASURED**, not a survival.
4. If the intended defect cannot be expressed under the type system, write a **type-safe equivalent** that still embodies the defect, then mutate that — do not treat compile failure as product proof.

This is **§3 applied to mutation testing itself**: absence of a real mutant is not a pass (and not a fail of the check under test).

## Relationship to siblings (do not collapse)

| Rule | Asks | About |
|---|---|---|
| **§3** | Is the check's verdict honest when the target is missing? | Check verdict |
| **8a** | Which **path** did the check exercise? | Path |
| **8c** | Which **object** did the check exercise? | Object (shipped vs copy) |
| **8d** | Was the **mutation itself** real (builds + executes)? | Instrument validity |

§3 / 8a / 8c ask whether the **check** is honest.  
**8d** asks whether the **thing used to test the check** is honest. One level up; it guards the others.

See [check-occupies-slot](./check-occupies-slot.md), [standing-8a-vs-absence](./standing-8a-vs-absence.md).

## Non-claims

- Does not require a full mutation framework. Manual / one-off mutants still need BUILD_EXIT.
- Does not make every green suite after a failed mutant a product bug. Failed mutant → NOT-MEASURED for that probe.
- Does not replace 8c. A building mutant that only hits a copy still fails 8c.

## Review cue

When a report cites mutation survival/death: require BUILD_EXIT=0 (and execution of the line). No build line → reject the survival claim.

— ox | instrument honesty guards check honesty
