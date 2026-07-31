# UI / e2e testing (for agents)

**Agents can and should drive the real UI** when a slice changes shell, manuscript, agent panel, Continuity, Apply, Focus, or save status — not only `npm test` / `npm run build`.

## Stack on this machine

| Piece | Value |
|-------|--------|
| CLI | global `playwright` (`D:\npm-global\playwright.cmd`, v1.57+) |
| Browser | **System Edge or Chrome** via Playwright `channel` — **not** bundled Chromium download unless human OK |
| This PC | **Chrome path missing** → use **`channel: 'msedge'`** first |
| App URL | `http://localhost:5173/` (Vite; may not bind 127.0.0.1) |
| API | `http://127.0.0.1:4174` proxied as `/api` |
| Fixture Continuity | `STORYLINT_FIXTURE_LLM=1` on **server** process |
| Visual check | Day/Sepia/Mint/Night paper; chrome light/dark; no sky-blue; **&lt;1366** full-bleed + circle seal; **≥1366** desk page + ribbon; meta under title |

Portable skill (if installed): user skill **`playwright-ui`** — same rules.

## When to run UI e2e

| Role | When |
|------|------|
<<<<<<< HEAD
| **Coder** | After UI-facing slice work (shell, Apply, Continuity chrome, Focus); before claiming done |
| **Verifier** | Any slice that touches UI; include screenshot path in report |
| **Skip** | Pure domain-only change with zero UI files |

Unit tests still required for domain/API. E2e **adds** browser proof; it does not replace gates tests.
=======
| **Coder** | After UI-facing slice work; before claiming done — run the slice smoke |
| **UX** | Phased: `node e2e/ux-drive.mjs` then `node e2e/ux-drive-graph.mjs` ([UX_PASS.md](./UX_PASS.md)). Progress files on disk. **Read ≤4 PNGs/session**. Graph = Network+Family, empty+full, all sheet kinds. Write `e2e/output/ux-report.md` |
| **Verifier** | **Default required.** Boot app + Playwright until flows **behave** as expected; screenshots in report. Only skip if diff is pure domain/API with **zero** UI/CSS/shell files |
| **Catch-up review debt** | Verifier (or fix cycle) runs **all** `e2e/slice-*-smoke.mjs` after blockers land |

Unit tests still required for domain/API. Playwright **proves the product path**; it does not replace gates tests.

### Verifier checklist (working-as-expected)

Assert, don’t just open the URL:

1. Shell loads: Manuscript main, binder, agent panel  
2. Type chapter → **Saved**  
3. Focus toggles rails; reading control is **on paper** (seal/ribbon), cycles day/sepia/mint/night  
4. Continuity (fixture) → marks and/or proposals; **no** auto-accept into bible  
5. If Apply shipped: co-write card → body changes **only** after Apply  
6. Multi-project: create/switch restores correct chapter body  
7. Export / graph / research: use the matching `e2e/slice-*-smoke.mjs` if that surface is in scope  
8. No sky-blue accent; no gen chips inside manuscript column  

Existing scripts: `e2e/slice-e-smoke.mjs` … `e2e/slice-k-smoke.mjs` (run with `node e2e/slice-X-smoke.mjs` while servers are up).

**Full product gate:** `npm run test:e2e` → `e2e/all-smoke.mjs` runs `ALL_FEATURE_SMOKES` from [`e2e/constants.mjs`](../e2e/constants.mjs) in order. Shared ~2k-word manuscript body: `NOVEL_CHAPTER` (used by G review/craft).
>>>>>>> storylint/lab-slice

## Boot (two processes)

```bash
cd d:/dev/projects/storylint
# A — API (fixture for deterministic Continuity)
STORYLINT_FIXTURE_LLM=1 npm run dev:server
# B — Vite
npm run dev
```

Wait until `curl -s -o NUL -w "%{http_code}" http://localhost:5173/` is `200` and `/api/project` via proxy works.

## Minimal smoke (library, system Edge)

```bash
cd d:/dev/projects/storylint
mkdir -p e2e/output
```

```js
// run with: node --input-type=module path/to/smoke.mjs
// resolve global playwright if not in package.json:
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';

const require = createRequire('D:/npm-global/node_modules/playwright/package.json');
const pwRoot = dirname(require.resolve('playwright/package.json'));
const { chromium } = await import(pathToFileURL(resolve(pwRoot, 'index.mjs')).href);

mkdirSync('e2e/output', { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.getByRole('main', { name: 'Manuscript' }).waitFor();
// Focus; Continuity; Saved; reading control is .manuscript__bookmark on paper (not top bar)
await page.getByRole('button', { name: /focus mode/i }).click();
await page.locator('.manuscript__bookmark').click(); // cycles paper
await page.screenshot({ path: 'e2e/output/smoke.png', fullPage: true });
await browser.close();
```

Also: under 1366 seal is circle inside page; ≥1366 ribbon on right edge; no #6EA8FE.

## Stable selectors

| UI | Locator |
|----|---------|
| Manuscript | `getByRole('main', { name: 'Manuscript' })` |
| Chapter title | `getByLabel('Chapter title')` |
| Body | `locator('textarea').first()` |
| Continuity | `getByRole('button', { name: /^Continuity$|^Running/i })` |
| Focus | `getByRole('button', { name: /focus mode/i })` |
| Shell focus attr | `.shell` → `data-focus` |
| Saved | `getByText('Saved')` |
| Binder / Agent toggles | `getByRole('button', { name: /binder|agent panel/i })` |

## Screenshot contract

- Write under **`e2e/output/`** (gitignore recommended; do not commit PNGs unless asked)
- Verifier/coder report: path to PNG + pass/fail bullets
- Human or parent agent can `Read` the PNG

## Do not

- `playwright install chromium` unless user explicitly allows  
- Assume `channel: 'chrome'` works on this box (try **msedge** first)  
- Hit non-localhost  
- Replace domain unit tests with only e2e  
