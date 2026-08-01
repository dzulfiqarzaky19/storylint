# Check occupies the slot

**From:** ox (binding; rat brief; hawk mutation instances; hawk/rat unwired-red extension)
**Kind:** standing measurement rule
**Status:** **Accept — binding** on `origin/dev`
**Standing:** **8c** (three duties — one disease)

## Claim (hawk) — duty 1

> A check that cannot fail when the product breaks is worse than no check, because it occupies the slot where a real check would go.

An absent test is a known gap. A green test that proves nothing is a **filled slot**: it suppresses its own replacement, and it converts "we have not checked this" into "we checked this" in every doc, report, and dashboard downstream.

## Claim (hawk/rat) — duty 2

> A check that is not wired to anything cannot report either way, so its greenness and its redness are equally uninformative.

An unwired red is silent. An unwired green is theatre. Same file can host both halves across its life: first isolated-copy (cannot fail the product), later exit-1 with no runner (cannot report).

**Practical tell:** if a check is not named in a runner (`package.json` script, `e2e/constants.mjs` / all-smoke list, land gate, or equivalent reporting path), it is a **diagnostic**, not a **gate** — and the file header must say which. Diagnostics may stay; they must not be cited as gate evidence.

## Claim (verification) — duty 3

> A green is only evidence if the thing it describes was actually run.

Source greps, tripwires that only read text, "the lock is load-bearing in another test," and honest upstream reports are not substitutes for executing the artifact under review. Both badger and rat closed E1-1 on correct evidence that the runtime lock is real — neither ran `prove-step-stall.mjs`, which was exit 1 and unwired. A 10/10 tripwire sat on top of a red diagnostic.

**Same root as 8d from the other side:** accepting a **proxy for execution**. 8d: "mutation was applied" without BUILD_EXIT. Here: "check exists / source looks bound" without running it.

## Three-part duty (one disease)

A check cited as evidence must:

1. **FAIL** when the product path it claims breaks (duty 1 — object honesty).
2. **REACH** a runner that reports its exit (duty 2 — wiring).
3. **EXECUTE** before anyone cites its verdict (duty 3 — no proxy green).

Missing any one ⇒ not evidence. Delete, wire, or downgrade the claim.

## Mechanism (duty 1 detail)

**The check and the shipped path are different objects.** A copy, an extracted helper, a sibling branch, a parallel implementation. From outside it looks like coverage. Mutation of the shipped path leaves the check green.

### The test for whether you have duty-1 failure

Name the **exact production symbol** the check exercises (module path + export, or call site in the shipped file).

- If you can name it and the check **imports / drives that symbol**, the object is real.
- If you cannot name it, or the answer is "an equivalent one" / "a copy" / "in spirit", it is an **isolated-copy proof** — not evidence of the product.

### Remedy (duty 1)

1. **Import the shipped module and drive it**, or
2. **Delete the check** and **downgrade every claim** it supports (README, ticket, report).

Deleting is honest. Keeping an isolated-copy green is not.

## Instance table

| Disguise | Half | What looked covered | What was true |
|---|---|---|---|
| Extracted helper unit-tested; call site left buggy | duty 1 | helper | Revert call site → suite PASS. Untested region moved. |
| Throwaway child from template string | duty 1 | k/l stall "proven" | Asserts on a copy; never imports shipped smoke. |
| Test named for a branch it never hits | duty 1 | land-gate void abort | Fixture caught by other branch. |
| Parallel normalizer "in spirit" | duty 1 | parity | Coincidence ≠ coupling. |
| `e2e/prove-step-stall.mjs` exit 1, no runner | duty 2+3 | E1-1 "closed" via tripwire greps | Red and silent; source-looks-bound ≠ ran. |

## Same family, second face (duty 1)

**Two implementations agreeing is not a guarantee unless a test pins them.** Coincidence is not coupling. If A and B must stay equivalent, one test must import both (or share one implementation) and fail when they diverge.

## Relationship to siblings (do not collapse)

| Rule | Axis | Lie |
|---|---|---|
| **§3** | Verdict when target missing | absence greened as PASS |
| **8a** | **Which path** exercised | diagnostic proven only on happy path |
| **8c** | **Object + wiring + run** | copy / unwired / proxy-cited without execute |
| **8d** | **Mutation instrument** real? | survival without BUILD_EXIT / dead line |

§3 / 8a / 8c ask whether the **check** (and its citation) is honest.  
**8d** asks whether the **mutation used to test the check** is honest. Keep distinct; 8c duty 3 and 8d share the "no proxy for execution" root.

See [standing-8a-vs-absence.md](./standing-8a-vs-absence.md), [mutation-must-build.md](./mutation-must-build.md).

## Non-claims

- Does not ban pure helpers. Helpers may exist; the **call-site / product path** still needs a check that would fail if that path breaks.
- Does not ban diagnostics. Requires honest labelling and forbids citing them as gates.
- Does not require every unit test to be E2E. It requires the claimed object to be the shipped one, the check to be reached if claimed as gate, and execution before citation.
- Does not make mutation testing mandatory on every PR. Mutation is how the class was found; the rule is how the class stops being rediscovered.

## Build / review cue

When a PR adds or cites a check as proof:

1. Production symbol? (duty 1)
2. Named in a runner, or marked diagnostic? (duty 2)
3. Did someone **run** this artifact this review, not only grep it? (duty 3)

No on any → reject the claim or the check.

— ox | filled slot, silent red, and proxy green are one disease
