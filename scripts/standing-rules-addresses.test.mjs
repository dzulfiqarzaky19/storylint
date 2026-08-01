import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

/**
 * Standing-rule ADDRESSES must be unique.
 *
 * This is not style policing. On 2026-08-01 the page had two rule 26s and two
 * rule 35s, because the Pipeline block restarted its numbering. "Per rule 35"
 * then named two different rules depending on which section the reader landed
 * in — two agents could cite the same number for different ideas and both be
 * "following the rules".
 *
 * Same defect class as a half-rename or a dual vocabulary: the page teaches one
 * ladder while the numbers implement two. A doc convention nobody checks is a
 * doc convention that regrows, so this is a test rather than a paragraph.
 */

const here = dirname(fileURLToPath(import.meta.url))
const rulesPath = join(here, '..', 'docs', 'decisions', 'STANDING_RULES.md')
const src = readFileSync(rulesPath, 'utf8')
const lines = src.split(/\r?\n/)

/** Collect numbered rules with the section they appear under. */
function collectRules() {
  const rules = []
  let section = '(top)'
  let inFence = false
  for (const [i, line] of lines.entries()) {
    if (/^```/.test(line)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    const heading = line.match(/^##+\s+(.*)/)
    if (heading) {
      section = heading[1].trim()
      continue
    }
    // "12. **Rule text**" or "8c. **Rule text**"
    const m = line.match(/^(\d+[a-z]?)\.\s+\*\*/)
    if (m) rules.push({ id: m[1], section, line: i + 1 })
  }
  return rules
}

test('every standing rule number is a unique address', () => {
  const rules = collectRules()
  assert.ok(rules.length > 20, `expected to find the rule list, found ${rules.length}`)

  const byId = new Map()
  for (const r of rules) {
    if (!byId.has(r.id)) byId.set(r.id, [])
    byId.get(r.id).push(r)
  }

  const collisions = [...byId.entries()].filter(([, v]) => v.length > 1)
  const detail = collisions
    .map(([id, v]) => `  rule ${id}: ${v.map((r) => `L${r.line} [${r.section}]`).join(' AND ')}`)
    .join('\n')

  assert.equal(
    collisions.length,
    0,
    `standing rule numbers collide, so citing them is ambiguous:\n${detail}\n` +
      'Give the newer block a fresh range and add a redirect row to the renumbering table.',
  )
})

test('the numbering does not restart mid-page', () => {
  // A restart is how the collisions got in. Numbers may skip (lettered
  // sub-rules interleave), but the integer part must never go backwards.
  const rules = collectRules()
  const ints = rules.map((r) => ({ ...r, n: Number.parseInt(r.id, 10) }))

  const regressions = []
  let high = 0
  let highRule = null
  for (const r of ints) {
    if (r.n < high) regressions.push(`  L${r.line} rule ${r.id} [${r.section}] < earlier ${highRule}`)
    else {
      high = r.n
      highRule = r.id
    }
  }

  assert.equal(
    regressions.length,
    0,
    `rule numbering goes backwards, which is how duplicate addresses appear:\n${regressions.join('\n')}`,
  )
})

test('the renumbering redirect table is present', () => {
  // Old citations live in tickets, decision memos and handoffs. Renumbering
  // without a redirect silently breaks them: the cite still resolves, to the
  // wrong rule. That is worse than a dangling link.
  assert.match(src, /## How to use this page/, 'daily set / usage section must exist')
  assert.match(src, /### Renumbering/, 'renumbering section must exist')
  assert.match(src, /\| Old cite \| Now \|/, 'redirect table must exist')
})

test('the daily set cites rules that actually exist', () => {
  // A daily set pointing at a missing number is a false index.
  const rules = new Set(collectRules().map((r) => r.id))
  const dailyBlock = src.slice(
    src.indexOf('**Daily set'),
    src.indexOf('Product chrome rules'),
  )
  assert.ok(dailyBlock.length > 0, 'daily set block must exist')

  // Pull bare integers cited in the daily table's first column.
  const cited = [...dailyBlock.matchAll(/^\|\s*(\d+)\s*\|/gm)].map((m) => m[1])
  assert.ok(cited.length > 0, 'daily set must cite some rule numbers')

  const missing = cited.filter((n) => !rules.has(n))
  assert.deepEqual(missing, [], `daily set cites nonexistent rules: ${missing.join(', ')}`)
})

test('redirect table targets exist and sources do not silently persist', () => {
  const rules = new Set(collectRules().map((r) => r.id))
  const table = src.slice(src.indexOf('| Old cite | Now |'), src.indexOf('`26` and `35` now mean'))
  const rows = [...table.matchAll(/^\|\s*(\d+)[^|]*\|\s*\*{0,2}(\d+)\*{0,2}\s*\|/gm)]
  assert.ok(rows.length > 0, 'redirect table must have rows')

  const badTargets = rows.map((r) => r[2]).filter((n) => !rules.has(n))
  assert.deepEqual(badTargets, [], `redirect points at nonexistent rules: ${badTargets.join(', ')}`)
})
