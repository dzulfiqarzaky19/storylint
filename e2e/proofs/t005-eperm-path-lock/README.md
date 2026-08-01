# T-005 — Windows EPERM on project atomic rename

## Mechanism
`ProjectStore` queued only save/update/switchFile **per instance**. `load()` read the file off-queue. `GET /api/projects` built `new ProjectStore(path).load()` per id. On Windows, `rename(tmp → dest)` fails with **EPERM** while any handle is open on dest.

## Fix
Path-keyed exclusive chain in `src/server/store.ts` covering **every** load/save/update/switchFile, shared across all `ProjectStore` instances for the same resolved path. No EPERM retry.

## Mutation proof
| shape | before | after |
|---|---|---|
| unqueued multi-writer thrash | 988 EPERM | 0 (`AFTER.json` twoInstanceThrash) |
| open handle during rename | 50/50 EPERM | N/A product (control still EPERMs outside store) |
| multi-instance load+save | races | 0 (`server.test.ts` + probe) |

Run: `node --experimental-strip-types e2e/proofs/t005-eperm-path-lock/probe.mjs`

## Author impact
Chapter and sheet Save surface via `setError` + `project-error` alert (not silent). Local draft retained until successful save. Still P0 for land reliability and durable write path.

## Out of scope (filed, not fixed here)
- Save chip prints blank on error (`Saving…`/`Saved`/`''`) — P2 honesty-of-state.
- Silent calm death without stack — separate ticket (horse).
