# Unwired checks disposition (standing 8c duty two)

**Status:** stamped to hawk locked spec + binder-resting fix (hawk REQUEST CHANGES).  
**Greppable test:** hawk `scripts/check-slot-occupancy.test.mjs` (branch `storylint/slot-occupancy-test`).

**Branch:** `storylint/unwired-checks`  
**Token (machine):** `\bMANUAL DIAGNOSTIC\b` in the **first 400 characters**  
**Regex hawk will assert:** `/^[\s\S]{0,400}?\bMANUAL DIAGNOSTIC\b/`  
**Scope:** **can-fail only**. Detection must include ternary `process.exit(failed ? 1 : 0)`, `process.exitCode =` non-zero, and top-level `throw` — not only bare `process.exit(1)`.  
**Libraries:** **no token**. Exclusion = no top-level failure path AND imported by ≥1 repo file.

## Counts (corrected — hawk hand-scan was low)

Earlier "9 can-fail / 9 nofail" was **wrong**. Ternary exit and `exitCode` paths were missed in the first sweep.

| Bucket | Count | Notes |
|---|---|---|
| Can-fail standalones in scope of this ticket | **12** | 11 stamped at 30d9ea8 + **binder-resting** |
| Of those deferred | **1** | `t004-durable-dirty` (hawk L1) |
| Stamped MANUAL DIAGNOSTIC on this branch | **12** after binder fix (11 + binder) | t004 still unstamped by design |
| SHARED LIBRARY (no stamp) | **3** | step-label, step-phases, land-gate |
| Outside assertion (true nofail probes) | **5** | b5-face-touch, d6-companion-shots, lab-calm-verify, lab-touch-check, rail-budget |
| GATE wires this pass | **0** | |
| DEAD deletes | **0** | |

## Rules applied

- **GATE** — wire only when product-critical and stack cost budgeted. Wrong wire worse than honest label.
- **MANUAL DIAGNOSTIC** — can-fail standalone run by hand; header token in first 400 chars.
- **SHARED LIBRARY** — no stamp; reached via importers / unit tests.
- **DEAD** — delete only with supersession mutation proof.
- **DEFER** — disposition owned elsewhere.

## Important (hawk): token ≠ closure

`MANUAL DIAGNOSTIC` records **how a file is invoked**. It does **not** prove the file's checks can fail.

Example: `prove-step-stall.mjs` is correctly stamped and bound to the shipping helper, yet its static half can still silently stop detecting if the shared lock loses failing-direction coverage (hawk MUT on E1 / `step-import-lock` — gated suite may catch via a duplicate regex, not via the shared module). Inventory is duty two (reached/labelled), not a substitute for duty one (can fail) or duty three (was run before citation).

Also: classifiers and mutants must remove the **property**, not one occurrence of a string. Files may carry the token twice in the header; a single `.replace` is an invalid mutant.

## Classification + stamp state

| File | can-fail | Disposition | Stamp |
|---|---|---|---|
| `e2e/step-label.mjs` | caller | SHARED LIBRARY | none (correct) |
| `e2e/step-phases.mjs` | no | SHARED LIBRARY | none (correct) |
| `scripts/land-gate.mjs` | API | SHARED LIBRARY | none (correct) |
| `e2e/prove-step-stall.mjs` | **yes** | MANUAL DIAGNOSTIC | **stamped** |
| `e2e/au-fix-verify.mjs` | **yes** (`exitCode`) | MANUAL DIAGNOSTIC | **stamped** |
| `e2e/au-inbox-probe.mjs` | **yes** (`exitCode`) | MANUAL DIAGNOSTIC | **stamped** |
| `e2e/canon-empty-guard.mjs` | **yes** | MANUAL DIAGNOSTIC | **stamped** (later GATE candidate only) |
| `e2e/canon-empty-shots.mjs` | **yes** | MANUAL DIAGNOSTIC | **stamped** |
| `e2e/canon-load-audit.mjs` | **yes** | MANUAL DIAGNOSTIC | **stamped** |
| `e2e/canon-under-load-az.mjs` | **yes** | MANUAL DIAGNOSTIC | **stamped** |
| `e2e/density-d4-shots.mjs` | **yes** | MANUAL DIAGNOSTIC | **stamped** |
| `e2e/focus-ring-pass.mjs` | **yes** | MANUAL DIAGNOSTIC | **stamped** |
| `e2e/graph-audit.mjs` | **yes** | MANUAL DIAGNOSTIC | **stamped** |
| `e2e/binder-resting.mjs` | **yes** (`exit(failed?1:0)`) | MANUAL DIAGNOSTIC | **stamped** (hawk miss + fix) |
| `scripts/capture-test-green-cause.mjs` | **yes** | MANUAL DIAGNOSTIC | **stamped** (not package test script — hawk) |
| `e2e/b5-face-touch.mjs` | no | outside assertion | none |
| `e2e/d6-companion-shots.mjs` | no | outside assertion | none |
| `e2e/lab-calm-verify.mjs` | no | outside assertion | none |
| `e2e/lab-touch-check.mjs` | no | outside assertion | none |
| `e2e/rail-budget.mjs` | no | outside assertion | none |
| `e2e/t004-durable-dirty.mjs` | **yes** | **DEFER** | **untouched** (hawk L1 stack) |

## GATE wires this pass

**None.**

Later candidate (needs rat/product + stack budget): `e2e/canon-empty-guard.mjs`.

## DEAD this pass

**None.** Overlap between AO/AZ load probes is not supersession proof.

## Hawk review ask

After binder stamp: classifier should fail only on `t004-durable-dirty` (hawk-owned) until that disposition lands.

— dolphin | binder-resting stamped; counts corrected; t004 still yours
