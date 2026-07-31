import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { ALL_FEATURE_SMOKES } from './constants.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function runSmoke(relPath) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [relPath], {
      cwd: root,
      stdio: 'inherit',
      env: process.env,
      shell: false,
    })
    child.on('error', reject)
    child.on('exit', (code, signal) => {
      if (signal) reject(new Error(`${relPath} killed by ${signal}`))
      else if (code !== 0) reject(new Error(`${relPath} exited ${code}`))
      else resolvePromise()
    })
  })
}

console.log(`Running ${ALL_FEATURE_SMOKES.length} feature smokes…`)
for (const relPath of ALL_FEATURE_SMOKES) {
  console.log(`\n===== ${relPath} =====`)
  await runSmoke(relPath)
}
console.log(`\nPASS: all ${ALL_FEATURE_SMOKES.length} feature smokes`)
