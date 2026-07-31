import assert from 'node:assert/strict'
import { test } from 'node:test'
import { acceptProposal } from './proposals.ts'
import {
  archiveLabCard,
  createLabCard,
  emptyLab,
  ensureLab,
  labBodies,
  pinLabCard,
  promoteLabCard,
  restoreLabCard,
} from './lab.ts'
import type { Project } from './types.ts'

function seed(): Project {
  return {
    schemaVersion: 2,
    title: 'Storylint',
    chapters: [{ id: 'chapter-1', title: 'Chapter One', body: 'Aria looked up.', craftTags: [], revision: 0 }],
    sheets: [],
    proposals: [],
    rejectedFingerprints: [],
    marks: [],
    researchNotes: [],
    lab: emptyLab(),
  }
}

test('new lab defaults to Bench board with zero cards', () => {
  const lab = emptyLab()
  assert.equal(lab.boards.length, 1)
  assert.equal(lab.boards[0].title, 'Bench')
  assert.deepEqual(lab.cards, [])
})

test('ensureLab fills missing lab without dropping project fields', () => {
  const bare = { ...seed(), lab: undefined as unknown as Project['lab'], schemaVersion: 1 as const }
  const next = ensureLab(bare as Project)
  assert.equal(next.lab.boards[0].title, 'Bench')
  assert.equal(next.chapters[0].id, 'chapter-1')
})

test('create edit archive and pin lab cards', () => {
  let project = createLabCard(seed(), {
    kind: 'character-spark',
    title: 'Riven',
    body: 'A rival with a glass knife',
  })
  assert.equal(project.lab.cards.length, 1)
  assert.equal(project.lab.boards[0].cardIds[0], project.lab.cards[0].id)

  const id = project.lab.cards[0].id
  project = pinLabCard(project, id, true)
  assert.equal(project.lab.cards[0].status, 'pinned')

  project = archiveLabCard(project, id)
  assert.equal(project.lab.cards[0].status, 'archived')
  assert.equal(project.lab.cards.length, 1)
})

test('archive is a state with Restore back to active — no hard delete', () => {
  let project = createLabCard(seed(), {
    kind: 'character-spark',
    title: 'Riven',
    body: 'A rival with a glass knife',
  })
  const id = project.lab.cards[0].id
  project = archiveLabCard(project, id)
  assert.equal(project.lab.cards[0].status, 'archived')
  assert.equal(project.lab.cards.length, 1)

  project = restoreLabCard(project, id)
  assert.equal(project.lab.cards[0].status, 'active')
  assert.equal(project.lab.cards[0].title, 'Riven')
  assert.equal(project.lab.cards.length, 1)

  // Restore is Lab-only: no chapters/sheets/proposals invented.
  assert.equal(project.chapters.length, 1)
  assert.equal(project.sheets.length, 0)
  assert.equal(project.proposals.length, 0)
})

test('restore rejects non-archived cards', () => {
  const project = createLabCard(seed(), { kind: 'lore-spark', title: 'Keep' })
  assert.throws(() => restoreLabCard(project, project.lab.cards[0].id), /Only archived/i)
})

test('promote character-spark creates pending proposals only — no sheet facts', () => {
  let project = createLabCard(seed(), {
    kind: 'character-spark',
    title: 'Riven',
    body: 'Glass knife, soft voice',
  })
  const cardId = project.lab.cards[0].id
  const result = promoteLabCard(project, cardId)
  project = result.project

  assert.equal(result.as, 'sheet-proposal')
  assert.ok((result.proposalIds?.length ?? 0) >= 1)
  assert.equal(project.sheets.length, 0)
  assert.equal(project.proposals.every((proposal) => proposal.status === 'pending'), true)
  assert.equal(project.lab.cards[0].status, 'promoted')
  assert.equal(project.lab.cards[0].promoted?.as, 'sheet-proposal')

  // Accept still required for bible write
  const accepted = acceptProposal(project, project.proposals[0].id)
  assert.equal(accepted.sheets.length, 1)
  assert.equal(accepted.sheets[0].name, 'Riven')
  assert.ok(accepted.sheets[0].facts.length >= 1)
})

test('promote beat creates chapter stub without body prose from lab', () => {
  let project = createLabCard(seed(), {
    kind: 'beat',
    title: 'Siege night',
    body: 'Do not paste this into the manuscript automatically',
  })
  const result = promoteLabCard(project, project.lab.cards[0].id)
  project = result.project
  assert.equal(result.as, 'chapter-stub')
  const chapter = project.chapters.find((candidate) => candidate.id === result.chapterId)
  assert.ok(chapter)
  assert.equal(chapter.title, 'Siege night')
  assert.equal(chapter.body, '')
  assert.equal(project.sheets.length, 0)
})

test('promote beat with blank chapterTitle stores empty — never invents Untitled chapter', () => {
  let project = createLabCard(seed(), {
    kind: 'beat',
    title: 'Card working title',
    body: 'Author left the promote chapter title blank on purpose',
  })
  const result = promoteLabCard(project, project.lab.cards[0].id, { chapterTitle: '   ' })
  project = result.project
  const chapter = project.chapters.find((candidate) => candidate.id === result.chapterId)
  assert.ok(chapter)
  assert.equal(chapter.title, '')
  assert.notEqual(chapter.title, 'Untitled chapter')
  assert.notEqual(chapter.title, 'Untitled')
  assert.equal(chapter.body, '')
})
test('what-if cannot promote to sheet or chapter', () => {
  const project = createLabCard(seed(), { kind: 'what-if', title: 'Treaty fails' })
  assert.throws(
    () => promoteLabCard(project, project.lab.cards[0].id),
    /no promote path/i,
  )
  assert.equal(project.sheets.length, 0)
  assert.equal(project.chapters.length, 1)
})

test('lab bodies helper exposes card text for ignore checks', () => {
  const project = createLabCard(seed(), {
    kind: 'lore-spark',
    title: 'False bible',
    body: 'This must never become continuity input by accident',
  })
  const bodies = labBodies(project)
  assert.equal(bodies.some((body) => body.includes('False bible')), true)
  assert.equal(bodies.some((body) => body.includes('never become continuity')), true)
})
