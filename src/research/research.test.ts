import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Project } from '../domain/types.ts'
import { runResearch, researchProposal } from './run.ts'

const project: Project = {
  schemaVersion: 1,
  title: 'Research fixture',
  chapters: [{ id: 'chapter-1', title: 'Opening', body: '', craftTags: [], revision: 0 }],
<<<<<<< HEAD
  sheets: [], proposals: [], rejectedFingerprints: [], marks: [], researchNotes: [],
=======
  sheets: [], proposals: [], rejectedFingerprints: [], marks: [], researchNotes: [], lab: { boards: [{ id: 'lab-board-bench', title: 'Bench', cardIds: [] }], cards: [] },
>>>>>>> storylint/lab-slice
}
const fixture = { provider: '', model: '', baseUrl: '', apiKey: '', maxTokens: 20000, fixture: false }

test('fixture research returns cited results without project mutation', async () => {
  const before = structuredClone(project)
  const result = await runResearch(project, 'medieval archive access customs', fixture)
  assert.equal(result.mode, 'fixture')
  assert.ok(result.results.length > 0)
  assert.equal(result.results.every((item) => item.sources.length > 0), true)
  assert.deepEqual(project, before)
})

test('research result becomes a pending lore proposal, never canon', () => {
  const result = {
    id: 'research-1', title: 'Archive access', summary: 'Access was controlled.',
    sources: [{ title: 'Example source', url: 'https://example.invalid/archive' }],
  }
  const proposal = researchProposal(result)
  assert.equal(proposal.status, 'pending')
  assert.equal(proposal.sheetKind, 'lore')
  assert.equal(project.sheets.length, 0)
})

test('configured live research uses injected neutral adapter and validates citations', async () => {
  let calls = 0
  const result = await runResearch(
    project,
    'archives',
    { ...fixture, model: 'router-model', baseUrl: 'http://router/v1' },
    async () => {
      calls += 1
      return { results: [{
        title: 'Archive practice', summary: 'A cited practice.',
        sources: [{ title: 'Source', url: 'https://example.invalid/source' }],
      }] }
    },
  )
  assert.equal(calls, 1)
  assert.equal(result.results[0].sources[0].title, 'Source')
})

test('research rejects uncited model results', async () => {
  await assert.rejects(
    runResearch(
      project,
      'archives',
      { ...fixture, model: 'router-model', baseUrl: 'http://router/v1' },
      async () => ({ results: [{ title: 'Uncited', summary: 'No source.', sources: [] }] }),
    ),
    /source/,
  )
})
