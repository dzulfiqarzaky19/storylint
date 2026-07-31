import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Project } from '../domain/types.ts'
import { runCowrite } from './run.ts'

const project: Project = {
  schemaVersion: 1, title: 'Storylint',
  chapters: [{ id: 'ch-1', title: 'Opening', body: 'Aria opened the door. Kael waited outside.', craftTags: [], revision: 0 }],
  sheets: [{ id: 'aria', kind: 'character', name: 'Aria', aliases: [], summary: '', notes: '', facts: [] }],
  proposals: [], rejectedFingerprints: [], marks: [], researchNotes: [], lab: { boards: [{ id: 'lab-board-bench', title: 'Bench', cardIds: [] }], cards: [] },
}
const fixture = { provider: '', model: '', baseUrl: '', apiKey: '', maxTokens: 20000, fixture: false }

test('fixture continue returns an insert card and never changes manuscript or Canon', async () => {
  const before = structuredClone(project)
  const result = await runCowrite(project, {
    chapterId: 'ch-1', skill: 'continue', instruction: 'Continue with tension', start: 21, end: 21,
  }, fixture)
  assert.equal(result.mode, 'fixture')
  assert.equal(result.card.target.mode, 'insert')
  assert.equal(result.card.target.start, 21)
  assert.ok(result.card.text.length > 0)
  assert.deepEqual(project, before)
})

test('fixture rewrite targets the exact selected range', async () => {
  const result = await runCowrite(project, {
    chapterId: 'ch-1', skill: 'rewrite', instruction: 'Make this sharper', start: 5, end: 21,
  }, fixture)
  assert.deepEqual(result.card.target, { mode: 'replace', start: 5, end: 21 })
})

test('rewrite requires a non-empty selection', async () => {
  await assert.rejects(
    runCowrite(project, {
      chapterId: 'ch-1', skill: 'rewrite', instruction: 'Rewrite', start: 5, end: 5,
    }, fixture),
    /selection/,
  )
})

test('configured live co-write uses injected neutral adapter once', async () => {
  let calls = 0
  const result = await runCowrite(project, {
    chapterId: 'ch-1', skill: 'brainstorm', instruction: 'Give me a turn', start: 21, end: 21,
  }, { ...fixture, model: 'router-model', baseUrl: 'http://router/v1' }, async () => {
    calls += 1
    return { text: 'A storm cuts the lights.' }
  })
  assert.equal(calls, 1)
  assert.equal(result.mode, 'live')
  assert.equal(result.card.text, 'A storm cuts the lights.')
})
