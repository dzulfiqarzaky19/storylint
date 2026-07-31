import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chapterListLabel } from './chapterListLabel.ts'

test('chapterListLabel uses stored titles as-is', () => {
  const chapters = [{ title: 'Opening' }, { title: '  Mid  ' }]
  assert.equal(chapterListLabel(chapters, 0), 'Opening')
  assert.equal(chapterListLabel(chapters, 1), 'Mid')
})

test('chapterListLabel numbers only among empty titles (interleaved)', () => {
  // Counter is among-empty, not among-all — ['', 'Named', ''] → Untitled / Named / Untitled 2
  const chapters = [{ title: '' }, { title: 'Named' }, { title: '   ' }, { title: '' }]
  assert.equal(chapterListLabel(chapters, 0), 'Untitled')
  assert.equal(chapterListLabel(chapters, 1), 'Named')
  assert.equal(chapterListLabel(chapters, 2), 'Untitled 2')
  assert.equal(chapterListLabel(chapters, 3), 'Untitled 3')
})

test('chapterListLabel does not invent Chapter N', () => {
  const chapters = [{ title: '' }, { title: '' }]
  assert.equal(chapterListLabel(chapters, 0), 'Untitled')
  assert.equal(chapterListLabel(chapters, 1), 'Untitled 2')
  assert.notEqual(chapterListLabel(chapters, 1), 'Chapter 2')
})
