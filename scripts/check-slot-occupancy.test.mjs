/**
 * Standing 8c enforcement: every check that CAN FAIL must be reachable.
 *
 * A file under e2e/ or scripts/ that can exit non-zero makes a pass/fail claim.
 * Such a claim is only meaningful if something runs it. So each can-fail file
 * must be EITHER:
 *   - named in a runner (package.json scripts, e2e/constants.mjs, all-smoke.mjs,
 *     land.mjs/land-gate.mjs, or matched by the scripts/ test glob), OR
 *   - explicitly headed MANUAL DIAGNOSTIC, declaring it is run by hand.
 *
 * Why this is a test and not a doc: the class regrows silently. tigress found
 * e2e/prove-step-stall.mjs red for weeks while cited as evidence (E1-1), and a
 * hand sweep still misclassified e2e/binder-resting.mjs as unable to fail.
 * Prose cannot catch that; a glob can.
 *
 * NOTE: passing here does NOT mean a check is good. It means the check is
 * reachable and honestly labelled. Whether its assertions can actually fail is
 * a separate duty, proven by mutation.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Header-anchored so the token cannot hide mid-file or inside a string. */
export const MANUAL_DIAGNOSTIC_RE = /^[\s\S]{0,400}?\bMANUAL DIAGNOSTIC\b/

/** A non-zero exit path: explicit exit, non-zero exitCode, or a top-level throw. */
const FAIL_PATTERNS = [
  /process\.exit\(\s*(?!0\s*\))[^)]*\)/,
  /process\.exitCode\s*=\s*(?!0\b)/,
  /^\s*throw\s+/m,
]

const RUNNER_FILES = [
  'package.json',
  'e2e/constants.mjs',
  'e2e/all-smoke.mjs',
  'e2e/land.mjs',
  'e2e/land-gate.mjs',
  'scripts/land.mjs',
]

function listCandidates() {
  const out = []
  for (const dir of ['e2e', 'scripts']) {
    const abs = resolve(root, dir)
    if (!existsSync(abs)) continue
    for (const name of readdirSync(abs)) {
      if (!/\.(mjs|js|cjs)$/.test(name)) continue
      if (/\.test\.(mjs|js|cjs)$/.test(name)) continue // glob already runs these
      out.push({ name, rel: `${dir}/${name}`, abs: resolve(abs, name) })
    }
  }
  return out
}

function canFail(src) {
  return FAIL_PATTERNS.some((re) => re.test(src))
}

function runnerCorpus() {
  return RUNNER_FILES.filter((f) => existsSync(resolve(root, f)))
    .map((f) => readFileSync(resolve(root, f), 'utf8'))
    .join('\n')
}

/** Imported by another repo file => library, invoked through its importer. */
function importedBySomeone(name, files) {
  const needle = new RegExp(`from\\s+['"][^'"]*${name.replace('.', '\\.')}['"]`)
  return files.some((f) => f.name !== name && needle.test(readFileSync(f.abs, 'utf8')))
}

test('8c: every can-fail check is either wired to a runner or marked MANUAL DIAGNOSTIC', () => {
  const files = listCandidates()
  const corpus = runnerCorpus()
  const orphans = []

  for (const f of files) {
    const src = readFileSync(f.abs, 'utf8')
    if (!canFail(src)) continue
    if (importedBySomeone(f.name, files)) continue
    if (corpus.includes(f.name)) continue
    if (MANUAL_DIAGNOSTIC_RE.test(src)) continue
    orphans.push(f.rel)
  }

  assert.deepEqual(
    orphans,
    [],
    `can-fail checks that no runner names and that claim no MANUAL DIAGNOSTIC header:\n  ${orphans.join('\n  ')}\n` +
      'Wire it into a runner, or head the file MANUAL DIAGNOSTIC to declare it is run by hand.',
  )
})

test('8c: the MANUAL DIAGNOSTIC token must appear in the file header, not buried', () => {
  const buried = '// x\n'.repeat(300) + 'MANUAL DIAGNOSTIC\n'
  assert.equal(MANUAL_DIAGNOSTIC_RE.test(buried), false)
  assert.match('/** T-004 MANUAL DIAGNOSTIC — durable dirty */\n', MANUAL_DIAGNOSTIC_RE)
})

test('8c: failure detection recognises exit, exitCode and top-level throw', () => {
  assert.equal(canFail('process.exit(1)'), true)
  assert.equal(canFail('process.exit(failed ? 1 : 0)'), true)
  assert.equal(canFail('process.exitCode = 1'), true)
  assert.equal(canFail('throw new Error("x")'), true)
  assert.equal(canFail('process.exit(0)'), false)
  assert.equal(canFail('console.log("screenshot only")'), false)
})
