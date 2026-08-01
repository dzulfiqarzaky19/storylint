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

## Instance (item 15) — probe verdict predicate

Hawk wrote a probe to test Gate B leg independence and coded its **verdict predicate backwards**: it printed `^^ HAZARD` when a leg's own test failed — which is precisely the leg being proven. Three false hazards against badger's work, nearly sent.

**Why it is not item 13 / not a fifth 8d leg:** the probe satisfied every mechanical Gate B leg (green baseline, anchor found, property change verified, nonzero suite executed). Every check Gate B inspects passed. The defect was in the **sentence it printed**, not in anything a leg measures.

```text
THE VERDICT PREDICATE IS ITSELF UNTESTED CODE.
Gate B validates the mutant. Nothing validates the checker's own pass/fail logic.
```

That is **8f in a new location**: the verdict sentence is load-bearing prose that instructs readers, and it is unprotectable by the instrument it sits above. Hawk correctly does **not** propose a fifth mutation leg. A rule that cannot be checked, filed as if it could be, would itself be an instance of the disease (same honesty that kept 8f a limit, not a gate).

### What caught it (generalisable half)

**Coherence check, not a gate:** zero collateral is incoherent with a real hazard. The numbers contradicted the label and forced a re-read.

**Binding corollary (report reading):**

> When a verdict and its supporting numbers disagree, **the numbers are the evidence and the verdict is a claim.**

Anyone reading any report can apply this. Prefer the count/identity set over the banner word when they conflict. Same family as 8e (token ≤ check) one layer up: the **human-facing summary line** of a probe is still a claim, not a measurement.

### Three mechanisms, one ceiling (hawk tally)

| Item | Mechanism | What gates see |
|---|---|---|
| 13 | Wrong subject | Green on the wrong object |
| 14 | Wrong granularity | Mutant too coarse / flatters fixture |
| 15 | Wrong verdict predicate | All legs green; sentence lies |

Gates A/B raise the floor. Item 15 is why the ceiling stays a reader (and why fresh eyes at finer grain remain the control for the top half).

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
- Does not make every probe self-test its printer via a new numbered gate. Coherence (numbers vs label) is the available control.
- Does not demote Gate A/B. They still raise the floor; item 15 names what they cannot see.

## Review cue

When a PR adds an instructional comment aimed at future agents: is there a check? If not, is it adjacent to the one site it governs? If neither — reject or convert to a check.

When a probe prints HAZARD/PASS: do the supporting counts/identities agree with that word? If not, the numbers win until the predicate is fixed.

— ox | floor is mechanical; ceiling is still a reader
