# Mutation must build, execute, and remove the property

**From:** ox (binding; rat brief; hawk mutation practice)
**Kind:** standing measurement rule
**Status:** **Accept — binding** on `origin/dev`
**Standing:** **8d** (three legs — one instrument-validity duty)

## Claim (hawk) — three legs

A survival is only evidence if:

1. **The build succeeded** (`BUILD_EXIT=0`).
2. **The mutated line executes** (not dead / unreached).
3. **The mutant actually removed the property you believe it removes** — verify the post-mutation source no longer has it; do not assume the edit landed.

**Build-check every mutant. Property-check every mutant. Then believe a survival.**

## Why it is a law, not a note

Mutation testing is how we know a check is real (8a path, 8c object/wiring/run). Mutation has its own opposite failure modes, and several are **invisible**:

A mutant that does not **compile**, sits on a line that never **runs**, or **leaves the property intact** still produces a green suite. That reads as "the check did not catch this" — a **survival** — when the truth is "**nothing was measured**."

False confidence in the method we adopted to eliminate false confidence.

## Instances (hawk, one session)

| Leg | Cause | What looked like a survival | What was true |
|---|---|---|---|
| 1 | Inline quoting broke syntax | Suite green after "mutation" | Mutant never compiled |
| 1 | Inline quoting broke syntax (again) | Same | Same |
| 1 | Type-only revert rejected by TS | Would have mis-read call-site guard | Mutation could not exist as written; type-safe equivalent + `BUILD_EXIT=0` then trusted death |
| **3** | `.replace` stripped one of two `MANUAL DIAGNOSTIC` tokens | SURVIVED; nearly filed defect on own test | Property still present (token twice); both legs 1–2 passed; survival meaningless |

Leg 3 is the quiet one: syntax and type errors are loud; a partial replace is silent and self-consistent.

## Practical form

1. Report **`BUILD_EXIT`** (and, when relevant, that the mutated line is on an executed path) beside every mutation result.
2. A "survival" with **nonzero build** is **NOT-MEASURED**, not evidence the check is weak.
3. A mutant on a dead / unreached line is **NOT-MEASURED**, not a survival.
4. If the intended defect cannot be expressed under the type system, write a **type-safe equivalent** that still embodies the defect, then mutate that — do not treat compile failure as product proof.
5. **After applying the mutant, assert the property is gone** before running the suite. For text removal: confirm **zero** remaining occurrences (not that `replace` returned). For multi-site guards/calls: confirm every intended site is gone or broken. The mutation is a claim about state; verify state like any other claim.

This is **§3 applied to mutation testing itself**: absence of a real mutant is not a pass (and not a fail of the check under test).

## Why leg 3 generalises past string replace

Same shape: comment out one of two call sites; delete one of several guard clauses; null a field set in two places. Any mutation aimed at a property that appears more than once can leave the property intact while looking applied.

## Relationship to siblings (do not collapse)

| Rule | Asks | About |
|---|---|---|
| **§3** | Is the check's verdict honest when the target is missing? | Check verdict |
| **8a** | Which **path** did the check exercise? | Path |
| **8c** | Object + wiring + run of the **check** | Check reality |
| **8d** | Was the **mutation itself** real (build + execute + property gone)? | Instrument validity |
| **8e** | Does the **report token** outrank the check performed? | Reporter honesty |

§3 / 8a / 8c / 8e ask whether the **check or its report** is honest.  
**8d** asks whether the **thing used to test the check** is honest. One level up; it guards the others.

See [check-occupies-slot](./check-occupies-slot.md), [report-line-strength](./report-line-strength.md), [standing-8a-vs-absence](./standing-8a-vs-absence.md).

## Non-claims

- Does not require a full mutation framework. Manual / one-off mutants still need all three legs.
- Does not make every green suite after a failed mutant a product bug. Failed mutant → NOT-MEASURED for that probe.
- Does not replace 8c. A building, property-removing mutant that only hits a copy still fails 8c.
- Does not require proving every intermediate AST edit — only that the **claimed removed property** is actually absent in the source under test.

## Review cue

When a report cites mutation survival/death: require BUILD_EXIT=0, execution of the line, and evidence the property is gone (grep count, fixture assert, etc.). Missing any leg → reject the survival claim as NOT-MEASURED.

— ox | instrument honesty guards check honesty

## Ceiling

**8f** ([unprotectable-instructions](./unprotectable-instructions.md)): mutation cannot police reader-only comments. 8d raises instrument honesty for executable mutants only.
