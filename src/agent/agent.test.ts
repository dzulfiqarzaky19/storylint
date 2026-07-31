import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Project } from '../domain/types.ts'
import { runAgent } from './run.ts'

const project: Project = {
  schemaVersion: 1,
  title: 'Storylint',
  chapters: [{ id: 'chapter-1', title: 'Opening', body: 'Aria meets Kael.', craftTags: [], revision: 0 }],
  sheets: [], proposals: [], rejectedFingerprints: [], marks: [], researchNotes: [],
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
  assert.deepEqual(project, before)
})

test('fixture generic chat returns project-aware help without a proposal', async () => {
  const result = await runAgent(project, 'chapter-1', 'What should I do next?', fixtureConfig)
  assert.equal(result.proposals.length, 0)
  assert.match(result.message, /fixture mode/i)
  assert.match(result.message, /Opening/)
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
  assert.match(result.message, /Kael/)
})
