/**
 * MANUAL DIAGNOSTIC — ticket l1_proof / shortest_repro sweep.
 * Existence + understatement + command extract. Hand-run.
 *
 *   node scripts/_l1-proof-sweep.mjs
 */
import { execSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const HEAD = execSync('git rev-parse --short HEAD', { cwd: ROOT, encoding: 'utf8' }).trim()
const tree = new Set(
  execSync('git ls-tree -r --name-only HEAD', { cwd: ROOT, encoding: 'utf8' })
    .split(/\r?\n/)
    .filter(Boolean),
)

const UNDER_RE =
  /not checked in|no checked-in|no checked in|to be added|probe script not checked|— \(open ticket|no checked-in probe yet/i

const PATH_RE =
  /(?:^|[\s`"'(\[])((?:e2e|docs|src|scripts)\/[\w./@+-]+\.[A-Za-z0-9]+)/g

const CMD_RE =
  /(?:^|[\n`])\s*((?:node(?:\s+--[\w.-]+)*\s+(?:e2e|scripts|src)\/[^\n`]+)|(?:npm(?:\.cmd)?\s+run\s+[\w:-]+))/gm

function fmGet(fm, key) {
  const m = fm.match(new RegExp(`^${key}:\\s*(.*)$`, 'm'))
  return m ? m[1].trim() : ''
}

function extractPaths(text) {
  const out = new Set()
  let m
  const re = new RegExp(PATH_RE)
  while ((m = re.exec(text))) {
    out.add(m[1].replace(/[),.;:]+$/, ''))
  }
  return [...out]
}

function extractCmds(text) {
  const out = []
  let m
  const re = new RegExp(CMD_RE)
  while ((m = re.exec(text))) out.push(m[1].trim().replace(/[—-].*$/, '').trim())
  return [...new Set(out)]
}

function runCmd(cmd, timeoutMs = 120_000) {
  // Print match evidence, not bare counts. Capture full tail.
  const isNpm = /^npm(\.cmd)?\s+run\s+/.test(cmd)
  let result
  if (isNpm) {
    const script = cmd.replace(/^npm(\.cmd)?\s+run\s+/, '').trim()
    result = spawnSync('npm.cmd', ['run', script], {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: timeoutMs,
      env: process.env,
      shell: false,
    })
  } else {
    // node ...
    const parts = cmd.match(/(?:[^\s"]+|"[^"]*")+/g) || [cmd]
    const bin = parts[0]
    const args = parts.slice(1).map((a) => a.replace(/^"|"$/g, ''))
    result = spawnSync(bin, args, {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: timeoutMs,
      env: process.env,
      shell: false,
    })
  }
  const stdout = result.stdout || ''
  const stderr = result.stderr || ''
  const combined = stdout + '\n' + stderr
  const lines = combined.split(/\r?\n/).filter((l) => l.trim())
  // Evidence: last non-empty lines + any not ok / PASS / FAIL / Error lines
  const evidence = []
  for (const l of lines) {
    if (/\bnot ok\b|\bok\b|PASS|FAIL|Error|EPERM|ENOENT|exit|tests |fail |pass /i.test(l)) {
      evidence.push(l.slice(0, 240))
    }
  }
  const tail = lines.slice(-12).map((l) => l.slice(0, 240))
  return {
    cmd,
    status: result.status,
    signal: result.signal,
    error: result.error ? String(result.error.message || result.error) : null,
    evidence: [...new Set(evidence)].slice(-20),
    tail,
    matched_not_ok: (combined.match(/^not ok .*/gm) || []).slice(0, 10),
    matched_fail_n: [...combined.matchAll(/\bfail[s]?\s+(\d+)\b/gi)].map((m) => ({
      n: m[1],
      line: m[0],
      ctx: combined.slice(Math.max(0, m.index - 40), m.index + m[0].length + 40).replace(/\s+/g, ' '),
    })),
  }
}

const tickets = []
for (let i = 1; i <= 9; i++) {
  const id = `T-00${i}`
  const rel = `docs/tickets/${id}.md`
  const abs = join(ROOT, rel)
  const text = readFileSync(abs, 'utf8')
  const fm = (text.match(/^---\r?\n([\s\S]*?)\r?\n---/) || [])[1] || ''
  const status = fmGet(fm, 'status')
  const l1 = fmGet(fm, 'l1_proof')
  const sr = fmGet(fm, 'shortest_repro')
  const fields = `${l1}\n${sr}`
  const bodyHead = text.slice(0, 6000)
  const fieldPaths = extractPaths(fields)
  const bodyPaths = extractPaths(bodyHead).filter((p) => /proof|probe|capture|mutation|output|test/.test(p))
  const paths = [...new Set([...fieldPaths, ...bodyPaths])]
  const pathRows = paths.map((p) => ({
    path: p,
    in_fields: fields.includes(p),
    exists_tree: tree.has(p),
    exists_fs: existsSync(join(ROOT, p)),
  }))
  const understatement = UNDER_RE.test(fields)
  const cmds = extractCmds(fields + '\n' + bodyHead)
  // Prefer field cmds; if understatement but probe path exists, add that run
  const probePath = pathRows.find(
    (r) => r.exists_tree && /probe\.mjs$/.test(r.path) && (r.in_fields || understatement || /t00[789]/.test(r.path)),
  )
  tickets.push({
    id,
    status,
    l1_proof: l1,
    shortest_repro: sr,
    understatement_phrase_in_fields: understatement,
    paths: pathRows,
    cmds_extracted: cmds,
    probe_candidate: probePath?.path || null,
  })
}

// Run extracted commands that look like proof/probe (not full test:green unless named)
const runResults = []
for (const t of tickets) {
  const toRun = []
  for (const c of t.cmds_extracted) {
    // Skip full green suite in this sweep (too heavy); record as SKIPPED_HEAVY
    if (/test:green|all-smoke|calm-budget/.test(c) && !/test:l2/.test(c)) {
      toRun.push({ cmd: c, skip: 'HEAVY_SUITE' })
      continue
    }
    toRun.push({ cmd: c })
  }
  // If understatement and probe exists, force-run the probe even if fields deny it
  if (t.understatement_phrase_in_fields && t.probe_candidate) {
    const forced = `node --experimental-strip-types ${t.probe_candidate}`
    if (!toRun.some((r) => r.cmd.includes(t.probe_candidate))) {
      toRun.push({ cmd: forced, forced_from_tree: true })
    }
  }
  // Also run any field-named probe.mjs even without understatement
  for (const p of t.paths) {
    if (p.exists_tree && /\/probe\.mjs$/.test(p.path) && p.in_fields) {
      const c = `node --experimental-strip-types ${p.path}`
      if (!toRun.some((r) => r.cmd.includes(p.path))) toRun.push({ cmd: c })
    }
  }
  // capture-test-green-cause is a command; run --help or --n 1 only if cheap flag exists — skip full
  // scripts that take a full green loop unless explicitly short
  const results = []
  for (const item of toRun) {
    if (item.skip) {
      results.push({ cmd: item.cmd, status: null, skip: item.skip })
      continue
    }
    // Avoid capture-test-green-cause full loop (n>=1 still heavy)
    if (/capture-test-green-cause/.test(item.cmd)) {
      results.push({
        cmd: item.cmd,
        status: null,
        skip: 'HEAVY_OR_RARE_SPECIMEN_CMD',
        note: 'existence of script checked separately; full loop not run in this sweep',
      })
      continue
    }
    console.error(`RUN ${t.id}: ${item.cmd}`)
    const r = runCmd(item.cmd)
    r.forced_from_tree = !!item.forced_from_tree
    results.push(r)
    // Print match evidence immediately
    console.error(`  exit=${r.status} signal=${r.signal} err=${r.error}`)
    if (r.matched_not_ok?.length) console.error('  not ok matches:', r.matched_not_ok)
    if (r.matched_fail_n?.length) {
      console.error('  fail N matches (READ CONTEXT, not the number):')
      for (const m of r.matched_fail_n) console.error('   ', JSON.stringify(m))
    }
    for (const line of r.evidence.slice(-8)) console.error('  ev:', line)
  }
  runResults.push({ id: t.id, results })
}

// Classify
const findings = []
for (const t of tickets) {
  const fieldMissing = t.paths.filter((p) => p.in_fields && !p.exists_tree)
  const fieldResolves = t.paths.filter((p) => p.in_fields && p.exists_tree)
  // Understatement: fields say not checked in BUT a standard probe path exists on tree
  let understatement_real = false
  let understatement_path = null
  if (t.understatement_phrase_in_fields) {
    const guess = `e2e/proofs/${t.id.toLowerCase().replace('t-00', 't00').replace('t-0', 't0')}`
    // better: look for e2e/proofs/t00X-*
    const num = t.id.slice(2) // 001
    const n = String(Number(num))
    const hit = [...tree].find((p) => p.startsWith(`e2e/proofs/t${n.padStart(3, '0')}-`) || p.startsWith(`e2e/proofs/t${n}-`) || p.includes(`/t00${n.slice(-1)}-`) || p.includes(`/t0${n.slice(-1)}-`))
    // simpler map
    const known = {
      'T-005': 'e2e/proofs/t005-eperm-path-lock/probe.mjs',
      'T-007': 'e2e/proofs/t007-single-root/probe.mjs',
      'T-008': 'e2e/proofs/t008-per-process-lock/probe.mjs',
      'T-009': 'e2e/proofs/t009-rule11a-no-check/probe.mjs',
    }
    const k = known[t.id]
    if (k && tree.has(k)) {
      understatement_real = true
      understatement_path = k
    } else if (hit) {
      understatement_real = true
      understatement_path = hit
    }
  }
  const runs = runResults.find((r) => r.id === t.id)?.results || []
  findings.push({
    id: t.id,
    status: t.status,
    l1_proof: t.l1_proof,
    shortest_repro: t.shortest_repro,
    field_paths_resolve: fieldResolves.map((p) => p.path),
    field_paths_missing: fieldMissing.map((p) => p.path),
    understatement_phrase: t.understatement_phrase_in_fields,
    understatement_real,
    understatement_path,
    runs: runs.map((r) => ({
      cmd: r.cmd,
      status: r.status,
      skip: r.skip || null,
      forced_from_tree: r.forced_from_tree || false,
      matched_not_ok: r.matched_not_ok || [],
      matched_fail_n: r.matched_fail_n || [],
      evidence_tail: (r.evidence || r.tail || []).slice(-6),
      error: r.error || null,
    })),
  })
}

const report = {
  head: HEAD,
  generated: new Date().toISOString(),
  method:
    'Extract l1_proof + shortest_repro from frontmatter; path existence via git ls-tree HEAD; extract node/npm commands from fields+body; execute (skip heavy suites); print match evidence (not ok lines + fail N with context). Understatement = fields deny probe while tree has it.',
  findings,
  class_candidates: findings
    .filter((f) => f.understatement_real || f.field_paths_missing.length)
    .map((f) => ({
      id: f.id,
      kind: f.understatement_real ? 'understatement-probe-exists' : 'field-path-missing',
      detail: f.understatement_real ? f.understatement_path : f.field_paths_missing,
    })),
}

const outDir = join(ROOT, 'docs', 'decisions')
const outJson = join(outDir, 'ticket-l1-proof-sweep.json')
const outMd = join(outDir, 'ticket-l1-proof-sweep.md')
writeFileSync(outJson, JSON.stringify(report, null, 2), 'utf8')

const md = []
md.push('# Ticket l1_proof / shortest_repro sweep')
md.push('')
md.push(`HEAD checked: \`${HEAD}\``)
md.push(`Generated: ${report.generated}`)
md.push('')
md.push('## Method')
md.push('')
md.push(report.method)
md.push('')
md.push('Falcon rule carried: **READ WHAT MATCHED, NOT THE NUMBER IT GAVE YOU.** Fail-count regexes can match test names.')
md.push('')
md.push('## Class')
md.push('')
md.push('| subclass | meaning |')
md.push('|----------|---------|')
md.push('| understatement-probe-exists | fields say not checked in / no probe; tree has the probe |')
md.push('| field-path-missing | l1_proof/shortest_repro cites a path absent from origin/dev |')
md.push('| command-exit-unexpected | extracted command ran; exit or evidence contradicts claim |')
md.push('| heavy-skipped | full suite named; existence only this pass |')
md.push('')
md.push('Mirror of overclaim: ticket UNDERSTATES its own evidence. A triager re-derives measurement by hand — waste the probe existed to prevent.')
md.push('')
md.push('## Findings')
md.push('')

for (const f of findings) {
  md.push(`### ${f.id} (\`${f.status}\`)`)
  md.push('')
  md.push(`- **l1_proof:** ${f.l1_proof}`)
  md.push(`- **shortest_repro:** ${f.shortest_repro}`)
  md.push(
    `- **field paths RESOLVE:** ${f.field_paths_resolve.length ? f.field_paths_resolve.map((p) => '`' + p + '`').join(', ') : '_(none named)_'}`,
  )
  md.push(
    `- **field paths MISSING:** ${f.field_paths_missing.length ? f.field_paths_missing.map((p) => '`' + p + '`').join(', ') : '_none_'}`,
  )
  if (f.understatement_real) {
    md.push(`- **UNDERSTATEMENT:** fields deny probe; tree has \`${f.understatement_path}\``)
  } else if (f.understatement_phrase) {
    md.push(`- understatement phrase present but no matching tree probe found`)
  }
  if (f.runs.length) {
    md.push('- **commands:**')
    for (const r of f.runs) {
      if (r.skip) {
        md.push(`  - \`${r.cmd}\` → SKIP ${r.skip}`)
      } else {
        md.push(`  - \`${r.cmd}\` → exit=${r.status}${r.forced_from_tree ? ' (forced from tree)' : ''}`)
        if (r.matched_not_ok?.length) md.push(`    - not ok: ${r.matched_not_ok.map((x) => JSON.stringify(x)).join('; ')}`)
        if (r.matched_fail_n?.length) {
          for (const m of r.matched_fail_n) {
            md.push(`    - fail-N match: \`${m.line}\` ctx: ${JSON.stringify(m.ctx)}`)
          }
        }
        for (const line of r.evidence_tail || []) md.push(`    - ev: ${line}`)
      }
    }
  }
  md.push('')
}

md.push('## Actionable')
md.push('')
if (!report.class_candidates.length) {
  md.push('_none_')
} else {
  for (const c of report.class_candidates) {
    md.push(`- **${c.id}** ${c.kind}: ${JSON.stringify(c.detail)}`)
  }
}
md.push('')

writeFileSync(outMd, md.join('\n'), 'utf8')
console.log(JSON.stringify({ head: HEAD, class_candidates: report.class_candidates, n: findings.length }, null, 2))
console.log('wrote', outMd)
