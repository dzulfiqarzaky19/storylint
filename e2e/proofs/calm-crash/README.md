--- proof-provenance ---
head: be79d9065cc93763f2e652fad049dea8dc752f91
worktree_dirty: true
command: salvage report: copy untracked calm-crash specimen from storylint-calm-crash @ ea0500a; no product rerun
exit: 0
timestamp: 2026-08-01T12:00:00.000Z
--- end-proof-provenance ---

# calm-crash specimen (salvaged 2026-08-01)

Untracked evidence from worktree `storylint-calm-crash` @ detached `ea0500a`,
copied here before that folder is deleted. **Report-only.** No product fix in this land.

## What is here

| Path | Role |
|------|------|
| `loop-summary.jsonl` | 8 serial calm-budget runs, one JSON line each |
| `run-01.log` … `run-08.log` | Full unfiltered calm stdout/stderr |
| `loop.mjs` | Harness that produced the loop (renamed from `_calm_loop.mjs`) |
| `interfere.mjs` | Separate deliberate interference harness (renamed from `_calm_interfere.mjs`) — **not** the producer of these 8 runs |

## Loop shape (check 1)

`loop.mjs` is **serial**: `for (let i = 1; i <= MAX; i++) results.push(await one(i))`.
Each run spawns one `e2e/calm-budget.mjs` child and waits for close. No second writer
process is started by the loop.

`interfere.mjs` is a **different** tool: it runs calm and, after both self-tests ok,
kicks `npm run build` + touches `dist/` in the same worktree. There is no
`interfere-*.log` / `interfere-summary-*.json` beside these eight runs. The 8-run
specimen is therefore a **natural serial** loop result, not a forced multi-process
interfere run. (Forced interfere remains available as a weaker optional probe.)

## Outcome

| Run | code | kind | bytes |
|-----|------|------|-------|
| 1–7 | 0 | `pass` | 6315 |
| 8 | 1 | `died-after-self-tests-no-identity` | 1377 |

Classifier label `died-after-self-tests-no-identity` means: both self-tests printed ok,
and neither `HARD fails:` nor `FINGERPRINT` appeared. It does **not** mean "no Error
text". Run 08 has a full stack (see below).

## Where run 08 died (check 3)

From `run-08.log`:

1. `[owned-stack] building … @ ea0500a` — owned API/UI up
2. `[visibility-self-test] ok`
3. `[b6-primary-visibility-self-test] ok`
4. Then throw in `ensureDraftReady` (first viewport project create), **before** any HARD check or FINGERPRINT:

```
Error: ensureDraftReady create failed: 400 {"error":"EPERM: operation not permitted, rename
  '…\\data\\projects\\e2e-calm-32468-ms9m2ta4.json.tmp'
  -> '…\\data\\projects\\e2e-calm-32468-ms9m2ta4.json'"}
    at ensureDraftReady (e2e/helpers.mjs:1279)
    at async runViewport (e2e/calm-budget.mjs:1100)
```

`hasRunEnd:false`. Exit 1 from the uncaught throw.

## Tip under test

`ea0500a` — **before** T-005 path-lock land `df405c8`. Single-process EPERM on the
atomic rename at this tip is the T-005 class (B1), not proof that today's origin/dev
still dies the same way.

## Orphan-server window (check 2) — uncertainty, not resolved

File mtimes (local): harness ~07:03–07:05, runs 07:04–07:06 on 2026-08-01.
A later cleanup found many orphaned dev servers holding directory handles for
12–16h. **Whether those orphans were live during this loop is not established from
these files alone.** Recorded as uncertainty. Do not treat this specimen as
"reproduces on a clean machine" without a fresh clean-machine re-run.

## Ticket read (do not merge T-006 into T-008)

Rat brief hypothesized T-006 (silent post-b6 exit 1, no stack) and T-008 (per-process
lock / multi-process EPERM) are one bug. **Checked against this evidence: they are not.**

| Claim | Evidence |
|-------|----------|
| T-006 = silent / no stack | **Contradicted.** Run 08 prints full EPERM Error stack. T-006's own ticket already classifies "EPERM / Error stack present" as **Not B2** (T-005 / B1). |
| T-008 = multi-process concurrent writers | **Not shown here.** Loop is serial one calm child at a time. No second Node process writing the project file is in the harness path that produced run-08. |
| Same atomic rename path | True and unsurprising. B1 and multi-process races both surface on `rename(tmp→json)`. Shared surface ≠ shared ticket. |

**Stop condition honored:** do not fold T-006 into T-008 to match the brief.
Keep both open with their original framing. This folder is the salvaged B1-class
specimen + harness, not a T-006→T-008 merger proof.

## Founder decision (still T-008's, unchanged)

If multi-process writers on one project file must be supported: adopt an explicit
cross-process lock (with stale-owner policy) **or** accept per-process as the boundary
and make multi-process failure loud/diagnosable. That decision lives on T-008; this
specimen does not force it.

## How to re-run (optional)

```text
node e2e/proofs/calm-crash/loop.mjs
# optional weaker force:
node e2e/proofs/calm-crash/interfere.mjs
```

Prefer a clean machine (no orphan node/vite on the data dir) if claiming fresh repro.
