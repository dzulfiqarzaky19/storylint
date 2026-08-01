# e2e suite

Deterministic browser smokes and gates for Storylint.

## Commands

| Command | Purpose |
|---------|---------|
| `npm run test:e2e` | Feature smokes (`e2e/all-smoke.mjs`) |
| `npm run calm` | CALM_BUDGET geometry/face checker (writes **untracked** `e2e/output/calm-budget-last.md`) |
| `npm run calm:record` | Same checker; updates **tracked** scoreboard `e2e/output/calm-budget-run.md` |
| `npm run test:e2e:guard` | Convention guard: measurement scripts must use helpers |
| `npm run test:green` | **ONE green:** guard + build + unit + owned smokes + calm |
| `npm run test:l2` | **L2 composition:** guard + same-project Draft→Canon→Lab journey (not renamed all-smoke) |

## Provenance (what did we measure?)

> **A check that is measuring something OTHER than what it claims is not evidence.**

Three rules, one root failure (see also `docs/decisions/rule-visibility-not-geometry.md` rules 1–6):

1. **Name the commit and bundle.** If a check cannot state what it examined and at what commit, its output is not evidence.
2. **Never infer visibility from geometry.** Use `Element.checkVisibility` + closed-`<details>` ancestry (`isVisibleEl`). Self-test both directions. **NOT-MEASURED** (surface absent / dead selector / undetermined) is a first-class **failing** verdict — never PASS on absence (rules 4–6).
3. **Assert on behaviour and state, never on a label you do not own.** Applies to **locators**, not only assertions. Chrome copy moves (D5 Back, `Back, editing {title}`, bible→Canon). Prefer stable hooks (`[data-binder-back]`, `[data-binder-stack="list"]`) over `getByRole(..., { name: 'Back' })`. Half-following the rule — wait for list after click, but still find the button by name — is how AU broke slice-f/i/k.


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

## Nine ways verification lied (seal lesson)

1. **No server ownership** — calm/smokes measured stranger Vite on :5173 across worktrees.
2. **Fixture contamination** — shared doors/default projects under concurrent agents.
3. **Closed `<details>` visibility** — rect-based counts treated collapsed content as painted.
4. **Smokes excluded from "green"** — agents reported unit `npm test` as merge-ready while e2e was red.
5. **Smokes unattributed** — same :5173 hole as calm.
6. **Surface absent counted as pass** - craft chips length 0 treated as collapsed (NOT-MEASURED now fails).
7. **Owned UI + stranger API** - UI on ephemeral ports, hard-coded :4174 reading a different database. Provenance must cover every origin a test talks to. Use `requireApiOrigin()` / `setApiBase`; never hardcode :4174.
8. **Nondeterministic check (misdiagnosed twice)** - same commit looked PASS/FAIL across worktrees for slice-j. First diagnosis (rat): race on selectOption. Retracted. Second diagnosis (rat, from pig's seed remark): ambient gitignored `data/` so `default` was missing in bare trees. **Disproved by negative control:** server `http.ts` always synthesises `activeProjectId='default'` and lists `default` first — wiping `data/` does not remove the option. Root cause of the cross-worktree failures is **not established**. The smoke still depended on a project it did not create, which is wrong regardless. Fix: create every project via `ensureIsolatedProject`; never `selectOption('default')`. Proven 5/5 bare with honest open question on mechanism. A fix can be correct while its stated cause is wrong; shipping a confident wrong cause stops the next person looking (scar: rat, twice in one hour — correlation → mechanism without reading the code that settles it).
9. **Smoke depended on an entity it did not create** - the verified property under lie 8. Not "gitignored data" until someone proves that mechanism. Guard symptom bans (`selectOption('default')`, `data/project.json`) are narrower than the invariant (only touch entities minted this run) — do not mistake the guard for a proof of the invariant.
10. **Locator by unowned copy** - `closeSheetDetail` waited for list state (good) but found Back via `getByRole(..., { name: 'Back', exact: true })` (bad). AU set `aria-label="Back, editing {title}"` which overrides accessible name; slice-f/i/k hung. Rule 3 applies to **locators**. Fix: `[data-binder-back]` hook + list wait.

11. **Smoke inherits a sibling's active container** — slice-k/l had zero `ensureIsolatedProject` calls after a commit titled "isolate projects" opened both files and only hardened selectors (hawk/rat). After slice-j they ran inside Harbor Draft; when first, they seeded Mira/Kael into shared `default` via `PUT /api/sheets` (server resolves ambient `activeProjectId`). Lie-9 banned the string `data/project.json`; they never typed it. **Guard checks spelling; the invariant is reachability.** Fix: mint before write; end on that mint; `all-smoke` **runtime** asserts post-smoke active ∈ minted set (missing mint = FAIL not skip). Suite bookend restores `active-project`; sweeps orphan harness `e2e-*.json`. Fresh stack ≠ fresh container.

Fail closed. A measurement that cannot name what it measured is not evidence.

## Tracked path side effect (scoreboard)

> **A tool must not write to a tracked path as a side effect of running.**

If it does, every run dirties the tree. That blocks `git checkout`, and worse: a failed detach can leave the worktree on a stale commit while the checker reports numbers that look current (crab: nearly reported 114/115 against the wrong head).

| Role | Path | When |
|------|------|------|
| Run artifact (default) | `e2e/output/calm-budget-last.md` (+ `.json`) | every `npm run calm` / `test:green` |
| Scoreboard baseline | `e2e/output/calm-budget-run.md` | only `npm run calm:record` / `calm -- --record` |

Default stays ignored under `e2e/output/`. The scoreboard exception in `.gitignore` is for deliberate baseline commits, not per-run output. Same split as tracked judgments vs untracked evidence dumps.

Always verify the head you **measured** (`git rev-parse HEAD` after the run, provenance in the artifact), never only the head you asked for.

## Pass-on-absence (rule 4, structural)

> A check whose only FAIL path is `count >= N` **passes at count 0**.

That is bear's B4-craft-phone defect and B3-inbox-wall@volume reproduced after the rule was known. Memory is not a mechanism.

Three outcomes must stay distinguishable:

| Outcome | API | Verdict |
|---------|-----|---------|
| Thing absent and should be | `found(0)` / `found({ absent: true })` | predicate PASS |
| Thing present within budget | `found(value)` | predicate PASS/FAIL |
| Could not find what we judge | `notFound(reason)` | **NOT-MEASURED** HARD |

Use `judgeMeasured(id, sev, doc, surface, measurement, { pass, measured, threshold })`. It refuses a verdict on `notFound` — the next author cannot write pass-on-absence without bypassing the helper.

Intentional emptiness is still **found** (we found the empty surface). `notFound` means the checker cannot name what it measured.

Calm summary prints the third outcome explicitly (crab/rat):

```text
HARD fails: 0 · NOT-MEASURED: 0 · checks: 50
```

If NOT-MEASURED is nonzero, the run names those check ids. Fingerprint tokens include outcome kind (`P`/`F`/`W`/`N`/`X`) so PASS→NOT-MEASURED always moves the hash — a green that silently stopped measuring must not look identical.

## Navigation waits (networkidle trap)

> **`networkidle` is SAFE on FIRST navigation and DANGEROUS on RELOAD.**

On initial `goto`, nothing has connected yet, so idle is reachable.
After the app mounts and the companion opens sockets (owned stacks, fixture LLM routes, live LLM), idle is **never** reached. Playwright waits the full ~30s timeout, then continues. That is a latent flake under load — slice-j paid 63s for one `ensureDraftReady` reload before the cause was named.

| Do | Don't |
|----|-------|
| `page.goto(UI, { waitUntil: 'domcontentloaded' })` then wait for a state landmark | `page.reload({ waitUntil: 'networkidle' })` after mount |
| `reloadApp(page)` / `reloadApp(page, { ready: '…' })` | Treat network idle as a proxy for "app ready" |
| Wait for the **state you need** (select option, Draft editor, binder list) | Fixed sleeps or idle timeouts |

Enforced by `guard-helpers` rule `reload-networkidle`. Same disease shape as unowned :5173, rect-based visibility, and label locators: a shared-infrastructure trap wearing a single-test costume.

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
| `found(value)` / `notFound(reason)` | Measurement result — never PASS on absence |
| `asMeasurement(raw)` / `requireFound(m, onNF)` | Wrap legacy missing flags; refuse verdict on notFound |
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

## L2 composition

Isolation green is not composition green.

| `npm run test:green` / all-smoke | `npm run test:l2` |
|--|--|
| L1 change-level | Story/composition on integrated tip |
| Each smoke mints its own project | **One** project shared across Draft, Canon, Lab |
| Proves features alone | Proves body + sheet + active survive multi-surface use |

Command: `npm run test:l2` → `e2e/guard-helpers.mjs` + `e2e/l2-composition.mjs`.
Owned stack + provenance + fail-closed (same as test:green). Artifacts: `e2e/output/l2-composition-last.md`.
Do not grow L2 by re-listing isolated smokes. Add checks only when they require a shared container.

**Named claim only.** L2 load-bearing mutations prove two directions on the shared project: Canon sheet PUT cannot blank Draft bodies; Draft chapter PUT cannot wipe/rename Canon sheets. Lab is walked for container stickiness, not for a Lab-clobber mutation. Inbox/graph are out of scope. Do not quote `test:l2` as general multi-surface composition-safe.
## Feature smokes

Listed in `constants.mjs` → `ALL_FEATURE_SMOKES`, run by `all-smoke.mjs` with per-smoke hard timeouts and a green/red summary.


## Runtime isolation (active container)

After every smoke in `ALL_FEATURE_SMOKES`: server `activeProjectId` **must** be a non-`default` id **this smoke minted this run**. Missing mint = FAIL. `default` = FAIL. Sibling id = FAIL. Observed via `STORYLINT_ISOLATION_REPORT` from `ensureIsolatedProject` — discarding the return still registers. Suite bookend: active after equals active before; orphan harness projects swept.

## Diagnostic capture

Do **not** filter the output of a run you might need to diagnose (`findstr`/`grep` pipelines that drop Playwright timeout bodies). Capture whole, filter when reading. Step labels on k/l come from shared `e2e/step-label.mjs` (`makeStep`). Three layers: (1) **structural** — `prove-step-stall.mjs` imports the same `makeStep` and proves `[slice-k +Nms] STALL-INJECT` survives a real Playwright timeout (artifact: `e2e/proofs/E1-step-stall-proof.txt`); (2) **runtime call-site** — each smoke records `step.calls` and `assertStepPhases` against `e2e/step-phases.mjs` at PASS (skipping a `step()` call fails the smoke); (3) **source tripwire** — `scripts/e1-step-label.test.mjs` catches dropped imports / reintroduced local `step` (not proof of wiring).

### Cause lines on full `test:green` (T-006)

When a land/baseline death leaves **output but no cause** (no stack, no FINGERPRINT, exit 1), re-run under:

```bash
node scripts/capture-test-green-cause.mjs
node scripts/capture-test-green-cause.mjs --n 3 --label b2-full-chain
```

Mirrors land `runCapture` spawn shape (piped stdio, Windows `npm.cmd` shell line) **without** merge/push. Appends `[cause] spawn|exit|close` with pid, code, signal, exit-vs-close order, and elapsed ms into the log under `_land_run/`. Open ticket: [T-006](../docs/tickets/T-006.md). Does not replace `scripts/land.mjs` instrumentation (separate path).

## Nav waitUntil

Never `waitUntil: 'networkidle'` on owned stacks. Companion/LLM sockets keep the network busy and burn Playwright's ~30s default. Use `domcontentloaded` + a real readiness locator.
