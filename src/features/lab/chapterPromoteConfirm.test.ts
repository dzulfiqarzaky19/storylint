import assert from 'node:assert/strict'
import { test } from 'node:test'
import { needsChapterPromoteConfirm } from './chapterPromoteConfirm.ts'

test('author beat does NOT need chapter promote confirm', () => {
  // Load-bearing: same control, two meanings — author-owned title is already consent.
  assert.equal(
    needsChapterPromoteConfirm({ kind: 'beat', source: 'author' }),
    false,
  )
})

test('model beat DOES need chapter promote confirm', () => {
  assert.equal(
    needsChapterPromoteConfirm({ kind: 'beat', source: 'model' }),
    true,
  )
})

test('model card flipped to author by edit promotes without confirm', () => {
  // Flip consequence: gate must read source, not merely store it.
  assert.equal(
    needsChapterPromoteConfirm({ kind: 'beat', source: 'author' }),
    false,
  )
})

test('sheet sparks never need chapter confirm (Accept is the gate)', () => {
  for (const kind of ['character-spark', 'place', 'lore-spark'] as const) {
    assert.equal(needsChapterPromoteConfirm({ kind, source: 'model' }), false)
    assert.equal(needsChapterPromoteConfirm({ kind, source: 'author' }), false)
  }
})
