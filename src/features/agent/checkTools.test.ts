import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { CHECK_TOOLS, checkToolById } from './checkTools.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')

test('Check tools: Continuity is sole primary; Review and Craft are secondary', () => {
  assert.equal(CHECK_TOOLS.length, 3)
  assert.deepEqual(CHECK_TOOLS.map((tool) => tool.id), ['continuity', 'review', 'craft'])
  assert.equal(CHECK_TOOLS.filter((tool) => tool.primary).length, 1)
  assert.equal(checkToolById('continuity').primary, true)
  assert.equal(checkToolById('review').primary, false)
  assert.equal(checkToolById('craft').primary, false)
})

test('Check tools: copy answers what / when / after for each tool', () => {
  for (const tool of CHECK_TOOLS) {
    assert.ok(tool.actionLabel.trim().length > 0, `${tool.id} action`)
    assert.ok(tool.blurb.trim().length > 0, `${tool.id} blurb`)
    assert.ok(tool.what.includes(tool.id === 'continuity' ? 'Canon' : tool.id === 'review' ? 'Review' : 'Craft')
      || tool.what.toLowerCase().includes(tool.id), `${tool.id} what names itself`)
    assert.ok(tool.when.trim().length > 20, `${tool.id} when`)
    assert.ok(tool.outcome.trim().length > 20, `${tool.id} outcome`)
  }
})

test('Check tools: Continuity is the only gate path; Review/Craft stay panel-only', () => {
  const continuity = checkToolById('continuity')
  const review = checkToolById('review')
  const craft = checkToolById('craft')
  assert.match(continuity.outcome, /Inbox|Accept/i)
  assert.match(continuity.what, /only Continuity entry/i)
  assert.match(review.what, /not Continuity/i)
  assert.match(craft.what, /not bible contradictions|not Continuity|craft coach/i)
  assert.doesNotMatch(review.outcome, /writes Canon|auto-accept/i)
  assert.doesNotMatch(craft.outcome, /writes Canon|auto-accept/i)
  assert.match(craft.outcome, /Add/i)
})

test('AgentPanel Check face wires tool list + click info (not bare equal buttons)', () => {
  const source = readFileSync(join(root, 'components/shell/AgentPanel.tsx'), 'utf8')
  assert.match(source, /CHECK_TOOLS\.map/)
  assert.match(source, /companion__check-tools/)
  assert.match(source, /data-check-info/)
  assert.match(source, /data-check-help/)
  assert.match(source, /companion__check-help/)
  assert.match(source, /About \$\{/)
  // Bare three-button row must stay gone — equal weight was the fault.
  assert.doesNotMatch(source, /agent__cowrite-actions" aria-label="Check tools"/)
  assert.doesNotMatch(source, /opLabel\('review', 'Review'\)/)
  assert.doesNotMatch(source, /opLabel\('craft', 'Craft'\)/)
})

test('MUTATION lock: Review and Craft help must keep Continuity distinction', () => {
  const review = checkToolById('review')
  const craft = checkToolById('craft')
  // If someone renames coaching into Continuity language, users lose the gate model.
  assert.doesNotMatch(`${review.what} ${review.when} ${review.outcome}`, /marks on the page/i)
  assert.doesNotMatch(`${craft.what} ${craft.when} ${craft.outcome}`, /marks on the page/i)
  assert.match(`${review.what} ${craft.what}`, /not Continuity|craft coach|story panel/i)
})
