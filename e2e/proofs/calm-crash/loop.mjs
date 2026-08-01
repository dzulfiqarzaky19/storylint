/**
 * MANUAL DIAGNOSTIC — calm-budget intermittent death loop (serial).
 * Salvaged from storylint-calm-crash untracked harness. Report-only.
 * Not wired into npm test / land. Writes run-*.log + loop-summary.jsonl here.
 *
 * Serial: one calm-budget child at a time. Not a multi-process writer probe.
 */
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

const OUT_DIR = 'e2e/proofs/calm-crash'
const MAX = Number(process.env.CALM_LOOP_MAX || 12)
const summaryPath = path.join(OUT_DIR, 'loop-summary.jsonl')
fs.mkdirSync(OUT_DIR, { recursive: true })
fs.writeFileSync(summaryPath, '')

function classify(text, code) {
  const hasHard = /HARD fails:/.test(text)
  const hasFp = /FINGERPRINT /.test(text)
  const hasVis = /\[visibility-self-test\] ok/.test(text)
  const hasB6 = /\[b6-primary-visibility-self-test\] ok/.test(text)
  const hasRunEnd = /run-end/.test(text)
  const hasTimeout = /hard-timeout after/.test(text)
  const hasRefuse = /REFUSE/.test(text)
  let kind = 'unknown'
  if (code === 0 && hasHard && hasFp) kind = 'pass'
  else if (hasTimeout || code === 124) kind = 'hard-timeout'
  else if (hasRefuse) kind = 'refuse'
  else if (hasVis && hasB6 && !hasHard && !hasFp) kind = 'died-after-self-tests-no-identity'
  else if (hasHard && hasFp && code !== 0) kind = 'hard-fail-with-identity'
  else if (!hasVis && code !== 0) kind = 'died-before-self-tests'
  else kind = 'other-nonzero'
  return { kind, hasHard, hasFp, hasVis, hasB6, hasRunEnd, hasTimeout, hasRefuse }
}

function one(i) {
  const outPath = path.join(OUT_DIR, `run-${String(i).padStart(2, '0')}.log`)
  const started = Date.now()
  console.log(
    'JCODE_PROGRESS ' +
      JSON.stringify({ current: i, total: MAX, unit: 'runs', message: `calm-budget run ${i}` }),
  )
  fs.writeFileSync(outPath, '')
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['e2e/calm-budget.mjs'], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let buf = ''
    const append = (chunk) => {
      const s = chunk.toString('utf8')
      buf += s
      fs.appendFileSync(outPath, s)
    }
    child.stdout.on('data', append)
    child.stderr.on('data', append)
    child.on('error', (err) => {
      const row = { i, error: String(err), outPath }
      fs.appendFileSync(summaryPath, JSON.stringify(row) + '\n')
      console.log('ERR', JSON.stringify(row))
      resolve(row)
    })
    child.on('close', (code) => {
      const ms = Date.now() - started
      const c = classify(buf, code ?? 1)
      const row = { i, code, ms, ...c, bytes: Buffer.byteLength(buf), outPath }
      fs.appendFileSync(summaryPath, JSON.stringify(row) + '\n')
      console.log('RUN', JSON.stringify(row))
      if (
        c.kind === 'died-after-self-tests-no-identity' ||
        (code !== 0 && c.kind !== 'hard-fail-with-identity' && c.kind !== 'pass')
      ) {
        console.log(
          'JCODE_CHECKPOINT ' +
            JSON.stringify({ message: `calm anomaly ${c.kind} run ${i}` }),
        )
      }
      resolve(row)
    })
  })
}

const results = []
for (let i = 1; i <= MAX; i++) {
  results.push(await one(i))
}
const counts = results.reduce((a, r) => {
  const k = r.kind || 'error'
  a[k] = (a[k] || 0) + 1
  return a
}, {})
console.log('JCODE_CHECKPOINT ' + JSON.stringify({ message: 'calm loop done', counts }))
console.log('SUMMARY', JSON.stringify({ counts, results }, null, 2))
process.exit(0)
