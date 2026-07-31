import assert from 'node:assert/strict'
import { test } from 'node:test'
import { applyManuscriptText } from './apply.ts'

const body = 'Aria opened the door. Kael waited outside.'

test('insert applies only at the explicit cursor position', () => {
  const cursor = body.indexOf(' Kael')
  const result = applyManuscriptText(body, { mode: 'insert', start: cursor, end: cursor }, ' She froze.')
  assert.equal(result, 'Aria opened the door. She froze. Kael waited outside.')
  assert.equal(body, 'Aria opened the door. Kael waited outside.')
})

test('replace applies only to the explicit selection', () => {
  const start = body.indexOf('opened')
  const end = body.indexOf('the door') + 'the door'.length
  const result = applyManuscriptText(body, { mode: 'replace', start, end }, 'kicked the door shut')
  assert.equal(result, 'Aria kicked the door shut. Kael waited outside.')
})

test('invalid or stale ranges fail instead of writing elsewhere', () => {
  assert.throws(
    () => applyManuscriptText(body, { mode: 'replace', start: -1, end: 4 }, 'x'),
    /Invalid manuscript range/,
  )
  assert.throws(
    () => applyManuscriptText(body, { mode: 'insert', start: 999, end: 999 }, 'x'),
    /Invalid manuscript range/,
  )
})
