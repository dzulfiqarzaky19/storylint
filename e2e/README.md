# e2e suite

Deterministic browser smokes and gates for Storylint.

## Commands

| Command | Purpose |
|---------|---------|
| `npm run test:e2e` | Feature smokes (`e2e/all-smoke.mjs`) |
| `npm run calm` | CALM_BUDGET geometry/face checker |
| `npm run test:e2e:guard` | Convention guard: measurement scripts must use helpers |
| `npm run test:green` | **ONE green:** guard + build + unit + owned smokes + calm |

## Provenance (what did we measure?)

> **A check that is measuring something OTHER than what it claims is not evidence.**

Three rules, one root failure (see also `docs/decisions/rule-visibility-not-geometry.md` rules 1–6):

1. **Name the commit and bundle.** If a check cannot state what it examined and at what commit, its output is not evidence.
2. **Never infer visibility from geometry.** Use `Element.checkVisibility` + closed-`<details>` ancestry (`isVisibleEl`). Self-test both directions. **NOT-MEASURED** (surface absent / dead selector / undetermined) is a first-class **failing** verdict — never PASS on absence (rules 4–6).
3. **Assert on behaviour and state, never on a label you do not own.** Chrome copy moves (D5 Back, bible→Canon, ox copy audit). Prefer outcome markers like `[data-binder-stack="list"]` over `getByRole(..., { name: 'Back to binder' })`, which hang on vanished strings.


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

## One green command

```bash
npm run test:green
```

Means: helper guard + production build + unit tests + feature smokes + calm budget.
Smokes and calm share `e2e/owned-stack.mjs` (build this tree, ephemeral ports, HEAD + shell.css provenance).
If a check cannot name the commit it measured, it fails closed (exit 2 refuse).

Do not invent alternate definitions of green. `npm test` is unit-only and does **not** run browser smokes.

## Five ways verification lied (seal lesson)

1. **No server ownership** — calm/smokes measured stranger Vite on :5173 across worktrees.
2. **Fixture contamination** — shared doors/default projects under concurrent agents.
3. **Closed `<details>` visibility** — rect-based counts treated collapsed content as painted.
4. **Smokes excluded from "green"** — agents reported unit `npm test` as merge-ready while e2e was red.
5. **Smokes unattributed** — same :5173 hole as calm.

Fail closed. A measurement that cannot name what it measured is not evidence.

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

## Visibility predicate

Rect-based "visible" is banned for density/chrome counts.

Chromium still yields layout boxes for children of a closed `<details>`. `getBoundingClientRect`, `offsetParent`, and computed display/visibility all lie. The gate uses `Element.checkVisibility` plus an explicit closed-`<details>` ancestor check (`BROWSER_IS_VISIBLE_SOURCE` / `isVisibleEl` in helpers).

- Self-test: `assertVisibilityPredicate(page)` runs once per calm session. Closed details child must be hidden; summary and open content must be visible. Fail → exit 2 refuse.
- Undetermined visibility (no `checkVisibility`) → refuse, never PASS/FAIL.
- **Guard shape (rule 6):** ask "is this ELEMENT inside a closed details?" per element. Never "does this container CONTAIN a details?"
- **NOT-MEASURED fails the gate (rule 4).** A checker that cannot find the surface it judges must not treat zero as collapsed/pass. Dead selectors (class that never matches) are failures (rule 5), not silent vacuous greens.
- Craft surface selectors must name the real product classes (`.manuscript__craft-tags`, `.manuscript__craft-tag`).

## Rail state provenance

Below 1366px the product default is companion closed (binder leads). Dual-rail measurements must name whether rails were **default** or **forced** by the harness:

`railState: { binder: 'open'|'closed', agent: 'open'|'closed', origin: { binder: 'default'|'forced', agent: 'default'|'forced' }, atDesk }`

`ensureBinderOpen` / `ensureCompanionOpen` accept `{ track }` and mark origin forced only when they actually click Show.

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
