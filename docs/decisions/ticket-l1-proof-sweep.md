# Ticket l1_proof / shortest_repro sweep

HEAD checked: `3c18f9a`
Generated: 2026-08-01T03:20:21.754Z

## Method

- Scope: `docs/tickets/T-001.md` … `T-009.md` frontmatter fields `l1_proof` and `shortest_repro`
- Path existence against `git ls-tree HEAD` (origin/dev tip at check)
- Commands: extracted from fields/body, then **executed** (falcon method). Heavy suites skipped only when not the named claim.
- Understatement detector: fields say "not checked in" / "no probe yet" while `e2e/proofs/t00X-*/probe.mjs` is on the tree
- Falcon rule carried: **READ WHAT MATCHED, NOT THE NUMBER IT GAVE YOU.** Fail-count regexes can match test names. Evidence lines printed below.
- Reproducible starter: `scripts/_l1-proof-sweep.mjs` (MANUAL DIAGNOSTIC; command splitter still weak on em-dashes — probes below were re-run directly)

## Class

Mirror of overclaim: a ticket can **UNDERSTATE** its own evidence. Nothing looks broken. A triager reads "no probe", re-derives the measurement by hand — the waste the probe existed to prevent. Harder to notice than claiming more than the code does.

| subclass | meaning |
|----------|---------|
| understatement-probe-exists | fields deny a checked-in probe; tree has it |
| field-path-missing | l1_proof/shortest_repro cites a path absent from origin/dev |
| command-exit-unexpected | extracted field command ran; exit/evidence contradicts claim |
| bonus-stale-probe | a probe on tree is not the field claim and may itself be stale |

## Actionable (fixed this land)

| ticket | kind | detail |
|--------|------|--------|
| **T-008** | understatement-probe-exists | fields said "no checked-in probe yet" / "probe script not checked in"; tree has `e2e/proofs/t008-per-process-lock/probe.mjs` since earlier land. Frontmatter + Repro updated to cite it (same text as falcon branch `storylint/falcon-t008-citation-fix`, not yet on dev). Probe re-run: **exit 0**, PASS line matched. |

## Per-ticket

### T-001 (`done`)

- **l1_proof:** owned-stack Lab smoke + domain status transitions (landed with lifecycle; restore d3570f4; dismiss 7fc4d17/5331466/9fac01d)
- **shortest_repro:** docs/decisions/lab-lifecycle-ends.md § Implementation sketch; fixture 10+ promoted → dismiss one → row gone, proposal untouched
- **paths:**
  - docs/decisions/lab-lifecycle-ends.md → RESOLVES
- **commands / evidence:**

```
no executable path/command in fields (narrative + decision doc). Existence of decision doc only.
```

- **verdict:** OK (narrative proof; path resolves)

### T-002 (`integrated`)

- **l1_proof:** guard-helpers + owned-stack refuse path (same as test:green)
- **shortest_repro:** npm run test:l2 on integrated origin/dev; must not equal all-smoke under a new name — shared-project Draft→Canon→Lab journey
- **paths:**
  - (no path tokens in fields)
- **commands / evidence:**

```
CMD: `npm run test:l2`
exit=0
matched: `PASS: e2e helper convention holds`
matched: `PASS l2-composition head=3c18f9a project=… steps=9 (draft↔canon↔lab shared container)`
```

- **verdict:** OK — command runs and PASS lines matched (not a bare fail count)

### T-003 (`integrated`)

- **l1_proof:** owned-stack binder scroll check (rail@1440 + drawer@390); head required; mutation red proven
- **shortest_repro:** docs/decisions/canon-under-load-az.md; e2e binder scroll-restore sample @68 (…)
- **paths:**
  - docs/decisions/canon-under-load-az.md → RESOLVES
  - e2e/proofs/T-003-scroll-restore-mutation.txt → RESOLVES (body/proofs, not field path token)
  - e2e/binder-scroll-restore-smoke.mjs → RESOLVES (shipping smoke; not named in fields)
- **commands / evidence:**

```
fields name decision doc + git shas, not a probe command. No understatement phrase.
```

- **verdict:** OK — field path resolves; no false "not checked in"

### T-004 (`done`)

- **l1_proof:** owned-stack dirty→reload→dirty restore; Save clears; Discard clears; server-moved→conflict chooser; 7d confirm
- **shortest_repro:** docs/decisions/sheet-identity-refresh-loss.md — dirty name → reload → name restored and dirty
- **paths:**
  - docs/decisions/sheet-identity-refresh-loss.md → RESOLVES
  - e2e/proofs/T-004-durable-dirty.txt → RESOLVES (proofs tree)
- **commands / evidence:**

```
narrative + decision doc; no understatement phrase.
```

- **verdict:** OK

### T-005 (`done`)

- **l1_proof:** e2e/proofs/t005-eperm-path-lock/ (BEFORE…AFTER…MUT-6…); server.test multi-instance + rename-fail reject
- **shortest_repro:** calm-budget isolated loop run-8 @ ea0500a — ensureDraftReady create 400 EPERM rename under data/projects
- **paths:**
  - e2e/proofs/t005-eperm-path-lock/ → RESOLVES (dir + probe.mjs + BEFORE/AFTER/MUT json)
  - e2e/proofs/t005-eperm-path-lock/probe.mjs → RESOLVES
- **commands / evidence:**

```
CMD: `node --experimental-strip-types e2e/proofs/t005-eperm-path-lock/probe.mjs`
exit=0
matched JSON: `"pass": true`
matched: after.twoInstanceThrash.total = 0 (byCode {})
matched: controlOpenHandleStillEPERM.byCode.EPERM = 20 (expected control non-zero)
shortest_repro names a historical calm-budget specimen @ ea0500a (gitignored run artifact) — not a live command claim
```

- **verdict:** OK — probe command runs green; historical specimen path is narrative

### T-006 (`open`)

- **l1_proof:** node scripts/capture-test-green-cause.mjs --n 1; land baseline runCapture [cause] lines (land.mjs @ 17c72df+)
- **shortest_repro:** rare — specimen e2e/proofs/land-gate/buffalo-calm-incomplete.output …
- **paths:**
  - scripts/capture-test-green-cause.mjs → RESOLVES
  - e2e/proofs/land-gate/buffalo-calm-incomplete.output → RESOLVES
- **commands / evidence:**

```
full `node scripts/capture-test-green-cause.mjs --n 1` is a land-baseline loop (HEAVY) — not re-run this pass
existence of capture script + buffalo specimen: both on tree
no understatement phrase
```

- **verdict:** OK existence; live capture loop left HEAVY (open ticket measurement tool)

### T-007 (`done`)

- **l1_proof:** e2e/proofs/t007-single-root/probe.mjs; src/server/store-root.test.ts …
- **shortest_repro:** node --experimental-strip-types e2e/proofs/t007-single-root/probe.mjs — split-spelling errors >0; single-spelling control 0
- **paths:**
  - e2e/proofs/t007-single-root/probe.mjs → RESOLVES
  - src/server/store-root.test.ts → RESOLVES
- **commands / evidence:**

```
CMD: `node --experimental-strip-types e2e/proofs/t007-single-root/probe.mjs`
exit=0
matched: `split-spelling errors:  29` (non-zero as claimed)
matched: `single-spelling errors: 0  <- control, the lock working`
matched: `PASS: two spellings of one file bypass the lock; one spelling does not. T-007 stands.`
NOTE: did not trust a fail-count regex; printed the PASS line and both arm counts
```

- **verdict:** OK — command matches claim

### T-008 (`open`)

- **l1_proof:** WAS: — (open ticket; … no checked-in probe yet) → NOW: e2e/proofs/t008-per-process-lock/probe.mjs — self-verifying…
- **shortest_repro:** WAS: see Repro… probe script not checked in → NOW: node --experimental-strip-types e2e/proofs/t008-per-process-lock/probe.mjs — …
- **paths:**
  - e2e/proofs/t008-per-process-lock/probe.mjs → RESOLVES (was denied by fields)
- **commands / evidence:**

```
CMD: `node --experimental-strip-types e2e/proofs/t008-per-process-lock/probe.mjs`
exit=0
matched: `multi-process errors:  23  (3 processes x 120 rounds)` (nondeterministic count — not asserted as fixed N)
matched: `single-process errors: 0  <- control, same volume, lock applies`
matched: `PASS: races across processes, clean within one. The lock boundary is per-process, as T-008 states.`
matched sample line includes EPERM rename (evidence of multi-process race arm)
```

- **verdict:** FIXED understatement — fields now cite the probe that already passed on tip

### T-009 (`done`)

- **l1_proof:** src/server/rule11a-no-retry.test.ts (falcon probe mechanism) + e2e/proofs/t009-rule11a-no-check/mutation-proof.json
- **shortest_repro:** insert a 50ms sleep-then-retry into saveDirect's catch → npm test 224/224 green
- **paths:**
  - src/server/rule11a-no-retry.test.ts → RESOLVES
  - e2e/proofs/t009-rule11a-no-check/mutation-proof.json → RESOLVES
  - e2e/proofs/t009-rule11a-no-check/probe.mjs → RESOLVES on tree but **not named in l1_proof/shortest_repro**
- **commands / evidence:**

```
Field claim is unit test + mutation-proof artifact (not the e2e probe command).
BONUS: ran `node --experimental-strip-types --experimental-test-module-mocks e2e/proofs/t009-rule11a-no-check/probe.mjs`
exit=1
matched: `Error: ProjectStore: use ProjectFileRoot.openDefault/openId or ProjectStore.open` at probe.mjs:54
This is NOT field understatement (fields never claimed that probe). It is a stale side probe vs current ProjectStore constructor API — separate from l1_proof honesty.
shortest_repro is a mutation recipe ("insert sleep-then-retry") not a paste-run command — acceptable for done ticket with unit coverage.
```

- **verdict:** OK on field claims; bonus stale probe noted (not fixed here — out of l1_proof scope unless rat wants it)

## What we did not do

- Did not ship skill content or invent missing design docs.
- Did not re-run full `test:green` / multi-hour capture loops for T-006.
- Did not "fix" T-009 side probe constructor drift in this land (fields already honest; product API change is a different ticket if desired).
- Did not trust `/fail\s+(\d+)/` without printing the matching line context.
