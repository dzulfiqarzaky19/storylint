# Check occupies the slot

**From:** ox (binding; rat brief; hawk mutation instances)
**Kind:** standing measurement rule
**Status:** **Accept — binding** on `origin/dev`
**Standing:** **8c**

## Claim (hawk)

> A check that cannot fail when the product breaks is worse than no check, because it occupies the slot where a real check would go.

An absent test is a known gap. A green test that proves nothing is a **filled slot**: it suppresses its own replacement, and it converts "we have not checked this" into "we checked this" in every doc, report, and dashboard downstream.

## Mechanism

**The check and the shipped path are different objects.** A copy, an extracted helper, a sibling branch, a parallel implementation. From outside it looks like coverage. Mutation of the shipped path leaves the check green.

## The test for whether you have one

Name the **exact production symbol** the check exercises (module path + export, or call site in the shipped file).

- If you can name it and the check **imports / drives that symbol**, the object is real.
- If you cannot name it, or the answer is "an equivalent one" / "a copy" / "in spirit", it is an **isolated-copy proof** — not evidence of the product.

## Remedy

1. **Import the shipped module and drive it**, or
2. **Delete the check** and **downgrade every claim** it supports (README, ticket, report).

Deleting is honest. Keeping an isolated-copy green is not.

## Four instances in one session (all found by mutation)

| Disguise | What looked covered | What mutation proved |
|---|---|---|
| Extracted helper unit-tested; call site left buggy | `needsChapterPromoteConfirm` helper | Revert call site only → suite still PASS. Isolation moved the untested region. |
| Throwaway child script from a template string | k/l stall labelling "proven" | Asserts on a copy nobody ships; never imports `slice-k-smoke.mjs`. |
| Test named for a branch it never hits | land-gate "identical void … HARD ABORT" | Fixture caught by a different branch; disable infra detection → still green. |
| Parallel normalizer "in spirit" | text normalize parity | Evolve shared normalizer → suite green; coincidence ≠ coupling. |

## Same family, second face

**Two implementations agreeing is not a guarantee unless a test pins them.** Coincidence is not coupling. If A and B must stay equivalent, one test must import both (or share one implementation) and fail when they diverge.

## Relationship to siblings (do not collapse)

| Rule | Axis | Lie |
|---|---|---|
| **§3** | Verdict when target missing | absence greened as PASS |
| **8a** | **Which path** exercised | diagnostic proven only on happy path |
| **8c** | **Which object** exercised | check proven only against a copy / sibling / parallel impl |

Same disease family (unverified claim greened). Distinct proof duties. Keep all three. See also [standing-8a-vs-absence.md](./standing-8a-vs-absence.md).

## Non-claims

- Does not ban pure helpers. Helpers may exist; the **call-site / product path** still needs a check that would fail if that path breaks.
- Does not require every unit test to be E2E. It requires the claimed object to be the shipped one.
- Does not make mutation testing mandatory on every PR. Mutation is how the class was found; the rule is how the class stops being rediscovered.

## Build / review cue

When a PR adds or cites a check as proof: ask for the production symbol. No symbol → reject the claim or the check.

— ox | filled slot is active harm
