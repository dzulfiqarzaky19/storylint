import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { runContinuity } from './run.ts'
import { parseClaims } from './live.ts'
import type { Project, Proposal } from '../domain/types.ts'

const fixture = await readFile(new URL('../../docs/fixtures/continuity-sample.md', import.meta.url), 'utf8')

function project(): Project {
  return {
    schemaVersion: 1,
    title: 'Fixture',
    chapters: [{
      id: 'chapter-1',
      title: 'Chapter One',
      body: 'Aria looked up, her blue eyes wide. Kael drew his sword beside her.',
      craftTags: [],
      revision: 0,
    }],
    sheets: [{
      id: 'aria', kind: 'character', name: 'Aria', aliases: [], summary: '', notes: '',
      facts: [{ id: 'eye', key: 'eye_color', value: 'amber', statement: 'eye color: amber', claimKind: 'attribute' }],
    }],
    proposals: [],
    rejectedFingerprints: [],
    marks: [],
    researchNotes: [],
  }
}

test('no key selects fixture extraction and yields the documented red mark and proposal', async () => {
  assert.match(fixture, /Aria eye_color blue/)
  const result = await runContinuity(project(), 'chapter-1', { live: { provider: '', model: '', baseUrl: '', apiKey: '', maxTokens: 4096, fixture: false }, fixture: false })

  assert.equal(result.mode, 'fixture')
  assert.equal(result.project.marks.some((mark) => mark.severity === 'red' && mark.span.text === 'blue eyes'), true)
  assert.equal(result.project.proposals.some((proposal) => proposal.status === 'pending' && proposal.entityName === 'Kael'), true)
})

test('STORYLINT_FIXTURE_LLM forces fixture extraction even when a key exists', async () => {
  let liveCalls = 0
  const result = await runContinuity(project(), 'chapter-1', {
    live: { provider: 'test', model: 'test-model', baseUrl: 'http://test/v1', apiKey: 'test-key', maxTokens: 4096, fixture: true },
    fixture: true,
    liveExtractor: async () => {
      liveCalls += 1
      return []
    },
  })

  assert.equal(result.mode, 'fixture')
  assert.equal(liveCalls, 0)
})

test('a no-key fixture run does not mutate the input project', async () => {
  const input = project()
  const before = structuredClone(input)
  await runContinuity(input, 'chapter-1', { live: { provider: '', model: '', baseUrl: '', apiKey: '', maxTokens: 4096, fixture: false }, fixture: false })
  assert.deepEqual(input, before)
})

test('successful rerun replaces stale pending proposals from that chapter', async () => {
  const first = await runContinuity(project(), 'chapter-1', { live: { provider: '', model: '', baseUrl: '', apiKey: '', maxTokens: 4096, fixture: false }, fixture: false })
  const withoutKael = {
    ...first.project,
    chapters: first.project.chapters.map((chapter) => ({ ...chapter, body: 'Aria looked up, her blue eyes wide.' })),
  }
  const rerun = await runContinuity(withoutKael, 'chapter-1', { live: { provider: '', model: '', baseUrl: '', apiKey: '', maxTokens: 4096, fixture: false }, fixture: false })
  assert.equal(rerun.project.proposals.some((proposal) => proposal.status === 'pending'), false)
})

test('continuity rerun preserves pending sheet-assistance packs', async () => {
  const input = project()
  const packProposal: Proposal = {
    id: 'pack-role', fingerprint: 'pack-role', packId: 'pack-1', status: 'pending',
    entityName: 'Kael', sheetKind: 'character', key: 'role', value: 'ally',
    statement: 'Kael is an ally', claimKind: 'attribute', confidence: 1,
    source: { chapterId: 'chapter-1', start: 0, end: 0, text: '' },
  }
  const result = await runContinuity(
    { ...input, proposals: [packProposal] },
    'chapter-1',
    { live: { provider: '', model: '', baseUrl: '', apiKey: '', maxTokens: 4096, fixture: false }, fixture: false },
  )
  assert.equal(result.project.proposals.some((proposal) => proposal.id === packProposal.id), true)
})

test('local-model claim kind aliases normalize to the frozen domain enum', () => {
  const base = {
    entityName: 'Aria', sheetKind: 'character', key: 'eye_color', value: 'blue',
    statement: 'eye color: blue', confidence: 0.9, spanText: 'blue eyes',
  }
  const claims = parseClaims({ claims: [
    { ...base, claimKind: 'fact' },
    { ...base, key: 'met', claimKind: 'EVENT' },
    { ...base, key: 'father', claimKind: 'relation' },
    { ...base, key: 'exists', claimKind: 'entity' },
  ] })
  assert.deepEqual(claims.map((claim) => claim.claimKind), [
    'attribute', 'event', 'relationship', 'existence',
  ])
})

test('unknown claim kinds still fail at the trust boundary', () => {
  assert.throws(() => parseClaims({ claims: [{
    entityName: 'Aria', sheetKind: 'character', key: 'x', value: 'y', statement: 'x y',
    claimKind: 'theme', confidence: 0.9, spanText: 'Aria',
  }] }), /Invalid claim claimKind/)
})

test('a live extractor is selected only when key exists and fixture mode is off', async () => {
  let liveCalls = 0
  const result = await runContinuity(project(), 'chapter-1', {
    live: { provider: 'test', model: 'test-model', baseUrl: 'http://test/v1', apiKey: 'test-key', maxTokens: 4096, fixture: false },
    fixture: false,
    liveExtractor: async () => {
      liveCalls += 1
      return []
    },
  })
  assert.equal(result.mode, 'live')
  assert.equal(liveCalls, 1)
})
