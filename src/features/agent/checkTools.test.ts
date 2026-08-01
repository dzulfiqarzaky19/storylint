import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { CHECK_PRIMARY, CHECK_SECONDARY, CHECK_TOOLS, checkToolById } from './checkTools.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')

test('Check tools: Continuity is sole primary; Review and Craft are secondary', () => {
  assert.equal(CHECK_TOOLS.length, 3)
  assert.deepEqual(CHECK_TOOLS.map((tool) => tool.id), ['continuity', 'review', 'craft'])
  assert.equal(CHECK_TOOLS.filter((tool) => tool.primary).length, 1)
  assert.equal(CHECK_PRIMARY.id, 'continuity')
  assert.deepEqual(CHECK_SECONDARY.map((t) => t.id), ['review', 'craft'])
  assert.equal(checkToolById('review').primary, false)
  assert.equal(checkToolById('craft').primary, false)
})

test('Check tools: copy answers what / when / after without always-on blurbs', () => {
  for (const tool of CHECK_TOOLS) {
    assert.ok(tool.actionLabel.trim().length > 0, `${tool.id} action`)
    assert.equal('blurb' in tool, false, `${tool.id} must not ship resting blurb`)
    assert.ok(tool.what.trim().length > 12, `${tool.id} what`)
    assert.ok(tool.when.trim().length > 12, `${tool.id} when`)
    assert.ok(tool.outcome.trim().length > 12, `${tool.id} outcome`)
  }
})

test('Check tools: Continuity is the only gate path; Review/Craft stay panel-only', () => {
  const continuity = checkToolById('continuity')
  const review = checkToolById('review')
  const craft = checkToolById('craft')
  assert.match(continuity.outcome, /Inbox|Accept/i)
  assert.match(continuity.what, /Only Continuity entry/i)
  assert.match(review.what, /not Continuity/i)
  assert.match(craft.what, /not bible contradictions|craft coach/i)
  assert.doesNotMatch(review.outcome, /writes Canon|auto-accept/i)
  assert.doesNotMatch(craft.outcome, /writes Canon|auto-accept/i)
  assert.match(craft.outcome, /Add/i)
})

test('AgentPanel Check face is primary Continuity + quiet secondary (not three cards)', () => {
  const source = readFileSync(join(root, 'components/shell/AgentPanel.tsx'), 'utf8')
  assert.match(source, /CHECK_PRIMARY/)
  assert.match(source, /CHECK_SECONDARY\.map/)
  assert.match(source, /companion__check-primary/)
  assert.match(source, /companion__check-secondary/)
  assert.match(source, /data-check-info/)
  assert.match(source, /data-check-help/)
  // Dense always-on chrome must stay gone.
  assert.doesNotMatch(source, /companion__check-legend/)
  assert.doesNotMatch(source, /companion__check-tool-blurb/)
  assert.doesNotMatch(source, /companion__check-tools/)
  assert.doesNotMatch(source, /agent__cowrite-actions" aria-label="Check tools"/)
  // Result copy stays short — no Inbox Accept/Edit/Reject essay in the summary.
  assert.doesNotMatch(source, /Open Inbox to Accept\/Edit\/Reject/)
})

test('MUTATION lock: Review and Craft help must keep Continuity distinction', () => {
  const review = checkToolById('review')
  const craft = checkToolById('craft')
  assert.doesNotMatch(`${review.what} ${review.when} ${review.outcome}`, /marks on the page/i)
  assert.doesNotMatch(`${craft.what} ${craft.when} ${craft.outcome}`, /marks on the page/i)
  assert.match(`${review.what} ${craft.what}`, /not Continuity|craft coach|story coaching/i)
})

test('MUTATION lock: resting Check must not triple-state Continuity', () => {
  const source = readFileSync(join(root, 'components/shell/AgentPanel.tsx'), 'utf8')
  // Empty-state essay + legend + three blurbs was the density fault.
  assert.doesNotMatch(source, /Check is the only Continuity entry\. It scans/)
  assert.doesNotMatch(source, /Continuity guards Canon\. Review and Craft coach/)
  assert.doesNotMatch(source, /Find contradictions against accepted Canon/)
})

test('MUTATION lock: post-run Check does not double Continuity (summary owns result)', () => {
  const source = readFileSync(join(root, 'components/shell/AgentPanel.tsx'), 'utf8')
  // Check face body must hide tool cards — companion__check-summary is the result owner.
  assert.match(source, /renderTranscript\(\{\s*tools:\s*false,\s*apply:\s*false,\s*status:\s*false,\s*review:\s*true\s*\}\)/)
  // Compact result copy (no "Last Continuity" essay form).
  assert.doesNotMatch(source, /Last Continuity/)
  // Tool card empty branch must not re-teach Accept/Edit/Reject.
  assert.doesNotMatch(source, /No marks or proposals for this chapter/)
  // Inbox empty hint may still mention Accept/Edit/Reject — that is a different face.
  assert.match(source, /Accept\/Edit\/Reject stay gated until something is pending/)
})
