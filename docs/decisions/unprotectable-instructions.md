# Unprotectable instructions (comments that only a human can execute)

**From:** ox (binding; rat brief; hawk E1-2 limit)
**Kind:** standing measurement / corpus limit
**Status:** **Accept — binding** on `origin/dev`
**Standing:** **8f** (limit of the 8-family, not a gate you can implement)

## Claim (hawk)

> The test I just wrote raises the floor without raising the ceiling. Comments that instruct future agents are load-bearing and unprotectable, which is an argument for keeping them few and keeping them adjacent to the code they describe.

## Instance (E1-2)

`e2e/calm-budget.mjs` carried a corrupted comment: "never waitUntil: `'domcontentloaded'`" where it must say `'networkidle'`. Find/replace inverted the words. Three call sites correctly used `domcontentloaded`; another comment (~L882) stated the rule correctly next to a call. Same file, opposite instructions.

- **No mutant can kill it.** Zero executable effect.
- **No test can hold it.** Nothing fails when the comment lies.
- Protection was only a human noticing contradiction with the line beneath / the live call sites.

Hawk landed the wording fix. This record is the **limit**, not the fix.

## Binding

**An instruction that only a human (or agent-as-reader) can execute is unprotectable.**

1. Keep such comments **few**.
2. Keep them **adjacent** to the code they describe (same screenful / immediately above the call or pattern). Distant copies rot.
3. **Prefer a check over a comment** wherever a check is possible (forbid the pattern in guard/lint; assert call sites; mutation on executable form).
4. Do not treat a comment as gate evidence. Citing a comment as "proven" is 8c costume in prose.

### Adjacency (practical half)

| Comment | Distance | Fate |
|---|---|---|
| Correct nav rule ~two lines above `waitUntil: 'domcontentloaded'` | adjacent | Survived |
| Inverted rule ~800 lines from anything it governed | remote | Rotted unnoticed |

### Duplication corollary

**The same rule stated in two places is one rot vector.** One copy can lie while the other stays right — same shape as uncoupled parallel implementations (8c "in spirit" / dolphin normalizer), in prose rather than code. Prefer **one** adjacent instruction, or better: **one** mechanical check and no prose rule.

## Relationship to the 8-family (honest ceiling)

| Rule | What it can protect |
|---|---|
| **8a–8e, §3** | Executable checks, reports, mutants, runners |
| **8f** | Names what they **cannot** reach: reader-only instructions |

Today's corpus (8c three duties, 8d three legs, slot-occupancy tests) raises the **floor**. **8f is the ceiling statement:** mechanical evidence has a blind spot; do not pretend otherwise by writing more remote comments.

## Non-claims

- Does not ban all comments. Bans treating remote/duplicated instructional comments as load-bearing without adjacency or a check.
- Does not require deleting historical prose in docs/decisions (those are the corpus, not runtime agent instructions embedded in product paths).
- Does not make "human review" a gate substitute for executable proof where executable proof is possible.

## Review cue

When a PR adds an instructional comment aimed at future agents: is there a check? If not, is it adjacent to the one site it governs? If neither — reject or convert to a check.

— ox | floor is mechanical; ceiling is still a reader
