import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Project } from '../domain/types.ts'
import { runReview } from './run.ts'

const project: Project = {
  schemaVersion: 1,
  title: 'Review fixture',
  chapters: [{
    id: 'chapter-1', title: 'Opening',
    body: 'Aria enters the sealed archive but meets no resistance and leaves unchanged.',
    craftTags: ['plot-progress'],
    revision: 0,
  }],
  sheets: [], proposals: [], rejectedFingerprints: [], marks: [], researchNotes: [], lab: { boards: [{ id: 'lab-board-bench', title: 'Bench', cardIds: [] }], cards: [] },
}
const fixture = { provider: '', model: '', baseUrl: '', apiKey: '', maxTokens: 20000, fixture: false }

test('fixture review returns neutral findings and tag suggestions without changing project', async () => {
  const before = structuredClone(project)
  const result = await runReview(project, 'chapter-1', 'review', fixture)
  assert.equal(result.mode, 'fixture')
  assert.ok(result.findings.some((finding) => finding.lens === 'plot'))
  assert.ok(result.findings.some((finding) => finding.lens === 'gap'))
  assert.ok(result.suggestedTags.includes('char-dev'))
  assert.deepEqual(project, before)
})

test('fixture craft check is on-demand and does not emit continuity marks', async () => {
  const result = await runReview(project, 'chapter-1', 'craft', fixture)
  assert.equal(result.kind, 'craft')
  assert.equal(result.findings.every((finding) => finding.lens === 'craft'), true)
  assert.deepEqual(project.marks, [])
})

test('configured live review uses injected neutral adapter', async () => {
  let calls = 0
  const result = await runReview(
    project,
    'chapter-1',
    'review',
    { ...fixture, model: 'router-model', baseUrl: 'http://router/v1' },
    async () => {
      calls += 1
      return {
        findings: [{ lens: 'culture', title: 'Custom', detail: 'Clarify the archive custom.' }],
        suggestedTags: ['world-build'],
      }
    },
  )
  assert.equal(calls, 1)
  assert.equal(result.findings[0].lens, 'culture')
})
