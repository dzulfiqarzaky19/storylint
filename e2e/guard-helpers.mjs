/**
 * Enforce e2e convention: gate/measurement scripts must use shared helpers.
 *
 *   npm run test:e2e:guard
 *   node e2e/guard-helpers.mjs
 *
 * Hard rule for gates (calm-budget, feature smokes, anything new that measures UI):
 *   - must import ./helpers.mjs
 *   - must not ship self-contained face/mode fallbacks
 *   - must not optional-load helpers
 *
 * Exploratory/manual drivers may be grandfathered in LEGACY_EXPLORATORY until ported.
 * New measurement scripts are NOT added to that list.
 *
 * Durable lesson: this suite's job is to be trusted. A flaky gate that trains
 * people to re-run until green is worse than no gate.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))

const EXEMPT = new Set([
  'helpers.mjs',
  'constants.mjs',
  'all-smoke.mjs',
  'guard-helpers.mjs',
  'owned-stack.mjs',
])

/** Manual/exploratory drivers grandfathered until ported. Do not grow this list. */
const LEGACY_EXPLORATORY = new Set([
  'ux-drive.mjs',
  'ux-drive-graph.mjs',
  'graph-audit.mjs',
  'd6-companion-shots.mjs',
  // Bear D1 rail measure — port to helpers+owned-stack after seal.
  'rail-budget.mjs',
  'binder-resting.mjs',
  // Koala B5 face touch probe - port after product fix.
  'b5-face-touch.mjs',
])

const FORBIDDEN_IN_GATES = [
  { id: 'self-contained-fallback-log', re: /helpers:\s*self-contained fallback/i },
  { id: 'optional-helpers-loader', re: /async function loadHelpers\s*\(/ },
  { id: 'local-openFace-reimpl', re: /async function openFace\s*\(/ },
  { id: 'local-gotoMode-reimpl', re: /async function gotoMode\s*\(/ },
  {
    id: 'wrong-context-panel-fallback',
    // `querySelector(ctx) || querySelector(any panel)` pattern that caused GRAPH/WRITING mixups
    re: /querySelector\(\s*[`'"]\.panel\[data-companion-context="\$\{[^}]+\}"\][`'"]\s*\)\s*\|\|\s*document\.querySelector\(\s*[`'"]\.panel\[data-companion-context\][`'"]\s*\)/,
  },
  {
    id: 'stranger-ui-default-5173',
    // Defaulting STORYLINT_UI to :5173 measures whatever ghost Vite is alive.
    re: /STORYLINT_UI\s*\|\|\s*['"`]https?:\/\/(localhost|127\.0\.0\.1):5173/,
  },
  {
    id: 'hardcoded-localhost-5173',
    re: /goto\(\s*['"`]https?:\/\/(localhost|127\.0\.0\.1):5173/,
  },
  {
    id: 'hardcoded-localhost-4174',
    re: /['"`]https?:\/\/(localhost|127\.0\.0\.1):4174\b/,
  },
  {
    // data/ is gitignored. Selecting ambient 'default' measures the machine, not the product.
    id: 'ambient-default-project',
    re: /select(?:Option|ProjectByValue|ProjectByLabel)\s*\(\s*(?:page\s*,\s*)?['"`]default['"`]/,
  },
  {
    id: 'ambient-data-project-json',
    re: /data\/project\.json|data\\project\.json/,
  },
  {
    // networkidle is safe on FIRST goto, dangerous on RELOAD after mount
    // (companion/LLM sockets never idle → 30s latent timeout). Use reloadApp.
    id: 'reload-networkidle',
    re: /\.reload\s*\(\s*\{[^}]*waitUntil\s*:\s*['"`]networkidle['"`]/,
  },
]

function listScripts(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) {
      if (name === 'output' || name === 'node_modules') continue
      listScripts(full, out)
      continue
    }
    if (!name.endsWith('.mjs')) continue
    out.push(full)
  }
  return out
}

function importsHelpers(source) {
  return /from\s+['"](\.\/|\.\.\/(?:e2e\/)?)?helpers\.mjs['"]/.test(source)
    || /import\s*\(\s*['"][^'"]*helpers\.mjs['"]\s*\)/.test(source)
}

function isGateScript(base, source) {
  if (base === 'calm-budget.mjs') return true
  if (/^slice-.*-smoke\.mjs$/.test(base)) return true
  if (base.endsWith('-smoke.mjs')) return true
  // New measurement-looking scripts that are not grandfathered exploratory tools.
  if (LEGACY_EXPLORATORY.has(base)) return false
  if (/measure[A-Z(]/.test(source) && /getBoundingClientRect/.test(source)) return true
  if (/data-companion-context/.test(source) && /productFaceCount|foldOwner|calm/i.test(source)) return true
  return false
}

const failures = []
const notes = []
const scripts = listScripts(root)

for (const full of scripts) {
  const name = relative(root, full).replace(/\\/g, '/')
  const base = name.split('/').pop()
  if (EXEMPT.has(base)) continue

  const source = readFileSync(full, 'utf8')
  const gate = isGateScript(base, source)
  const hasHelpers = importsHelpers(source)

  if (LEGACY_EXPLORATORY.has(base)) {
    notes.push(`legacy-exploratory  ${name}${hasHelpers ? ' (helpers ok)' : ' (not yet on helpers)'}`)
    continue
  }

  if (!gate) continue

  if (!hasHelpers) {
    failures.push(`${name}: gate/measurement script must import ./helpers.mjs`)
  }
  for (const rule of FORBIDDEN_IN_GATES) {
    if (rule.re.test(source)) {
      failures.push(`${name}: forbidden pattern ${rule.id}`)
    }
  }
  notes.push(`gate-ok  ${name}`)
}

console.log(`e2e helper guard: scanned ${scripts.length} scripts`)
for (const note of notes) console.log(note)
if (failures.length) {
  console.error('\nFAIL: e2e helper convention violations:')
  for (const fail of failures) console.error(` - ${fail}`)
  console.error('\nRule: UI gates measure only through e2e/helpers.mjs.')
  console.error('Precondition before measure. No self-contained face/mode fallbacks.')
  console.error('See e2e/README.md.')
  process.exit(1)
}
console.log('PASS: e2e helper convention holds')
