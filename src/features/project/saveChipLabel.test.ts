/**
 * Save chip paint.
 *
 * Load-bearing bar: chip text differs between idle and error.
 * Substring-only "Not saved appears" is too weak if idle also showed it.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import type { SaveState } from './useProject.ts'
import { saveChipLabel } from './saveChipLabel.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const shellPath = resolve(root, 'src/components/shell/Shell.tsx')

const PAINT: Record<SaveState, string> = {
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Not saved',
  idle: '',
}

test('saveChipLabel: exact paint table (ox binding)', () => {
  for (const state of Object.keys(PAINT) as SaveState[]) {
    assert.equal(saveChipLabel(state), PAINT[state], state)
  }
})

test('saveChipLabel: idle and error differ (load-bearing false-idle bar)', () => {
  const idle = saveChipLabel('idle')
  const error = saveChipLabel('error')
  assert.equal(idle, '')
  assert.equal(error, 'Not saved')
  assert.notEqual(idle, error, 'error must not paint false idle')
})

test('saveChipLabel: error is Not saved exactly (not toast body / severity costume)', () => {
  assert.equal(saveChipLabel('error'), 'Not saved')
  assert.notEqual(saveChipLabel('error'), 'Error')
  assert.notEqual(saveChipLabel('error'), 'Failed')
  assert.notEqual(saveChipLabel('error'), 'Save failed')
})

test('Shell call site: project-status chip drives saveChipLabel(project.saveState)', () => {
  const src = readFileSync(shellPath, 'utf8')
  assert.match(
    src,
    /import\s*\{\s*saveChipLabel\s*\}\s*from\s*['"][^'"]*saveChipLabel\.ts['"]/,
    'Shell must import shipped saveChipLabel',
  )
  assert.match(
    src,
    /className=["']project-status["'][\s\S]*?\{saveChipLabel\(\s*project\.saveState\s*\)\}/,
    'project-status chip must call saveChipLabel(project.saveState)',
  )
  // Collapsed ternary that drops error (the pre-fix disease) must not return.
  assert.equal(
    /saveState\s*===\s*['"]saving['"]\s*\?\s*['"]Saving…['"]\s*:\s*project\.saveState\s*===\s*['"]saved['"]\s*\?\s*['"]Saved['"]\s*:\s*['"]['"]/.test(
      src,
    ),
    false,
    'Shell must not keep the idle/error-collapsing ternary',
  )
})
