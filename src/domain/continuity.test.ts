import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { acceptProposal, rejectProposal } from './proposals.ts'
import { lintClaims } from './lint.ts'
import { patchChapter } from './project.ts'
import type { Claim, Project, Proposal } from './types.ts'

const FIXTURE_URL = new URL('../../docs/fixtures/continuity-sample.md', import.meta.url)

function fixtureProject(): Project {
  return {
    schemaVersion: 1,
    title: 'Continuity Fixture',
    chapters: [
      {
        id: 'chapter-1',
        title: 'Chapter One',
        body: 'Aria looked up, her blue eyes wide. Kael drew his sword beside her.',
      },
    ],
    sheets: [
      {
        id: 'aria',
        kind: 'character',
        name: 'Aria',
        aliases: [],
        summary: '',
        notes: '',
        facts: [
          {
            id: 'aria-eye-color',
            key: 'eye_color',
            value: 'amber',
            statement: 'eye color: amber',
            claimKind: 'attribute',
          },
        ],
      },
    ],
    proposals: [],
    rejectedFingerprints: [],
    marks: [],
  }
}

const conflictClaim: Claim = {
  entityName: 'Aria',
  sheetKind: 'character',
  key: 'eye_color',
  value: 'blue',
  statement: 'eye color: blue',
  claimKind: 'attribute',
  confidence: 0.98,
  span: { chapterId: 'chapter-1', start: 20, end: 29, text: 'blue eyes' },
}

const unknownClaim: Claim = {
  entityName: 'Kael',
  sheetKind: 'character',
  key: 'wields',
  value: 'sword',
  statement: 'Kael wields a sword',
  claimKind: 'attribute',
  confidence: 0.91,
  span: { chapterId: 'chapter-1', start: 36, end: 57, text: 'Kael drew his sword' },
}

test('tests are grounded in the continuity sample fixture', async () => {
  const fixture = await readFile(FIXTURE_URL, 'utf8')
  assert.match(fixture, /eye_color` = `amber/)
  assert.match(fixture, /blue eyes/)
  assert.match(fixture, /Kael drew his sword/)
})

test('hard conflict emits a red mark', () => {
  const result = lintClaims(fixtureProject(), [conflictClaim])
  assert.equal(result.marks.length, 1)
  assert.equal(result.marks[0].severity, 'red')
  assert.equal(result.marks[0].span.text, 'blue eyes')
  assert.equal(result.proposals.length, 0)
})

test('unknown high-confidence claim creates a proposal', () => {
  const result = lintClaims(fixtureProject(), [unknownClaim])
  assert.equal(result.marks.length, 0)
  assert.equal(result.proposals.length, 1)
  assert.equal(result.proposals[0].entityName, 'Kael')
  assert.equal(result.proposals[0].status, 'pending')
})

test('unknown low-confidence claim is dropped', () => {
  const result = lintClaims(fixtureProject(), [{ ...unknownClaim, confidence: 0.69 }])
  assert.deepEqual(result, { marks: [], proposals: [] })
})

test('accept writes the proposed fact and marks the proposal accepted', () => {
  const initial = fixtureProject()
  const proposal = lintClaims(initial, [unknownClaim]).proposals[0]
  const withProposal = { ...initial, proposals: [proposal] }
  const accepted = acceptProposal(withProposal, proposal.id)

  const kael = accepted.sheets.find((sheet) => sheet.name === 'Kael')
  assert.ok(kael)
  assert.equal(kael.facts.length, 1)
  assert.equal(kael.facts[0].statement, 'Kael wields a sword')
  assert.equal(accepted.proposals[0].status, 'accepted')
  assert.deepEqual(initial.sheets, fixtureProject().sheets, 'input remains immutable')
})

test('reject does not write a fact and records the fingerprint', () => {
  const initial = fixtureProject()
  const proposal = lintClaims(initial, [unknownClaim]).proposals[0]
  const rejected = rejectProposal({ ...initial, proposals: [proposal] }, proposal.id)

  assert.equal(rejected.sheets.some((sheet) => sheet.name === 'Kael'), false)
  assert.equal(rejected.proposals[0].status, 'rejected')
  assert.deepEqual(rejected.rejectedFingerprints, [proposal.fingerprint])
})

test('re-lint does not duplicate a pending fingerprint', () => {
  const initial = fixtureProject()
  const proposal = lintClaims(initial, [unknownClaim]).proposals[0]
  const result = lintClaims({ ...initial, proposals: [proposal] }, [unknownClaim, unknownClaim])

  assert.deepEqual(result.proposals, [])
})

test('accepting a proposal pack writes all facts to one sheet atomically', () => {
  const initial = fixtureProject()
  const source = { chapterId: 'chapter-1', start: 0, end: 4, text: 'Kael' }
  const proposals = [
    {
      id: 'pack-name', fingerprint: 'pack-name', packId: 'pack-kael', status: 'pending',
      entityName: 'Kael', sheetKind: 'character', key: 'role', value: 'deuteragonist',
      statement: 'Kael is the deuteragonist', claimKind: 'attribute', confidence: 1, source,
    },
    {
      id: 'pack-goal', fingerprint: 'pack-goal', packId: 'pack-kael', status: 'pending',
      entityName: 'Kael', sheetKind: 'character', key: 'goal', value: 'protect Aria',
      statement: 'Kael wants to protect Aria', claimKind: 'attribute', confidence: 1, source,
    },
  ] satisfies Proposal[]
  const accepted = acceptProposal({ ...initial, proposals }, proposals[0].id)
  const kael = accepted.sheets.find((sheet) => sheet.name === 'Kael')
  assert.ok(kael)
  assert.deepEqual(kael.facts.map((fact) => fact.key), ['role', 'goal'])
  assert.equal(accepted.proposals.every((proposal) => proposal.status === 'accepted'), true)
})

test('accept replaces an existing fact with the same key instead of forking canon', () => {
  const initial = fixtureProject()
  const proposal = {
    id: 'new-eye', fingerprint: 'new-eye', status: 'pending', entityName: 'Aria',
    sheetKind: 'character', targetSheetId: 'aria', key: 'eye_color', value: 'gold',
    statement: 'eye color: gold', claimKind: 'attribute', confidence: 1,
    source: { chapterId: 'chapter-1', start: 0, end: 4, text: 'Aria' },
  } satisfies Proposal
  const accepted = acceptProposal({ ...initial, proposals: [proposal] }, proposal.id)
  const facts = accepted.sheets.find((sheet) => sheet.id === 'aria')?.facts ?? []
  assert.equal(facts.filter((fact) => fact.key === 'eye_color').length, 1)
  assert.equal(facts[0].value, 'gold')
})

test('editing chapter body clears stale anchored marks', () => {
  const initial = fixtureProject()
  const mark = lintClaims(initial, [conflictClaim]).marks[0]
  const changed = patchChapter({ ...initial, marks: [mark] }, 'chapter-1', { body: 'Rewritten.' })
  assert.deepEqual(changed.marks, [])
})
