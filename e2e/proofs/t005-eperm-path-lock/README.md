# T-005 — Windows EPERM on project atomic rename

## Mechanism
`ProjectStore` queued only save/update/switchFile **per instance**. `load()` read the file off-queue. `GET /api/projects` built `new ProjectStore(path).load()` per id. On Windows, `rename(tmp → dest)` fails with **EPERM** while any handle is open on dest.

## Fix
Path-keyed exclusive chain in `src/server/store.ts` covering **every** load/save/update/switchFile, shared across all `ProjectStore` instances for the same resolved path **within one process**. No EPERM retry. `runLocked` pins the path at call time so RMW finishes on the file it started against.

## Mutation proof
| shape | before | after |
|---|---|---|
| unqueued multi-writer thrash | 988 EPERM | 0 (`AFTER.json` twoInstanceThrash) |
| open handle during rename | 50/50 EPERM | N/A product (control still EPERMs outside store) |
| multi-instance load+save | races | 0 (`server.test.ts` + probe) |
| load unlocked + held FD | 11 EPERM | green when lock restored |
| EPERM-only swallow in saveDirect (falcon MUT-6) | suite green | `failed atomic rename rejects save…` red |

Run: `node --experimental-strip-types e2e/proofs/t005-eperm-path-lock/probe.mjs`
MUT-6 swallow check: `node e2e/proofs/t005-eperm-path-lock/mut6-swallow-check.mjs` (must exit 0 = test failed under swallow)

Load-bearing units:
- `two ProjectStore instances on one path serialize load and save without EPERM`
- `failed atomic rename rejects save and leaves prior project bytes` (acceptance: no silent success)
- `switchFile serializes…` (path identity after drain; pinning guarded by falcon MUT-2 probe, not this unit alone)

HTTP thrash test is a probabilistic regression net only, not the T-005 proof.

## Author impact
Chapter and sheet Save surface via `setError` + `project-error` alert (not silent). Local draft retained until successful save. P1 reliability (not silent data loss).

## Out of scope (filed, not fixed here)
- Save chip prints blank on error (`Saving…`/`Saved`/`''`) — P2 honesty-of-state.
- Silent calm death without stack — separate ticket (horse).
- Junction path-key residual (`resolve` does not collapse junctions) — unreachable today via single `projectPath()`; follow-on if multi-spelling appears.
- Cross-process writers — lock is per-process only.
