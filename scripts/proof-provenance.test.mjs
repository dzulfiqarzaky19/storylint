/**
 * GATE A — every e2e/proofs artifact must carry provenance, or be named on
 * the explicit legacy allowlist (no globs, no fabricated SHAs).
 *
 * Required stamp fields (standing rule 1 / 8c):
 *   head, worktree_dirty, command, exit, timestamp
 *
 * Mutation posture: strip stamp names file; new unstamped file goes red.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'
import {
  formatProvenanceStamp,
  parseProvenanceStamp,
  validateProvenanceStamp,
  collectProvenance,
  writeProofArtifact,
  listProofArtifactRels,
  PROVENANCE_BEGIN,
  PROVENANCE_END,
  headResolvesToObject,
} from '../e2e/proof-provenance.mjs'
import { LEGACY_UNSTAMPED_PROOFS } from '../e2e/proofs-legacy-allowlist.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

test('GATE A: format/parse round-trip keeps all five fields', () => {
  const stamp = formatProvenanceStamp({
    head: 'a'.repeat(40),
    worktree_dirty: true,
    command: 'node e2e/example.mjs',
    exit: 1,
    timestamp: '2026-08-01T00:00:00.000Z',
  })
  assert.ok(stamp.includes(PROVENANCE_BEGIN))
  assert.ok(stamp.includes(PROVENANCE_END))
  const parsed = parseProvenanceStamp(stamp + '\nbody')
  assert.deepEqual(parsed, {
    head: 'a'.repeat(40),
    worktree_dirty: true,
    command: 'node e2e/example.mjs',
    exit: 1,
    timestamp: '2026-08-01T00:00:00.000Z',
  })
})

test('GATE A: incomplete stamp is rejected', () => {
  const missingExit = [
    PROVENANCE_BEGIN,
    'head: deadbeef',
    'worktree_dirty: false',
    'command: x',
    'timestamp: 2026-01-01T00:00:00.000Z',
    PROVENANCE_END,
  ].join('\n')
  assert.equal(parseProvenanceStamp(missingExit), null)
})

test('GATE A: writeProofArtifact stamps real HEAD and dirty bit', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gate-a-proof-'))
  try {
    const target = join(dir, 'sample.txt')
    writeProofArtifact(target, {
      root,
      body: 'PASS body\n',
      command: 'node scripts/proof-provenance.test.mjs',
      exit: 0,
      timestamp: '2026-08-01T12:00:00.000Z',
    })
    const text = readFileSync(target, 'utf8')
    const v = validateProvenanceStamp(text, { root })
    assert.equal(v.ok, true, v.reason)
    assert.equal(v.parsed.command, 'node scripts/proof-provenance.test.mjs')
    assert.equal(v.parsed.exit, 0)
    assert.equal(v.parsed.timestamp, '2026-08-01T12:00:00.000Z')
    assert.equal(headResolvesToObject(v.parsed.head, root), true)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('GATE A: every e2e/proofs artifact is stamped OR explicitly allowlisted', () => {
  const allow = new Set(LEGACY_UNSTAMPED_PROOFS)
  // Allowlist must be exact names — reject accidental globs/wildcards.
  for (const name of allow) {
    assert.equal(name.includes('*'), false, 'allowlist entry must not contain *: ' + name)
    assert.equal(name.includes('?'), false, 'allowlist entry must not contain ?: ' + name)
    assert.match(name, /^e2e\/proofs\//, 'allowlist entry must be under e2e/proofs/: ' + name)
  }

  const artifacts = listProofArtifactRels({ root })
  assert.ok(artifacts.length > 0, 'expected at least one proof artifact')

  /** @type {string[]} */
  const unstampedNew = []
  /** @type {string[]} */
  const badStamp = []

  for (const rel of artifacts) {
    const abs = resolve(root, rel)
    const text = readFileSync(abs, 'utf8')
    const parsed = parseProvenanceStamp(text)
    if (parsed) {
      const v = validateProvenanceStamp(text, { root, requireResolvableHead: true })
      if (!v.ok) badStamp.push(rel + ' (' + v.reason + ')')
      continue
    }
    if (allow.has(rel)) continue
    unstampedNew.push(rel)
  }

  assert.deepEqual(
    unstampedNew,
    [],
    'unstamped proof artifacts not on LEGACY_UNSTAMPED_PROOFS:\n  ' +
      unstampedNew.join('\n  ') +
      '\nStamp via writeProofArtifact, or add an explicit full path to the allowlist.',
  )
  assert.deepEqual(
    badStamp,
    [],
    'stamped proofs failed validation:\n  ' + badStamp.join('\n  '),
  )
})

test('GATE A MUT: strip stamp names file goes red (property actually removed)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gate-a-mut-'))
  try {
    const miniRoot = dir
    mkdirSync(join(miniRoot, 'e2e/proofs'), { recursive: true })
    const head = execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf8' }).trim()
    const good =
      formatProvenanceStamp({
        head,
        worktree_dirty: false,
        command: 'node mut',
        exit: 0,
        timestamp: '2026-08-01T00:00:00.000Z',
      }) + '\nbody\n'
    writeFileSync(join(miniRoot, 'e2e/proofs/good.txt'), good, 'utf8')
    // Mutant: strip the stamp markers and field lines from the file contents.
    const stripped = good
      .replaceAll(PROVENANCE_BEGIN, '')
      .replaceAll(PROVENANCE_END, '')
      .split('\n')
      .filter((line) => !/^\s*(head|worktree_dirty|command|exit|timestamp):\s*/i.test(line))
      .join('\n')
    writeFileSync(join(miniRoot, 'e2e/proofs/stripped.txt'), stripped, 'utf8')

    const artifacts = listProofArtifactRels({ root: miniRoot })
    assert.deepEqual(artifacts.sort(), ['e2e/proofs/good.txt', 'e2e/proofs/stripped.txt'].sort())

    const allow = new Set() // empty — no legacy escape
    const unstamped = []
    for (const rel of artifacts) {
      const text = readFileSync(resolve(miniRoot, rel), 'utf8')
      if (!parseProvenanceStamp(text) && !allow.has(rel)) unstamped.push(rel)
    }
    assert.deepEqual(unstamped, ['e2e/proofs/stripped.txt'])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('GATE A MUT: brand-new unstamped proof goes red', () => {
  const allow = new Set(LEGACY_UNSTAMPED_PROOFS)
  const fakeRel = 'e2e/proofs/__gate_a_mut_new_unstamped__.txt'
  assert.equal(allow.has(fakeRel), false)
  const text = 'I claim PASS with no provenance\n'
  assert.equal(parseProvenanceStamp(text), null)
  const isOrphan = !parseProvenanceStamp(text) && !allow.has(fakeRel)
  assert.equal(isOrphan, true)
})

test('GATE A: collectProvenance rejects missing command/exit', () => {
  assert.throws(() => collectProvenance({ exit: 0, command: '' }), /command/)
  assert.throws(() => collectProvenance({ command: 'x', exit: NaN }), /exit/)
})
