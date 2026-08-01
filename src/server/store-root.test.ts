import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

/**
 * T-007 — source-level construction-site check (not a runtime path scanner).
 *
 * What it sees: any `new ProjectStore(` text in src/server product files.
 * What it cannot see: a path laundered through a helper that still calls
 * ProjectStore.open / ProjectFileRoot.open* with an outside path — that is
 * covered by the unit tests on open()/switchFile/owns().
 *
 * Mechanism: ProjectStore construction is factory-only (private constructor +
 * ProjectStore.open). Product code must go through ProjectFileRoot.
 */
const serverDir = dirname(fileURLToPath(import.meta.url))

function listTsFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, name.name)
    if (name.isDirectory()) out.push(...listTsFiles(path))
    else if (name.name.endsWith('.ts') && !name.name.endsWith('.test.ts')) out.push(path)
  }
  return out
}

test('T-007 source: no product new ProjectStore( outside store.ts factory', () => {
  const offenders: string[] = []
  for (const file of listTsFiles(serverDir)) {
    if (file.endsWith(`${join('server', 'store.ts')}`) || file.endsWith('store.ts') && file.includes(`${join('src', 'server')}`)) {
      // store.ts may contain the private constructor body only — still forbid bare external pattern in comments? allow file.
      if (file.replaceAll('\\', '/').endsWith('/server/store.ts')) continue
    }
    const text = readFileSync(file, 'utf8')
    if (/new\s+ProjectStore\s*\(/.test(text)) offenders.push(file)
  }
  assert.deepEqual(offenders, [], `bare ProjectStore construction:\n${offenders.join('\n')}`)
})

test('T-007 source: http + index open stores only via ProjectFileRoot', () => {
  const http = readFileSync(join(serverDir, 'http.ts'), 'utf8')
  const index = readFileSync(join(serverDir, 'index.ts'), 'utf8')
  assert.match(http, /fileRoot\.openId/)
  assert.match(http, /store\.root/)
  assert.doesNotMatch(http, /new\s+ProjectStore\s*\(/)
  assert.match(index, /new\s+ProjectFileRoot\s*\(/)
  assert.match(index, /\.openDefault\s*\(/)
  assert.doesNotMatch(index, /new\s+ProjectStore\s*\(/)
})
