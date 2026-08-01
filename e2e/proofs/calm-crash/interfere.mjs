/**
 * MANUAL DIAGNOSTIC — deliberate calm interference (build+touch after self-tests).
 * Salvaged from storylint-calm-crash. Weaker than natural serial loop. Report-only.
 * Not the producer of the landed run-01..08 specimen.
 *
 * Usage: node e2e/proofs/calm-crash/interfere.mjs
 * Captures full calm stdout/stderr unfiltered.
 */
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

const OUT_DIR = 'e2e/proofs/calm-crash'
fs.mkdirSync(OUT_DIR, { recursive: true })
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const calmLog = path.join(OUT_DIR, `interfere-calm-${stamp}.log`)
const sideLog = path.join(OUT_DIR, `interfere-side-${stamp}.log`)
const summaryPath = path.join(OUT_DIR, `interfere-summary-${stamp}.json`)

fs.writeFileSync(calmLog, '')
fs.writeFileSync(sideLog, '')

function append(file, chunk) {
  fs.appendFileSync(file, chunk.toString('utf8'))
}

const started = Date.now()
console.log('JCODE_PROGRESS ' + JSON.stringify({ message: 'interfere: starting calm-budget', kind: 'indeterminate' }))

const calm = spawn(process.execPath, ['e2e/calm-budget.mjs'], {
  cwd: process.cwd(),
  env: process.env,
  stdio: ['ignore', 'pipe', 'pipe'],
})

let calmBuf = ''
const onCalm = (chunk) => {
  const s = chunk.toString('utf8')
  calmBuf += s
  append(calmLog, s)
  if (/b6-primary-visibility-self-test\] ok/.test(s) || /visibility-self-test\] ok/.test(s)) {
    // fallthrough — side kick scheduled once both seen
  }
}

let kicked = false
function maybeKick() {
  if (kicked) return
  if (!/\[visibility-self-test\] ok/.test(calmBuf)) return
  if (!/\[b6-primary-visibility-self-test\] ok/.test(calmBuf)) return
  kicked = true
  console.log('JCODE_PROGRESS ' + JSON.stringify({ message: 'interfere: self-tests ok — kicking side build+touch', kind: 'indeterminate' }))
  append(sideLog, `kick at +${Date.now() - started}ms\n`)

  // 1) npm run build in same worktree (dist churn under live server)
  const build = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], {
    cwd: process.cwd(),
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  })
  build.stdout.on('data', (c) => append(sideLog, c))
  build.stderr.on('data', (c) => append(sideLog, c))
  build.on('close', (code) => {
    append(sideLog, `\nbuild exit ${code} at +${Date.now() - started}ms\n`)
    // 2) touch a served asset after build
    try {
      const css = 'dist/assets'
      if (fs.existsSync('dist')) {
        const shell = path.join('dist', 'shell.css')
        // vite may hash assets; touch index if present
        const index = path.join('dist', 'index.html')
        if (fs.existsSync(index)) {
          const t = fs.readFileSync(index, 'utf8')
          fs.writeFileSync(index, t + `\n<!-- interfere ${Date.now()} -->\n`)
          append(sideLog, `touched ${index}\n`)
        } else {
          append(sideLog, `no ${index}\n`)
        }
        if (fs.existsSync(shell)) {
          fs.appendFileSync(shell, `\n/* interfere ${Date.now()} */\n`)
          append(sideLog, `touched ${shell}\n`)
        }
      } else {
        append(sideLog, 'no dist/\n')
      }
    } catch (e) {
      append(sideLog, `touch error ${e}\n`)
    }
  })
}

calm.stdout.on('data', (c) => {
  onCalm(c)
  maybeKick()
})
calm.stderr.on('data', (c) => {
  onCalm(c)
  maybeKick()
})

// Also schedule a delayed kick in case self-test lines are split oddly
const kickTimer = setTimeout(() => {
  if (!kicked) {
    append(sideLog, `fallback kick at +${Date.now() - started}ms (self-tests not both seen yet)\n`)
    // force kick attempt once calm has been up 15s
    if (calmBuf.length > 0) {
      // inject fake markers only for kick gate if vis seen
      maybeKick()
      if (!kicked && /visibility-self-test/.test(calmBuf)) {
        kicked = false
        // hard force
        kicked = true
        console.log('JCODE_PROGRESS ' + JSON.stringify({ message: 'interfere: fallback force kick', kind: 'indeterminate' }))
        const build = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], {
          cwd: process.cwd(),
          env: process.env,
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: process.platform === 'win32',
        })
        build.stdout.on('data', (c) => append(sideLog, c))
        build.stderr.on('data', (c) => append(sideLog, c))
        build.on('close', (code) => append(sideLog, `\nfallback build exit ${code}\n`))
      }
    }
  }
}, 15000)

const code = await new Promise((resolve) => calm.on('close', resolve))
clearTimeout(kickTimer)
const ms = Date.now() - started
const hasHard = /HARD fails:/.test(calmBuf)
const hasFp = /FINGERPRINT /.test(calmBuf)
const hasVis = /\[visibility-self-test\] ok/.test(calmBuf)
const hasB6 = /\[b6-primary-visibility-self-test\] ok/.test(calmBuf)
const hasTimeout = /hard-timeout after/.test(calmBuf)
let kind = 'unknown'
if (code === 0 && hasHard && hasFp) kind = 'pass-despite-interfere'
else if (hasTimeout || code === 124) kind = 'hard-timeout'
else if (hasVis && hasB6 && !hasHard && !hasFp) kind = 'died-after-self-tests-no-identity'
else if (hasHard && hasFp && code !== 0) kind = 'hard-fail-with-identity'
else if (code !== 0) kind = 'other-nonzero'
else kind = 'pass-odd'

const summary = {
  kind,
  code,
  ms,
  kicked,
  hasHard,
  hasFp,
  hasVis,
  hasB6,
  hasTimeout,
  calmLog,
  sideLog,
  calmBytes: Buffer.byteLength(calmBuf),
  tail: calmBuf.slice(-1200),
}
fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2))
console.log('INTERFERE', JSON.stringify(summary, null, 2))
console.log('JCODE_CHECKPOINT ' + JSON.stringify({ message: `interfere done kind=${kind} code=${code}` }))
process.exit(0)
