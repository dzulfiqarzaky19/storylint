/**
 * GATE B — prove each mutant-validity leg independently rejects.
 *
 * Exit taxonomy locked here:
 *   MUTANT_INVALID (code) / MutantInvalidError / process exit 2 at CLI edge
 *   test failure remains node:test fail (exit 1 at harness)
 *
 * Four required legs:
 *   1. BUILD_FAILED
 *   2. ANCHOR_NOT_FOUND
 *   3. PROPERTY_NOT_REMOVED (partial replace / multi-occurrence)
 *   4. SUITE_RAN_ZERO_TESTS / SUITE_COUNTS_UNPARSED
 *
 * Happy path: apply a real multi-occurrence strip, property gone, restore.
 * THE HAPPY-PATH TEST IS WHAT MAKES SELF-VOUCHING SAFE. The four reject tests
 * catch a helper that stops throwing. They do NOT catch a helper that throws
 * MutantInvalidError for EVERYTHING — that mutant passes all reject cases and
 * is killed only by the happy path, where a valid mutant must be allowed through.
 * Trimming "redundant" happy-path coverage would silently remove the only guard
 * against a gate that rejects everything (looks like maximum safety; is blindness).
 *
 * Self-reference: every leg test CALLS applyMutant/withMutant from the helper.
 * Fixture inputs are hand-built (temp files, partial replace, missing anchor,
 * fake build). The helper is not reimplemented here — a second hand-rolled
 * ANCHOR_NOT_FOUND check would be the isolated-copy shape this file exists
 * to prevent. Confidence is "public API throws the right reason", not a
 * private twin of the legs.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  MUTANT_INVALID_EXIT,
  MutantInvalidError,
  applyMutant,
  restoreMutant,
  withMutant,
  countProperty,
  findAnchor,
  parseSuiteCounts,
  assertSuiteRan,
  runBuild,
} from './mutant-validity.mjs'

function tempFile(name, body) {
  const dir = mkdtempSync(join(tmpdir(), 'gate-b-'))
  const path = join(dir, name)
  writeFileSync(path, body)
  return { dir, path }
}

function clean(dir) {
  rmSync(dir, { recursive: true, force: true })
}

function throwsInvalid(fn, reason) {
  assert.throws(fn, (err) => {
    assert.ok(err instanceof MutantInvalidError, `expected MutantInvalidError, got ${err?.name}`)
    assert.equal(err.code, 'MUTANT_INVALID')
    assert.equal(err.reason, reason)
    return true
  })
}

// --- unit primitives -------------------------------------------------------

test('GATE-B: MUTANT_INVALID_EXIT is 2 (distinct from test-fail 1)', () => {
  assert.equal(MUTANT_INVALID_EXIT, 2)
})

test('GATE-B: countProperty counts all string occurrences (leg-3 multi-site)', () => {
  const src = 'TOKEN alpha TOKEN beta TOKEN'
  assert.equal(countProperty(src, 'TOKEN'), 3)
  assert.equal(countProperty(src, /TOKEN/g), 3)
  assert.equal(countProperty('none', 'TOKEN'), 0)
})

test('GATE-B: findAnchor prefers content line match', () => {
  const src = 'a\nconst STEP_T0 = 1\nb\n'
  const hit = findAnchor(src, 'STEP_T0')
  assert.equal(hit.index, 1)
  assert.equal(hit.lineNo, 2)
  assert.ok(hit.line.includes('STEP_T0'))
  const miss = findAnchor(src, 'NOPE')
  assert.equal(miss.index, -1)
})

test('GATE-B: parseSuiteCounts reads node:test summary lines', () => {
  const out = [
    '✔ one',
    'ℹ tests 19',
    'ℹ pass 19',
    'ℹ fail 0',
  ].join('\n')
  assert.deepEqual(parseSuiteCounts(out), { tests: 19, pass: 19, fail: 0 })
  assert.deepEqual(parseSuiteCounts('# tests 3\n# pass 2\n# fail 1\n'), {
    tests: 3,
    pass: 2,
    fail: 1,
  })
  assert.equal(parseSuiteCounts('no summary').tests, null)
})

// --- leg 2: anchor found ---------------------------------------------------

test('GATE-B leg2: missing anchor → MUTANT_INVALID ANCHOR_NOT_FOUND (no write)', () => {
  const { dir, path } = tempFile(
    'target.mjs',
    `export const KEEP = 1\nexport const OTHER = 2\n`,
  )
  try {
    const before = readFileSync(path, 'utf8')
    throwsInvalid(
      () =>
        applyMutant({
          path,
          anchor: 'DOES_NOT_EXIST_ANCHOR',
          mutate: ({ src }) => src.replace('KEEP', 'GONE'),
          property: 'KEEP',
          log: false,
        }),
      'ANCHOR_NOT_FOUND',
    )
    assert.equal(readFileSync(path, 'utf8'), before, 'must not write on invalid mutant')
  } finally {
    clean(dir)
  }
})

// --- leg 3: property gone --------------------------------------------------

test('GATE-B leg3: partial replace leaves property → PROPERTY_NOT_REMOVED', () => {
  // Same shape as hawk MANUAL DIAGNOSTIC ×2 and falcon two-marker fixture.
  const { dir, path } = tempFile(
    'double.mjs',
    `// MANUAL DIAGNOSTIC once\nexport const x = 1\n// MANUAL DIAGNOSTIC twice\n`,
  )
  try {
    const before = readFileSync(path, 'utf8')
    assert.equal(countProperty(before, 'MANUAL DIAGNOSTIC'), 2)
    throwsInvalid(
      () =>
        applyMutant({
          path,
          anchor: 'MANUAL DIAGNOSTIC',
          // Only strips the FIRST occurrence — looks applied, property remains.
          mutate: ({ src }) => src.replace('MANUAL DIAGNOSTIC', 'MUTATED'),
          property: 'MANUAL DIAGNOSTIC',
          expectedRemaining: 0,
          log: false,
        }),
      'PROPERTY_NOT_REMOVED',
    )
    assert.equal(readFileSync(path, 'utf8'), before, 'must not write on invalid mutant')
  } finally {
    clean(dir)
  }
})

test('GATE-B leg3: expectedRemovals mismatch → PROPERTY_NOT_REMOVED', () => {
  const { dir, path } = tempFile('multi.mjs', `AA BB AA\n`)
  try {
    throwsInvalid(
      () =>
        applyMutant({
          path,
          anchor: 'AA',
          mutate: ({ src }) => src.replace('AA', 'XX'), // removes 1 of 2
          property: 'AA',
          expectedRemovals: 2, // claim both gone — false
          log: false,
        }),
      'PROPERTY_NOT_REMOVED',
    )
  } finally {
    clean(dir)
  }
})

// --- leg 1: build ----------------------------------------------------------

test('GATE-B leg1: build failure → BUILD_FAILED (no write)', () => {
  const { dir, path } = tempFile('built.mjs', `export const LIVE = true\n`)
  try {
    const before = readFileSync(path, 'utf8')
    throwsInvalid(
      () =>
        applyMutant({
          path,
          anchor: 'LIVE',
          mutate: ({ src }) => src.replace('LIVE', 'DEAD'),
          property: 'LIVE',
          build: () => ({ ok: false, exit: 1, output: 'tsc exploded' }),
          log: false,
        }),
      'BUILD_FAILED',
    )
    assert.equal(readFileSync(path, 'utf8'), before)
  } finally {
    clean(dir)
  }
})

test('GATE-B leg1: build ok allows mutation to proceed', () => {
  const { dir, path } = tempFile('built-ok.mjs', `export const LIVE = true\n`)
  try {
    const info = applyMutant({
      path,
      anchor: 'LIVE',
      mutate: ({ src }) => src.replace(/LIVE/g, 'DEAD'),
      property: 'LIVE',
      build: () => ({ ok: true, exit: 0, output: '' }),
      log: false,
    })
    assert.equal(info.removed, 1)
    assert.equal(countProperty(readFileSync(path, 'utf8'), 'LIVE'), 0)
    restoreMutant(path, info.before)
  } finally {
    clean(dir)
  }
})

// --- leg 4: suite observed -------------------------------------------------

test('GATE-B leg4: assertSuiteRan rejects missing counts', () => {
  throwsInvalid(() => assertSuiteRan('no counts here'), 'SUITE_COUNTS_UNPARSED')
})

test('GATE-B leg4: assertSuiteRan rejects zero tests', () => {
  throwsInvalid(
    () => assertSuiteRan('ℹ tests 0\nℹ pass 0\nℹ fail 0\n'),
    'SUITE_RAN_ZERO_TESTS',
  )
})

test('GATE-B leg4: assertSuiteRan accepts nonzero run', () => {
  const c = assertSuiteRan('ℹ tests 4\nℹ pass 4\nℹ fail 0\n')
  assert.equal(c.tests, 4)
  assert.equal(c.pass, 4)
})

// --- happy path ------------------------------------------------------------

test('GATE-B happy: strip all tokens, property verified gone, withMutant restores', () => {
  const { dir, path } = tempFile(
    'happy.mjs',
    `// MANUAL DIAGNOSTIC once\nexport const x = 1\n// MANUAL DIAGNOSTIC twice\n`,
  )
  try {
    const before = readFileSync(path, 'utf8')
    const result = withMutant(
      {
        path,
        anchor: 'MANUAL DIAGNOSTIC',
        mutate: ({ src }) => src.replaceAll('MANUAL DIAGNOSTIC', 'MUTATED'),
        property: 'MANUAL DIAGNOSTIC',
        expectedRemovals: 2,
        log: false,
      },
      (info) => {
        assert.equal(info.removed, 2)
        assert.equal(countProperty(readFileSync(path, 'utf8'), 'MANUAL DIAGNOSTIC'), 0)
        return 'ok'
      },
    )
    assert.equal(result, 'ok')
    assert.equal(readFileSync(path, 'utf8'), before, 'withMutant must restore')
  } finally {
    clean(dir)
  }
})

test('GATE-B happy: MUTATION_NO_OP when mutate returns identical source', () => {
  const { dir, path } = tempFile('noop.mjs', `export const X = 1\n`)
  try {
    throwsInvalid(
      () =>
        applyMutant({
          path,
          anchor: 'export const X',
          mutate: ({ src }) => src,
          property: 'X',
          expectedRemaining: 1, // would pass property check if we got there
          log: false,
        }),
      'MUTATION_NO_OP',
    )
  } finally {
    clean(dir)
  }
})

// runBuild is a thin spawn wrapper — smoke that it returns a shape (may fail
// off-network / cold worktree; we only lock the return contract here).
test('GATE-B: runBuild returns { ok, exit, output } shape', () => {
  const r = runBuild({
    command: process.execPath,
    args: ['-e', 'process.exit(0)'],
  })
  assert.equal(typeof r.ok, 'boolean')
  assert.equal(typeof r.exit, 'number')
  assert.equal(typeof r.output, 'string')
  assert.equal(r.ok, true)
  assert.equal(r.exit, 0)
})
