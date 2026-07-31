<!--
  Tracked decision record.
  Author: bear
  Kind: rule
  Decided: Visibility in automated checks is never inferred from geometry.
  Origin: TASK AG — audit of every visibility determination in e2e/.
-->

# Rule — never infer visibility from geometry

**Status:** STANDING RULE. Applies to every automated check in this repo, present and future.

## The rule

1. **Never decide "is this visible" from `getBoundingClientRect()`.** A non-zero box is not evidence that a user can see something.
2. **Use `Element.checkVisibility()`**, plus an explicit closed-`<details>` guard.
3. **Assert both directions in the self-test.** A visibility predicate that has only ever been tested on visible elements is untested.
4. **Absence is not a pass.** Every check has three outcomes — PASS, FAIL, **NOT-MEASURED** — and NOT-MEASURED fails the gate. A checker must never give the same verdict to "correctly collapsed" and "I could not find the thing I am judging".
5. **A selector that matches nothing is a failure**, not a warning. A check that has never failed and cannot find its target is not a check.
6. **Guard per element, not per container.** Ask "is this element inside a closed `<details>`", never "does this container contain a `<details>`".

## The predicate

```js
const isVisibleEl = (el) => {
  if (!el) return false
  // Closed <details> children keep their layout boxes. Check this first.
  if (el.closest('details:not([open])')) return false
  if (typeof el.checkVisibility === 'function') {
    return el.checkVisibility({
      contentVisibilityAuto: true,
      opacityProperty: true,
      visibilityProperty: true,
    })
  }
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0
}
```

Keep the `closest()` clause even though `checkVisibility` exists. `contentVisibilityAuto` covers `content-visibility: auto`; the treatment of closed-`<details>` content is implementation-defined and has changed between engine versions. The clause is one call and removes the dependence.

## Why — the evidence

A closed `<details>` still produces layout boxes for its children in Chromium. Measured against the real UI, running the calm gate's own chip filter beside the predicate above **in the same `evaluate()` call**:

| Viewport | closed `<details>` | gate counts | truth | verdict |
|---------:|-------------------:|------------:|------:|---------|
| 390 | 1 | **8** chips | **0** | disagree by 8 |
| 1440 | 0 | 5 | 5 | agree |

At 390 the screenshot shows a collapsed `Tags +` and no chips. The pixels agree with the predicate. The gate was wrong, reproducibly.

## Why it is worse than a flaky check

The error **has no fixed direction**:

- **False green.** Collapsed content is counted as present, a ceiling is satisfied by accident, and a screen scores calm for a reason unrelated to its design.
- **False red.** Correct progressive-disclosure work is scored as having changed nothing, because the controls it just hid are still counted.

A checker that punishes correct work is worse than no checker. It teaches implementers to game the number — inflate padding, delete markup, widen a container — until the measurement moves. Every element-count or density measurement over a surface containing a `<details>` is suspect until re-measured with a real predicate.

## Sibling failures found in the same audit

Same disease, different symptom. All three make a green mean nothing. Adopted by ox as false-green classes **M1** (this document's `<details>` mechanism), **M2** (dead selectors), **M3** (pass on absence) — see `calm-budget-r3-ox.md` §11.

**M2 — Dead selectors.** `measureCraft` searched `.craft-tags, .manuscript__tags, .tag-strip, .chip-strip`. The real class is `.manuscript__craft-tags`. A CSS class selector is exact, not a substring match, so none of the four ever matched. Two HARD checks depended on it, surviving only incidentally through an `[aria-label*="craft" i]` fallback that any copy edit could remove. A selector that matches nothing produces a confident PASS.

> Corollary: **a check whose measurement is zero, `found: false`, or `missing: true` and which still passes is presumed broken.** That single question catches most vacuous checks without re-deriving each one.

**M3 — Pass on absence.** `craftCollapsedDefault = chips.length === 0 || collapsedDisclosure || chips.length <= 5`. The first term cannot distinguish "correctly collapsed" from "I could not find the surface". Observed passing on a run where the manuscript rendered no craft UI at all.

**Height math.** Counting text lines as `clientHeight / lineHeight` reports a padded single-line row as wrapped. Count real line boxes instead — a `Range` over the contents yields one rect per line:

```js
const range = document.createRange()
range.selectNodeContents(el)
const tops = []
for (const q of range.getClientRects()) {
  if (q.width > 0 && q.height > 0 && !tops.some((t) => Math.abs(t - q.top) < 2)) tops.push(q.top)
}
const lines = Math.max(tops.length, 1)
```

## Practice

- **Trust the browser over the DOM.** When a probe and a screenshot disagree, the screenshot wins. Two fabricated findings were caught this way during this audit: a craft "regression" that did not exist, and a wrapped row that was not wrapped. Both looked convincing in DOM output.
- **Verify a new guard fails.** Reintroduce the defect and watch the check go red. A guard never observed failing is not known to be a guard.
- **Distinguish measuring from deciding.** Reading a known element's width is fine and needs no predicate. Deciding whether an element *counts* needs the predicate. The audit found 27 geometry sites in `e2e/`; only 9 were decisions.

## Scope

Applies to `e2e/`, any density or budget checker, and any future visual-QA tooling. Product code is unaffected — this is a rule about how we *measure*, not how we render.
