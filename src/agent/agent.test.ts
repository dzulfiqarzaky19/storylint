import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Project } from '../domain/types.ts'
import { runAgent } from './run.ts'

const project: Project = {
  schemaVersion: 1,
  title: 'Storylint',
  chapters: [{ id: 'chapter-1', title: 'Opening', body: 'Aria meets Kael.', craftTags: [], revision: 0 }],
  sheets: [], proposals: [], rejectedFingerprints: [], marks: [], researchNotes: [],
  lab: { boards: [{ id: 'lab-board-bench', title: 'Bench', cardIds: [] }], cards: [] },
}

const fixtureConfig = {
  provider: '', model: '', baseUrl: '', apiKey: '', maxTokens: 20000, fixture: false,
}

test('fixture sheet request returns structured pending proposal pack without mutating project', async () => {
  const before = structuredClone(project)
  const result = await runAgent(project, 'chapter-1', 'Draft a character sheet for Kael', fixtureConfig)
  assert.equal(result.mode, 'fixture')
  assert.match(result.message, /proposal/i)
  assert.ok(result.proposals.length >= 2)
  assert.equal(new Set(result.proposals.map((proposal) => proposal.packId)).size, 1)
  assert.equal(result.proposals.every((proposal) => proposal.status === 'pending'), true)
  assert.equal(result.labCards.length, 0)
  assert.deepEqual(project, before)
})

test('fixture generic chat returns project-aware help without a proposal', async () => {
  const result = await runAgent(project, 'chapter-1', 'What should I do next?', fixtureConfig)
  assert.equal(result.proposals.length, 0)
  assert.equal(result.labCards.length, 0)
  assert.match(result.message, /fixture mode/i)
  assert.match(result.message, /Opening/)
})

test('fixture Lab brainstorm returns pre-canon cards without proposals', async () => {
  const before = structuredClone(project)
  const result = await runAgent(project, 'chapter-1', 'Brainstorm 3 places for the Lab', fixtureConfig)
  assert.equal(result.mode, 'fixture')
  assert.equal(result.proposals.length, 0)
  assert.equal(result.labCards.length, 3)
  assert.equal(result.labCards.every((card) => card.kind === 'place'), true)
  assert.match(result.message, /Lab bench/i)
  assert.deepEqual(project, before)
})

test('fixture character spark lands one Lab card only', async () => {
  const result = await runAgent(project, 'chapter-1', 'Spark a character for the Lab', fixtureConfig)
  assert.equal(result.labCards.length, 1)
  assert.equal(result.labCards[0].kind, 'character-spark')
  assert.equal(result.proposals.length, 0)
})

test('fixture sheet request still wins over lab-ish wording', async () => {
  const result = await runAgent(project, 'chapter-1', 'Draft a character sheet for Kael on the lab', fixtureConfig)
  assert.ok(result.proposals.length >= 2)
  assert.equal(result.labCards.length, 0)
})

test('configured live adapter is selected for sheet asks', async () => {
  let calls = 0
  const result = await runAgent(
    project,
    'chapter-1',
    'Draft an organization sheet for the Ember Order',
    { ...fixtureConfig, model: 'router-model', baseUrl: 'http://router/v1' },
    async () => {
      calls += 1
      return {
        message: 'I prepared the order.',
        sheetPack: {
          name: 'Ember Order', kind: 'organization', summary: 'An old order.',
          facts: [{ key: 'purpose', value: 'guard the ember', statement: 'The order guards the ember' }],
        },
      }
    },
  )
  assert.equal(result.mode, 'live')
  assert.equal(calls, 1)
  assert.equal(result.proposals[0].sheetKind, 'organization')
  assert.equal(result.labCards.length, 0)
})

test('live freeform chat uses completion without requiring sheet pack', async () => {
  let calls = 0
  const result = await runAgent(
    project,
    'chapter-1',
    'Is Kael consistent so far?',
    { ...fixtureConfig, model: 'router-model', baseUrl: 'http://router/v1' },
    async () => {
      calls += 1
      return { message: 'Kael has only one beat so far — keep his voice dry.', sheetPack: null }
    },
  )
  assert.equal(result.mode, 'live')
  assert.equal(calls, 1)
  assert.equal(result.proposals.length, 0)
  assert.equal(result.labCards.length, 0)
  assert.match(result.message, /Kael/)
})

test('live Lab brainstorm adapter can return labCards', async () => {
  let calls = 0
  const result = await runAgent(
    project,
    'chapter-1',
    'Brainstorm places @lab',
    { ...fixtureConfig, model: 'router-model', baseUrl: 'http://router/v1' },
    async () => {
      calls += 1
      return {
        message: 'Three places on the bench.',
        sheetPack: null,
        labCards: [
          { kind: 'place', title: 'North wall', body: 'Where scouts watch.' },
        ],
      }
    },
  )
  assert.equal(result.mode, 'live')
  assert.equal(calls, 1)
  assert.equal(result.labCards.length, 1)
  assert.equal(result.proposals.length, 0)
})
