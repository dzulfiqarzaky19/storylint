# Unwired checks disposition (standing 8c duty two)

**Status:** classification only. Headers **not** stamped yet — waiting on hawk for the greppable `MANUAL DIAGNOSTIC` (or successor) token/regex so labels match the test that will enforce them.

**Branch:** `storylint/unwired-checks`  
**Base:** origin/dev  
**Scope:** 18 standalones from hawk's sweep, minus libraries correctly unwired, minus **t004** (deferred).

## Rules applied

- **GATE** — wire into `package.json` / `e2e/constants.mjs` (`ALL_FEATURE_SMOKES`) / `scripts/**/*.test.mjs` only when product-critical **and** stack cost is acceptable. Rat: wrong wire worse than honest label.
- **MANUAL DIAGNOSTIC** — can fail or not; run by hand; must carry hawk-canonical header once format lands.
- **SHARED LIBRARY** — imported module; not a lone executable gate (still name so can-fail helpers are not mistaken for unwired checks).
- **DEAD** — delete only with supersession proof.
- **DEFER** — disposition owned elsewhere.

## Inventory source

48 `e2e/*.mjs` + `scripts/*.mjs` scanned. Wired = named in `package.json` scripts, `ALL_FEATURE_SMOKES`, `e2e/all-smoke.mjs`, or matched by `scripts/**/*.test.mjs` glob. Unwired count on this tip: 21 including libs + t004.

## Classification (format-independent)

| File | can-fail | stack | Disposition | Reasoning |
|---|---|---|---|---|
| `e2e/step-label.mjs` | yes (caller) | no | **SHARED LIBRARY** | Exported `makeStep` / `assertStepPhases`. Used by slice-k/l + prove-step-stall. Correctly unwired. |
| `e2e/step-phases.mjs` | no | no | **SHARED LIBRARY** | Phase lists only. Correctly unwired. |
| `scripts/land-gate.mjs` | yes (API) | n/a | **SHARED LIBRARY** | Pure gate module. Reached via `scripts/land.mjs` + unit tests, not as a lone CLI gate. |
| `e2e/prove-step-stall.mjs` | **yes** | yes | **MANUAL DIAGNOSTIC** | E1 dynamic stall proof. Forces timeout; owned stack. Static half belongs in unit test / shared lock (badger/hawk path), not green e2e. **Do not GATE.** |
| `e2e/au-fix-verify.mjs` | **yes** | yes | **MANUAL DIAGNOSTIC** | DOM/ARIA sample after a11y work. Human-read evidence. Stack cost; not green. |
| `e2e/au-inbox-probe.mjs` | **yes** | yes | **MANUAL DIAGNOSTIC** | Inbox live-region probe. Short exploratory. |
| `e2e/canon-empty-guard.mjs` | **yes** | yes | **MANUAL DIAGNOSTIC** | Real product assertion (dirty-leave via empty-Canon CTA). **Candidate GATE later** if product owner wants it in green — needs owned-stack time budget review first. **Not auto-wired this pass.** |
| `e2e/canon-empty-shots.mjs` | **yes** | yes | **MANUAL DIAGNOSTIC** | P0 empty-Canon rubric + screenshots. Evidence pack; calm/gates cover resting density separately. |
| `e2e/canon-load-audit.mjs` | **yes** | yes | **MANUAL DIAGNOSTIC** | TASK AO read-only volume audit. Slow. Not green. |
| `e2e/canon-under-load-az.mjs` | **yes** | yes | **MANUAL DIAGNOSTIC** | TASK AZ read-only volume probe. Related to AO; keep both until author supersedes one. Not DEAD. |
| `e2e/density-d4-shots.mjs` | **yes** | yes | **MANUAL DIAGNOSTIC** | D4 map chrome shots. Soft geometry; `npm run calm` is the density gate. |
| `e2e/focus-ring-pass.mjs` | **yes** | yes | **MANUAL DIAGNOSTIC** | Focus-visible sample @1440. Human-reviewed. |
| `e2e/graph-audit.mjs` | **yes** | yes | **MANUAL DIAGNOSTIC** | Ad-hoc graph audit; historically no header. Exploratory. |
| `scripts/capture-test-green-cause.mjs` | **yes** | no | **MANUAL DIAGNOSTIC** | Land-shaped N-loop cause capture. `land.mjs` embeds same `[cause]` lines. Keep as fallback tool; not `npm test`. |
| `e2e/b5-face-touch.mjs` | no | yes | **MANUAL DIAGNOSTIC** | Exploratory B5 touch reproduce. |
| `e2e/binder-resting.mjs` | no | yes | **MANUAL DIAGNOSTIC** | D1 binder resting exploratory. |
| `e2e/d6-companion-shots.mjs` | no | yes | **MANUAL DIAGNOSTIC** | Shot pack only. |
| `e2e/lab-calm-verify.mjs` | no | yes | **MANUAL DIAGNOSTIC** | Worktree-pinned Lab resting verify. |
| `e2e/lab-touch-check.mjs` | no | yes | **MANUAL DIAGNOSTIC** | Touch-target size sample. |
| `e2e/rail-budget.mjs` | no | yes | **MANUAL DIAGNOSTIC** | Rail width measurement tool → JSON. |
| `e2e/t004-durable-dirty.mjs` | **yes** | yes | **DEFER** | Rat: hawk owns L1 acceptance disposition. **Do not touch.** |

## GATE wires this pass

**None.**

Closest promotion candidate (needs explicit product/rat call, not dolphin self-wire):

1. `e2e/canon-empty-guard.mjs` — real lost-work path; only after stack-time budget + flake review.

Everything else is evidence, volume audit, or tool.

## DEAD this pass

**None deleted.**

`canon-load-audit` vs `canon-under-load-az` overlap in spirit but are dated task probes with different scopes. Supersession needs author confirm, not inventory guesswork.

## What lands after hawk format lock

1. Stamp hawk-canonical header on every **MANUAL DIAGNOSTIC** row above (not t004).  
2. Stamp library marker on the three **SHARED LIBRARY** rows if hawk's test requires it (or leave if test only cares about can-fail executables).  
3. Optional: small unit test or hawk's greppable test once it lands on origin.  
4. Still no speculative `ALL_FEATURE_SMOKES` entries.

## Open questions for hawk

1. Exact header token/regex (`MANUAL DIAGNOSTIC` vs stricter block).  
2. Does the greppable test scope **only can-fail** standalones, or all unwired executables?  
3. Are libraries required to carry a token, or is "exported module without main" enough exclusion?  
4. Is `scripts/capture-test-green-cause.mjs` expected MANUAL or a named `package.json` script (still not test:green)?

— dolphin | classification complete; stamps blocked on hawk format
