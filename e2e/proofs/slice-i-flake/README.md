# slice-i flake specimens (Windows EPERM atomic rename)

## Finding (one defect, four observations)

Both historical `smoke:e2e/slice-i-smoke.mjs` land failures share the **same throw site and mechanism**:

```
Error: ensureDraftReady normalize failed: 400
{"error":"EPERM: operation not permitted, rename
  '...\\data\\projects\\e2e-….json.tmp' -> '...\\e2e-….json'"}
at ensureDraftReady (e2e/helpers.mjs:1296)
at e2e/slice-i-smoke.mjs:58
```

This is the same Windows atomic-write rename EPERM buffalo hit in its calm loop. What looked like two independent flakes (baseline-only vs candidate-only) is **one defect** with alternating unlucky sides of no-worse.

## Paired lands

| Land | Result | Side that hit EPERM |
|---|---|---|
| `land-3d213b1-full.output` | shipped gate @ 3d213b1 | **baseline** FAIL, candidate PASS → `fixed=smoke:e2e/slice-i-smoke.mjs` |
| `land-ac4017a-slice-i-candidate-fail.output` | first quote-class land abort | baseline PASS, **candidate** FAIL → introduced abort |
| `land-ac4017a-reland-success.output` | re-land → origin/dev 715bbf1 | both green |

Excerpts: `FAILURE_MODES.txt`.

## For octopus

- Known throw: `e2e/helpers.mjs:1296` (`ensureDraftReady` normalize path).
- Caller: `e2e/slice-i-smoke.mjs:58`.
- Mode is infrastructure EPERM on `rename(tmp→json)`, not a product assertion flake.
- Alternation is which side of no-worse got unlucky, not two different bugs.
