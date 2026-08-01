import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

/**
 * Feature-ticket validation (FEATURE_PIPELINE.md, founder 2026-08-01).
 *
 * The rule that matters: a ticket belonging to feature-NN must land INTO
 * feature-NN. A feature ticket pointing at dev would skip the feature's
 * end-to-end gate, which is the only reason the integration branch exists.
 *
 * Every test drives the real CLI against a fixture directory, so a rule that
 * silently stops being reachable (e.g. the loader glob not matching feature
 * files) fails here instead of passing quietly.
 */

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..')
const checker = join(here, 'ticket-check.mjs')

function frontmatter(fields) {
  const base = {
    title: 'a ticket',
    priority: 'P1',
    status: 'open',
    story: 'none',
    owner: 'unassigned',
    branch: '—',
    origin_dev_at_open: 'abc1234',
    acceptance: 'something observable',
    shortest_repro: 'steps',
    l1_proof: '—',
    l2_required: 'no',
    blocks: '[]',
    blocked_by: '[]',
    files: '[]',
    decision: '—',
    notes: 'fixture',
  }
  const all = { ...base, ...fields }
  const lines = Object.entries(all).map(([k, v]) => `${k}: ${v}`)
  return `---\n${lines.join('\n')}\n---\n\n## Context\n\nfixture\n`
}

/** Write fixture tickets to a temp dir and run the checker against it. */
function checkWith(files) {
  const dir = mkdtempSync(join(tmpdir(), 'tickets-'))
  try {
    for (const [name, body] of Object.entries(files)) {
      writeFileSync(join(dir, name), body)
    }
    const res = spawnSync(process.execPath, [checker], {
      cwd: repoRoot,
      encoding: 'utf8',
      timeout: 30_000,
      // absolute: temp dir may be on another drive than the repo (Windows)
      env: { ...process.env, TICKETS_DIR: dir },
    })
    return { status: res.status, out: `${res.stdout ?? ''}${res.stderr ?? ''}` }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test('a well-formed feature ticket validates', () => {
  const { status, out } = checkWith({
    'lab-lifecycle-ticket-01.md': frontmatter({
      id: 'lab-lifecycle-ticket-01',
      branch: 'lab-lifecycle-ticket-01',
      feature: 'lab-lifecycle',
      lands_into: 'lab-lifecycle',
    }),
  })
  assert.equal(status, 0, `expected clean exit, got:\n${out}`)
})

test('feature tickets are actually LOADED, not silently skipped', () => {
  // Guards the loader glob. If feature-*.md stops matching, every rule below
  // becomes dead code that passes by never running.
  const { out } = checkWith({
    'lab-lifecycle-ticket-01.md': frontmatter({
      id: 'lab-lifecycle-ticket-01',
      branch: 'lab-lifecycle-ticket-01',
      feature: 'lab-lifecycle',
      lands_into: 'lab-lifecycle',
    }),
  })
  assert.match(out, /1 file\(s\)/, 'checker must report the feature ticket as loaded')
})

test('a feature ticket that lands into dev is REJECTED', () => {
  // The load-bearing rule: landing a ticket on dev skips the feature E2E gate.
  const { status, out } = checkWith({
    'lab-lifecycle-ticket-01.md': frontmatter({
      id: 'lab-lifecycle-ticket-01',
      branch: 'lab-lifecycle-ticket-01',
      feature: 'lab-lifecycle',
      lands_into: 'dev',
    }),
  })
  assert.notEqual(status, 0, `expected failure, got:\n${out}`)
  assert.match(out, /lands_into/)
})

test('a feature ticket landing into the WRONG feature is rejected', () => {
  const { status, out } = checkWith({
    'lab-lifecycle-ticket-01.md': frontmatter({
      id: 'lab-lifecycle-ticket-01',
      branch: 'lab-lifecycle-ticket-01',
      feature: 'lab-lifecycle',
      lands_into: 'canon-map',
    }),
  })
  assert.notEqual(status, 0)
  assert.match(out, /must be lab-lifecycle/)
})

test('a feature field disagreeing with the id is rejected', () => {
  const { status, out } = checkWith({
    'lab-lifecycle-ticket-01.md': frontmatter({
      id: 'lab-lifecycle-ticket-01',
      branch: 'lab-lifecycle-ticket-01',
      feature: 'other-feature',
      lands_into: 'lab-lifecycle',
    }),
  })
  assert.notEqual(status, 0)
  assert.match(out, /disagrees with id/)
})

test('a branch that is not the ticket id is rejected', () => {
  const { status, out } = checkWith({
    'lab-lifecycle-ticket-01.md': frontmatter({
      id: 'lab-lifecycle-ticket-01',
      branch: 'storylint/something-else',
      feature: 'lab-lifecycle',
      lands_into: 'lab-lifecycle',
    }),
  })
  assert.notEqual(status, 0)
  assert.match(out, /should be the ticket id/)
})

test('a fix ticket is a valid feature ticket', () => {
  // Fix tickets re-enter the pipeline and must validate like any other.
  const { status, out } = checkWith({
    'lab-lifecycle-ticket-01-fix-01.md': frontmatter({
      id: 'lab-lifecycle-ticket-01-fix-01',
      branch: 'lab-lifecycle-ticket-01-fix-01',
      feature: 'lab-lifecycle',
      lands_into: 'lab-lifecycle',
    }),
  })
  assert.equal(status, 0, `expected clean exit, got:\n${out}`)
})

test('a garbage id is still rejected', () => {
  const { status, out } = checkWith({
    'T-777.md': frontmatter({ id: 'nonsense-id' }),
  })
  assert.notEqual(status, 0)
  assert.match(out, /invalid id/)
})

test('legacy T-### tickets still validate unchanged', () => {
  // The pipeline adds a family; it must not break the existing one.
  const { status, out } = checkWith({
    'T-123.md': frontmatter({ id: 'T-123' }),
  })
  assert.equal(status, 0, `expected clean exit, got:\n${out}`)
})
