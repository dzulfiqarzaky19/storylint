/**
 * Hawk acceptance — isolation class.
 * 1) active=default → slice-k → data/project.json sheet count unchanged.
 * 2) all-smoke → active-project.txt equals pre-suite value.
 * Fresh stack is not a fresh container — reset the pointer explicitly.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import {
  setApiBase,
  restoreActiveProject,
  readServerActiveProjectId,
  defaultDataDirectory,
} from './helpers.mjs'
import { resolveMeasurementTarget } from './owned-stack.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = defaultDataDirectory(root)
const defaultProjectPath = join(dataDir, 'project.json')
const activePath = join(dataDir, 'active-project.txt')

function readDefaultSheetCount() {
  if (!existsSync(defaultProjectPath)) return 0
  try {
    const project = JSON.parse(readFileSync(defaultProjectPath, 'utf8'))
    return Array.isArray(project.sheets) ? project.sheets.length : 0
  } catch {
    return 0
  }
}

function readActiveFile() {
  if (!existsSync(activePath)) return null
  return readFileSync(activePath, 'utf8').trim() || null
}

function runNode(relPath, env) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [relPath], {
      cwd: root,
      stdio: 'inherit',
      env,
      shell: false,
    })
    child.on('error', reject)
    child.on('exit', (code, signal) => {
      if (signal) reject(new Error(`${relPath} killed ${signal}`))
      else if (code !== 0) reject(new Error(`${relPath} exited ${code}`))
      else resolvePromise()
    })
  })
}

const stack = await resolveMeasurementTarget({ root })
setApiBase(stack.api)
const env = {
  ...process.env,
  STORYLINT_UI: stack.ui,
  STORYLINT_API: stack.api,
  STORYLINT_ALLOW_EXTERNAL_UI: '1',
}

const failures = []
try {
  mkdirSync(dataDir, { recursive: true })

  await restoreActiveProject('default')
  writeFileSync(activePath, 'default\n', 'utf8')
  const sheetsBefore = readDefaultSheetCount()
  console.log(`[accept-1] active=${readActiveFile()} default sheets before=${sheetsBefore}`)
  await runNode('e2e/slice-k-smoke.mjs', env)
  const sheetsAfter = readDefaultSheetCount()
  console.log(`[accept-1] default sheets after=${sheetsAfter} active=${readActiveFile()}`)
  if (sheetsAfter !== sheetsBefore) {
    failures.push(`slice-k changed default sheets ${sheetsBefore} → ${sheetsAfter}`)
  }

  writeFileSync(activePath, 'default\n', 'utf8')
  await restoreActiveProject('default')
  const beforeSuite = readActiveFile()
  console.log(`[accept-2] active before all-smoke=${beforeSuite}`)
  await runNode('e2e/all-smoke.mjs', env)
  const afterSuite = readActiveFile()
  const serverAfter = await readServerActiveProjectId()
  console.log(`[accept-2] active file after=${afterSuite} server=${serverAfter}`)
  if (afterSuite !== beforeSuite) {
    failures.push(`bookend file want=${beforeSuite} got=${afterSuite}`)
  }
  if (serverAfter !== beforeSuite) {
    failures.push(`bookend server want=${beforeSuite} got=${serverAfter}`)
  }
} finally {
  try { await stack.stop() } catch { /* ignore */ }
}

if (failures.length) {
  console.error('\nACCEPT FAIL:')
  for (const f of failures) console.error(' -', f)
  process.exit(1)
}
console.log('\nACCEPT PASS: default sheets unchanged under slice-k; suite restores active-project')
