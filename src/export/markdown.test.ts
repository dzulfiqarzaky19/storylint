import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Project } from '../domain/types.ts'
import { projectMarkdownFiles } from './markdown.ts'

const project: Project = {
  schemaVersion: 1,
  title: 'My Story',
  chapters: [{ id: 'chapter-1', title: 'Opening / Arrival', body: 'Aria arrived.', craftTags: ['setup'], revision: 2 }],
  sheets: [{
    id: 'aria', kind: 'character', name: 'Aria: Ember', aliases: ['A'], summary: 'A fighter.',
    notes: 'Private notes.', portrait: '🔥',
    facts: [{ id: 'fact-1', key: 'oath', value: 'guard', statement: 'Aria swore to guard.', claimKind: 'attribute' }],
  }],
  proposals: [], rejectedFingerprints: [], marks: [], researchNotes: [], lab: { boards: [{ id: 'lab-board-bench', title: 'Bench', cardIds: [] }], cards: [] },
}

test('markdown export produces readable sanitized chapter and sheet files', () => {
  const files = projectMarkdownFiles(project)
  assert.deepEqual(files.map((file) => file.path), [
    'README.md',
    'chapters/01-opening-arrival.md',
    'bible/character/aria-ember.md',
  ])
  assert.match(files[1].content, /# Opening \/ Arrival/)
  assert.match(files[1].content, /Tags: setup/)
  assert.match(files[2].content, /oath.*guard/)
  assert.match(files[2].content, /Aria swore to guard/)
})

test('markdown export omits pending proposals and diagnostics', () => {
  const text = projectMarkdownFiles(project).map((file) => file.content).join('\n')
  assert.doesNotMatch(text, /proposal|diagnostic/i)
})

test('empty chapter title slugs to untitled without inventing Chapter N', () => {
  const files = projectMarkdownFiles({
    ...project,
    chapters: [
      { id: 'c1', title: '', body: 'one', craftTags: [], revision: 0 },
      { id: 'c2', title: '', body: 'two', craftTags: [], revision: 0 },
      { id: 'c3', title: 'Named', body: 'three', craftTags: [], revision: 0 },
    ],
  })
  const paths = files.map((file) => file.path)
  assert.ok(paths.includes('chapters/01-untitled.md'))
  assert.ok(paths.includes('chapters/02-untitled.md'))
  assert.ok(paths.includes('chapters/03-named.md'))
  assert.equal(paths.some((path) => /chapter-\d/.test(path)), false)
})
