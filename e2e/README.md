# e2e suite

Deterministic browser smokes and gates for Storylint.

## Commands

| Command | Purpose |
|---------|---------|
| `npm run test:e2e` | Feature smokes (`e2e/all-smoke.mjs`) |
| `npm run calm` | CALM_BUDGET geometry/face checker |
| `npm run test:e2e:guard` | Convention guard: measurement scripts must use helpers |

## Provenance (what did we measure?)

> **A measurement that cannot name what it measured is not evidence.**

UI gates must not adopt a stranger server on `:5173`. Multiple agents run Vite in multiple worktrees; measuring whatever happens to answer on that port is how we spent an hour arguing with a ghost build.

Rules:

1. **Checker owns the server.** Default path builds this tree and serves it on ephemeral ports (`e2e/owned-stack.mjs`). No default `STORYLINT_UI=http://localhost:5173`.
2. **Record + assert provenance** in every artifact: git HEAD, local `shell.css` sha12, served `shell.css` sha12, owned flag, UI/API origins. Served bundle must match the working commit or the run **refuses** (exit 2) — never PASS and never FAIL a ghost.
3. **External UI is opt-in only:** `STORYLINT_UI=...` requires `STORYLINT_ALLOW_EXTERNAL_UI=1`, and provenance is still asserted against this tree. Mismatch → refuse.
4. **Skip rebuild (dev only):** `STORYLINT_SKIP_BUILD=1` reuses existing `dist/` after you already built this commit.

| Helper | Use |
|--------|-----|
| `resolveMeasurementTarget()` | Own stack (default) or proven external UI |
| `ownMeasurementStack()` | Build + ephemeral API/UI + provenance endpoint |
| `assertServedProvenance(ui, expected)` | Fail closed if served ≠ working tree |

Calm exit codes: `0` no HARD fail, `1` HARD fail on proven bundle, `2` refused (unproven / precondition).

## Trust rule

This suite's job is to be **trusted**.

A flaky gate that trains people to re-run until green is worse than no gate.

Default path is offline/deterministic:

- LLM routes are stubbed via `installFixtureLlmRoutes` unless `STORYLINT_E2E_LIVE_LLM=1`.
- Each smoke isolates a project via `ensureIsolatedProject`.
- Draft editor readiness via `ensureDraftReady` / `fillChapterAndSave` (409-safe).

## Helpers are mandatory for UI measurement

All new e2e scripts that **measure product UI state** (geometry, companion faces, workspace density, fold ownership, craft chips, etc.) **must**:

1. `import { … } from './helpers.mjs'`
2. Switch surfaces with `gotoWorkspace` / `requireCompanionFace` (or `openCompanionFace(..., { require: true })`)
3. **Never measure before the precondition is proven**
4. On precondition miss: fail as `precondition not met` — never PASS on a wrong surface

Do **not**:

- ship a self-contained face/mode fallback when helpers fail to load
- fall back from `data-companion-context="graph"` measure to whatever panel is open
- click Workspace/face controls and assume the switch landed

Enforced by `node e2e/guard-helpers.mjs` (`npm run test:e2e:guard`).

## Isolation (concurrent agents)

Shared fixtures (`default`, `doors*`) are poison under concurrent agents.

Rules enforced by helpers:

1. **Per-run private project** via `ensureIsolatedProject` (unique id; refuses `default` / `doors*`).
2. **Reclaim before measure** via `reclaimIsolatedProject` / `beforeMeasure` — proves server active pointer is still ours.
3. **Empty is a precondition**, not an assumption: `assertProjectEmpty` / `claimEmptyProject` require `chapters===0 && sheets===0` after activate+reload.
4. If reclaim/empty fails → throw `PreconditionError` (`precondition not met`). Never PASS/FAIL a calm row on someone else's project.

| Helper | Use |
|--------|-----|
| `ensureIsolatedProject(page)` | Mint/activate private project |
| `reclaimIsolatedProject(id)` | Re-activate + prove active id |
| `assertActiveProject(id)` | Server (+ optional UI) pointer check |
| `assertProjectEmpty({ projectId })` | chapters/sheets must be 0 |
| `claimEmptyProject(page)` | Fresh empty private project |
| `beforeMeasure(page, { projectId, requireEmpty?, workspace?, companionFace? })` | Reclaim + surface proof before any measure |

## Shared helpers (`e2e/helpers.mjs`)

| Helper | Use |
|--------|-----|
| `installFixtureLlmRoutes(page)` | Stub research/review/cowrite |
| `ensureIsolatedProject(page)` | Unique project; avoids concurrent thrash |
| `ensureDraftReady(page)` | Chapter + Draft editor visible |
| `fillChapterAndSave(page, text)` | UI fill with 409 recovery |
| `waitSaved(page)` | Status/save settle |
| `companionPanel(page)` | Companion root locator |
| `openCompanionFace(panel, name, { require? })` | Face by accessible name; optional prove |
| `requireCompanionFace(page, name)` | Open + prove `data-companion-face` |
| `gotoWorkspace(page, mode)` | Draft/Lab/Canon + prove main/workspace |
| `assertWorkspace` / `assertCompanionFace` | Pure precondition checks |
| `ensureCompanionOpen` / `ensureBinderOpen` | Rail visibility |
| `dismissDrawers(page)` | Clear narrow-layout backdrops |
| `armHardTimeout(label)` | Process wall clock |
| `PreconditionError` | Thrown when surface/face/project did not land |

### Companion faces (D6)

- Primary writing tabs: Chat · Write · Check · Inbox{n?} · More
- Research is a **menuitem under More**, not a top tab
- Match faces by accessible name, not position
- Inbox may carry a count suffix (`Inbox 2`)

### Workspace modes

| mode arg | button | main | companion context |
|----------|--------|------|-------------------|
| `draft` (alias `manuscript`) | Draft | Draft | `writing` |
| `lab` | Lab | Lab | `lab` |
| `canon` (alias `graph`) | Canon | Relationship graph / Family tree | `graph` |

## Writing a new measurement script

```js
import {
  armHardTimeout,
  ensureDraftReady,
  ensureIsolatedProject,
  gotoWorkspace,
  installFixtureLlmRoutes,
  requireCompanionFace,
} from './helpers.mjs'

const stop = armHardTimeout('my-measure')
// page setup…
await installFixtureLlmRoutes(page)
await ensureIsolatedProject(page)
await page.goto(UI, { waitUntil: 'networkidle' })
await ensureDraftReady(page)

// precondition THEN measure
await gotoWorkspace(page, 'canon', { ensureCompanion: true, requireCompanionContext: true })
// measure graph faces only after context proven
await requireCompanionFace(page, 'Inspect')
// …measure…
stop()
```

## Feature smokes

Listed in `constants.mjs` → `ALL_FEATURE_SMOKES`, run by `all-smoke.mjs` with per-smoke hard timeouts and a green/red summary.
