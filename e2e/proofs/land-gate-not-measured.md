# Land gate NOT-MEASURED proof (E1-class, gate level)

**Date:** 2026-07-31  
**Branch tip:** `storylint/land-gate-not-measured` @ `227d67b`  
**Incident:** origin/dev `81dc752` land reported `introduced=0, no-worse gate passed` while both baseline and candidate died with `'tsc' is not recognized` (no node_modules). Gate collapsed both voids to `opaque:test-green-exit-1` and compared equal.

## Defects fixed

1. **Opaque identity banned.** `opaque:test-green-exit-N` no longer emitted. Identities are `guard:` / `build:` / `unit:` / `smoke:` / `calm:` / `infra:` / `not-measured:`.
2. **Infrastructure is NOT-MEASURED.** Void runs hard-abort. no-worse compares product failures only when **both** runs `measurement === 'measured'`. Identical voids never pass.
3. **Unprepared worktree refused up front.** `inspectWorktreePrep` checks `node_modules` + local `tsc` + `vite` before any test:green. Missing toolchain is not discovered as a build error and reasoned about as a test outcome.

## Proofs

### Unit (scripts/land-gate.test.mjs) — 18/18 pass

- `tsc-not-recognized is NOT-MEASURED, never opaque:exit-1`
- `identical void baseline+candidate must HARD ABORT, not no-worse pass` → `baseline-not-measured`
- `candidate-only void also hard aborts` → `candidate-not-measured`
- product identities: unit / smoke / calm HARD / build:TS / guard
- no-worse still passes on identical **measured** product reds (pre-existing)

### Fault injection — rename node_modules

```
ren node_modules node_modules._off_landproof
node -e "import {inspectWorktreePrep} from './scripts/land-gate.mjs'; ..."
→ ok:false reasons:["missing-node_modules"]
PROOF OK: prep refuses missing node_modules
ren node_modules._off_landproof node_modules
→ restored; tsc present; land-gate tests still 18/18
```

Land would hit `assertWorktreePrepared` (step 2/9) and `fail(...)` with NOT-MEASURED messaging — never reach no-worse compare.

## Files

- `scripts/land-gate.mjs` — pure classify + prep + gate decision
- `scripts/land-gate.test.mjs` — fault + identity fixtures
- `scripts/land.mjs` — wires prep + classify; drops opaque token
- `package.json` — `npm test` includes `scripts/**/*.test.mjs`

## For horse (L2)

L2 composition gate must import the same `measurement` rule: never treat NOT-MEASURED / infra voids as comparable failure sets. Prefer `gateNoWorseDecision` from `scripts/land-gate.mjs` over re-implementing opaque exit tokens.
