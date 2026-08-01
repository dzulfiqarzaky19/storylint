#!/usr/bin/env node
/**
 * MANUAL DIAGNOSTIC — land-shaped test:green capture with CAUSE lines
 *
 * MANUAL DIAGNOSTIC — not part of the green suite (test:green / ALL_FEATURE_SMOKES).
 * NOT part of npm test / test:green. Standalone evidence-capture tool (T-006 / e2e/README).
 * land.mjs embeds the same [cause] lines; keep this for N-loops without full land.
 * Narrative cause output is not a pass/fail gate — do not wire as a package test script.
 * Run: node scripts/capture-test-green-cause.mjs
 */

import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'

const IS_WIN = process.platform === 'win32'
const ROOT = process.cwd()
const LAND_DIR = join(ROOT, '_land_run')

function parseArgs(argv) {
  let n = 1
  let label = 'cause-test-green'
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--n') n = Math.max(1, Number(argv[++i]) || 1)
    else if (a.startsWith('--n=')) n = Math.max(1, Number(a.slice(4)) || 1)
    else if (a === '--label') label = String(argv[++i] || label)
    else if (a.startsWith('--label=')) label = a.slice('--label='.length) || label
  }
  return { n, label }
}

function shellQuote(value) {
  const s = String(value)
  if (!/[\s"]/u.test(s)) return s
  return `"${s.replace(/"/g, '\\"')}"`
}

function resolveCmd(name) {
  if (name === 'npm') return IS_WIN ? 'npm.cmd' : 'npm'
  return name
}

/**
 * Mirror scripts/land.mjs runCapture spawn shape, plus cause instrumentation.
 * Windows npm.cmd goes through a single shell command line (same as land).
 */
function runCaptureWithCause(command, args, { env } = {}) {
  const resolved = resolveCmd(command)
  const printable = [resolved, ...args].map(shellQuote).join(' ')
  const useShellLine = IS_WIN && /\.cmd$/i.test(resolved)
  const t0 = performance.now()

  return new Promise((resolvePromise) => {
    const child = useShellLine
      ? spawn(printable, {
          shell: true,
          env: env ? { ...process.env, ...env } : process.env,
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsHide: true,
        })
      : spawn(resolved, args, {
          shell: false,
          env: env ? { ...process.env, ...env } : process.env,
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsHide: true,
        })

    let out = ''
    let firstEvent = null
    let exitInfo = null
    let closeInfo = null

    const stamp = (kind, payload) => {
      const line = `[cause] ${kind} ${payload}\n`
      out += line
      process.stderr.write(line)
    }

    const onChunk = (buf, stream) => {
      const text = buf.toString('utf8')
      out += text
      stream.write(text)
    }

    // pid may be undefined briefly; log after next tick if needed
    const logSpawn = () => {
      stamp(
        'spawn',
        `pid=${child.pid ?? 'null'} shell=${useShellLine} cmd=${printable}`,
      )
    }
    logSpawn()
    if (child.pid == null) {
      child.once('spawn', logSpawn)
    }

    child.stdout.on('data', (b) => onChunk(b, process.stdout))
    child.stderr.on('data', (b) => onChunk(b, process.stderr))

    child.on('error', (error) => {
      const elapsed = Math.round(performance.now() - t0)
      stamp('error', `pid=${child.pid ?? 'null'} msg=${error.message} elapsed_ms=${elapsed}`)
      resolvePromise({
        status: 1,
        output: out,
        cause: { error: error.message, elapsed_ms: elapsed, pid: child.pid ?? null },
      })
    })

    child.on('exit', (code, signal) => {
      const elapsed = Math.round(performance.now() - t0)
      if (!firstEvent) firstEvent = 'exit'
      exitInfo = { code, signal, elapsed_ms: elapsed }
      stamp(
        'exit',
        `pid=${child.pid ?? 'null'} code=${code === null ? 'null' : code} signal=${signal ?? 'null'} elapsed_ms=${elapsed} first=${firstEvent}`,
      )
    })

    child.on('close', (code, signal) => {
      const elapsed = Math.round(performance.now() - t0)
      if (!firstEvent) firstEvent = 'close'
      closeInfo = { code, signal, elapsed_ms: elapsed }
      const exitToClose =
        exitInfo != null ? Math.max(0, elapsed - exitInfo.elapsed_ms) : null
      stamp(
        'close',
        `pid=${child.pid ?? 'null'} code=${code === null ? 'null' : code} signal=${signal ?? 'null'} elapsed_ms=${elapsed} first=${firstEvent}` +
          (exitToClose != null ? ` exit_to_close_ms=${exitToClose}` : ''),
      )
      resolvePromise({
        status: code ?? 1,
        output: out,
        cause: {
          pid: child.pid ?? null,
          exit: exitInfo,
          close: closeInfo,
          first: firstEvent,
          exit_to_close_ms: exitToClose,
          shell: useShellLine,
          cmd: printable,
        },
      })
    })
  })
}

function classifyRough(output, status) {
  const hasFp = /FINGERPRINT\s+[0-9a-f]+/i.test(output)
  const hasEperm = /EPERM/i.test(output)
  const hasB6 = /\[b6-primary-visibility-self-test\]/.test(output)
  const hasRunEnd = /\[run-end\]/.test(output)
  const hasHardTimeout = /hard-timeout/i.test(output)
  const hasRefuse = /\bREFUSE\b/.test(output)
  let kind = `other_exit_${status}`
  if (status === 0 && hasFp) kind = 'green'
  else if (hasEperm) kind = 'eperm'
  else if (hasHardTimeout || status === 124) kind = 'hard_timeout'
  else if (hasRefuse || status === 2) kind = 'refuse'
  else if (hasB6 && !hasFp && !hasRunEnd && !hasEperm && status === 1) kind = 'silent_after_selftest'
  return { kind, hasFp, hasEperm, hasB6, hasRunEnd, hasHardTimeout, hasRefuse }
}

async function main() {
  const { n, label } = parseArgs(process.argv)
  mkdirSync(LAND_DIR, { recursive: true })
  const summaryPath = join(LAND_DIR, `${label}-summary.jsonl`)
  console.log(`capture-test-green-cause: n=${n} label=${label}`)
  console.log(`capture-test-green-cause: summary → ${summaryPath}`)
  console.log(
    'capture-test-green-cause: mirrors land runCapture spawn; does not edit land.mjs',
  )

  const rows = []
  for (let i = 1; i <= n; i++) {
    const runLabel = `${label}-${i}`
    const logPath = join(LAND_DIR, `${runLabel}.log`)
    console.log(`\n======== RUN ${i}/${n} → ${logPath} ========`)
    const { status, output, cause } = await runCaptureWithCause('npm', ['run', 'test:green'])
    writeFileSync(logPath, output, 'utf8')
    const rough = classifyRough(output, status)
    const row = {
      i,
      status,
      kind: rough.kind,
      logPath,
      cause,
      markers: {
        hasFp: rough.hasFp,
        hasEperm: rough.hasEperm,
        hasB6: rough.hasB6,
        hasRunEnd: rough.hasRunEnd,
        hasHardTimeout: rough.hasHardTimeout,
        hasRefuse: rough.hasRefuse,
      },
    }
    rows.push(row)
    appendFileSync(summaryPath, JSON.stringify(row) + '\n', 'utf8')
    console.log(
      `RUN ${i}/${n} status=${status} kind=${rough.kind} pid=${cause?.pid} first=${cause?.first} signal=${cause?.close?.signal ?? cause?.exit?.signal ?? 'null'} elapsed_ms=${cause?.close?.elapsed_ms ?? cause?.exit?.elapsed_ms}`,
    )
  }

  console.log('\n======== SUMMARY ========')
  const counts = {}
  for (const r of rows) counts[r.kind] = (counts[r.kind] || 0) + 1
  console.log(JSON.stringify({ n, counts, rows: rows.map((r) => ({
    i: r.i,
    status: r.status,
    kind: r.kind,
    pid: r.cause?.pid,
    first: r.cause?.first,
    exit_code: r.cause?.exit?.code ?? null,
    exit_signal: r.cause?.exit?.signal ?? null,
    close_code: r.cause?.close?.code ?? null,
    close_signal: r.cause?.close?.signal ?? null,
    elapsed_ms: r.cause?.close?.elapsed_ms ?? null,
    exit_to_close_ms: r.cause?.exit_to_close_ms ?? null,
  })) }, null, 2))
  console.log(`summary jsonl: ${summaryPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
