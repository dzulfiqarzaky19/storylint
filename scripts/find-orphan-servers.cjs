/**
 * MANUAL DIAGNOSTIC — find orphaned dev-server / vite node processes.
 *
 * Agents start owned stacks (api + vite) for smokes. If a run dies between
 * spawn and teardown, the children survive: they hold ports, keep file handles
 * on deleted worktrees, and quietly consume RAM for the rest of the day.
 *
 * This only REPORTS. Killing is a separate, explicit act, because a wrong kill
 * takes out a live agent's run.
 *
 * node scripts/find-orphan-servers.cjs
 */
const { execSync } = require('child_process')

const fs = require('fs')
const os = require('os')
const path = require('path')

/**
 * Run PowerShell via a temp script file. Passing this inline through cmd.exe
 * mangles the quoting and the command silently degrades.
 */
function psScript(body) {
  const file = path.join(os.tmpdir(), `orphan-scan-${process.pid}.ps1`)
  fs.writeFileSync(file, body, 'utf8')
  try {
    return execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${file}"`, {
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    })
  } catch {
    return ''
  } finally {
    fs.rmSync(file, { force: true })
  }
}

// CreationDate must be projected to an ISO string. The raw CIM value serializes
// as /Date(...)/, which new Date() parses to Invalid — every age becomes NaN and
// every "older than 4h" test silently returns false. That is a filter that
// cannot fire: it would have reported zero orphans forever.
const raw = psScript(
  "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" |\n" +
    '  Select-Object ProcessId, CommandLine,\n' +
    '    @{n="Created";e={ $_.CreationDate.ToString("o") }} |\n' +
    '  ConvertTo-Json -Compress -Depth 3\n',
)

let procs = []
try {
  const parsed = JSON.parse(raw || '[]')
  procs = Array.isArray(parsed) ? parsed : [parsed]
} catch {
  console.log('could not read process list')
  process.exit(1)
}

function worktreeOf(cmdline) {
  if (!cmdline) return null
  const m = cmdline.match(/[A-Z]:\\dev\\projects\\(storylint[^\\"\s]*)/i)
  return m ? m[1] : null
}

const rows = []
for (const p of procs) {
  const wt = worktreeOf(p.CommandLine)
  const created = p.Created ? new Date(p.Created) : null
  const ageH = created && !Number.isNaN(created.getTime())
    ? (Date.now() - created.getTime()) / 3_600_000
    : null
  const dirGone = wt ? !fs.existsSync(path.join('D:\\dev\\projects', wt)) : false
  rows.push({ pid: p.ProcessId, wt, ageH, dirGone, cmd: (p.CommandLine || '').slice(0, 110) })
}

// If no age parsed at all, say so rather than reporting a confident zero.
const unaged = rows.filter((r) => r.ageH === null).length
if (unaged === rows.length && rows.length > 0) {
  console.log('WARNING: no process ages parsed — age filters below are meaningless.')
}

const orphanDir = rows.filter((r) => r.dirGone)
const old = rows.filter((r) => !r.dirGone && r.ageH !== null && r.ageH > 4)

console.log(`\n=== NODE PROCESSES: ${rows.length}`)

console.log(`\n=== ORPHANED: worktree directory no longer exists — ${orphanDir.length}`)
for (const r of orphanDir) {
  console.log(`  pid=${String(r.pid).padEnd(7)} age=${r.ageH?.toFixed(1)}h  ${r.wt}`)
}

console.log(`\n=== STALE: older than 4h, directory still present — ${old.length}`)
for (const r of old) {
  console.log(`  pid=${String(r.pid).padEnd(7)} age=${r.ageH?.toFixed(1)}h  ${r.wt ?? '(unknown cwd)'}`)
}

console.log(
  '\nThis script does not kill anything. A wrong kill takes out a live run.\n' +
    'To stop one:  powershell -NoProfile -Command "Stop-Process -Id <pid> -Force"',
)
