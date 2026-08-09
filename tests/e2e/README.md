# End-to-end tests (`tests/e2e`)

Playwright drives the **real app against a live Postgres**. These are integration
tests, not isolated unit tests: the server reads the same database the tests
seed and read back, so setup and cleanup matter.

## Run recipe

```bash
# 1. Build + start the production server on port 3100 (isolated build dir)
set NEXT_DIST_DIR=.next-e2e   # PowerShell: $env:NEXT_DIST_DIR=".next-e2e"
npm run build
npx next start -p 3100        # Playwright reuses this if already up

# 2. Run the suite — no flags needed
npm run test:e2e

# 3. (optional) Remove the .last-run.json Playwright writes post-teardown
npm run e2e:clean
```

The config now carries the pieces that used to be manual steps:

- **`globalSetup`** runs `db:setup` (reset + seed) **once** before the suite, so
  you do not seed by hand and no spec re-seeds the whole DB on startup.
- **`globalTeardown`** removes `test-results/` and `playwright-report/` after the
  run (set `E2E_KEEP_ARTIFACTS=1` to keep a failing run's traces).
- **`workers: 1`** — the suite is serial. The specs share one Postgres, so
  parallel workers would race each other's `db:seed` TRUNCATEs. Do not raise it
  without giving each worker its own database.

Escape hatches: `E2E_SKIP_SEED=1` reuses an already-seeded DB when iterating on a
single spec; `E2E_KEEP_ARTIFACTS=1` preserves artifacts for inspection.

## Why this harness is customized (and how to re-target it)

| Customization | Where | Why | To change |
| --- | --- | --- | --- |
| Microsoft Edge channel | `playwright.config.ts` `channel: "msedge"` | This box could not fetch the pinned Chromium; Edge is Chromium-based and present | Swap to `chromium` once the browser download works |
| Port 3100 | config `webServer` + `baseURL` | Keeps the e2e server off the dev server (port 3000) | `SMOKE_BASE_URL` env overrides `baseURL` |
| Production build, not dev | `next start` | Deterministic; no HMR surprises | Source changes need `npm run build` + a server restart, **not** just a file save |
| Live Postgres | app + specs | The product has no in-memory mode | `DATABASE_URL` (falls back to `.env.local`) |

### Isolating the build dir (`NEXT_DIST_DIR`)

Next writes `.next/` and a `next start` server loads that build **at boot**. If a
second process (a dev server, another `next build`) rewrites `.next/` while your
server is running, the served HTML references chunk hashes that no longer exist
on disk, the client bundle 404s, and **components silently fail to hydrate**
(the editor renders but produces zero marks/underlines).

To run e2e immune to that, build and serve from a dedicated dir:

```bash
set NEXT_DIST_DIR=.next-e2e   # PowerShell: $env:NEXT_DIST_DIR=".next-e2e"
npm run build
npx next start -p 3100
```

## The state-pollution gotcha (read before adding a spec)

Some specs **persist** state that survives a reload:

- `write-conflict.spec.ts` — a "leave it" resolution writes `resolved_marks`.
- `smoke.spec.ts` / wiki authoring — writes `entries`, `kept_cards`.

`db:seed` TRUNCATEs that runtime state, but the suite only seeds **once** up
front. Playwright runs spec files **alphabetically**, so a spec that resolves a
mark can suppress it for every later-sorting file. That is exactly how the
`write-*` editor tests once went red: `write-conflict.spec.ts` (sorts before
`write-lifecycle.spec.ts` and `write.spec.ts`) left Chapter 7 marks resolved, so
the downstream editor rendered 0 underlines.

**Rule for any state-mutating spec:** leave the DB as you found it. Reseed in a
`test.afterAll` through the shared helper so later files start from the canonical
fixture:

```ts
import { reseed } from "./_helpers/seed";

test.afterAll(reseed);
```

Prefer a single `afterAll` reseed over reseeding in `beforeEach` — a per-test
full reseed is correct but slow, and a **read-only** spec should never pay for a
reseed at all. The one documented exception is `write-conflict.spec.ts`, whose
tests are genuinely order-dependent (a persisted "leave it" would starve later
tests of a conflict), so it reseeds per-test on purpose; the comment there says
why, so nobody "optimizes" it into a `beforeAll`.

### Shared helpers (`tests/e2e/_helpers/`)

| Helper | Exports | Use for |
| --- | --- | --- |
| `seed.ts` | `reseed()`, `resetAndSeed()` | Restoring DB state in `afterAll` |
| `db.ts` | `databaseUrl()`, `withDb()`, `queryOne()`, `countRows()` | Reading Postgres back to prove a write landed |
| `rail.ts` | `RAIL`, `rail()`, `railRows()`, `pressedRows()`, `openRow()`, `escapeRe()` | The write screen's Outstanding-marks rail (rows are **scoped** so Keep/tile toggles never leak in) |

## Reading the database back (integration proof)

UI state can lie. To prove a write actually **landed**, use `queryOne` from
`_helpers/db.ts` to query the same `DATABASE_URL` the server uses — see
`wiki-write-confirm.spec.ts`, which asserts a confirmed "Yes, write it in"
creates the `prop-<id>` `entries` row and flips `kept_cards.in_wiki`. Playwright
does not load `.env.local`, so `databaseUrl()` mirrors the app's tiny loader to
find `DATABASE_URL`.

## Artifacts are throwaway

`test-results/` and `playwright-report/` are **gitignored and never committed**.
Any code change means retesting the whole flow, so a stored report is never
trustworthy. `globalTeardown` removes both automatically after each run.

One quirk: Playwright writes `test-results/.last-run.json` *after* teardown, so a
tiny `test-results/` reappears at the very end. It is gitignored and harmless;
`npm run e2e:clean` (a separate process) removes it if you want a spotless tree.
