/**
 * MANUAL DIAGNOSTIC — citation existence sweep (docs/decisions + docs/tickets vs git tree).
 * Existence only. Not a green-suite gate. Hand-run report generator.
 *
 *   node scripts/cite-existence.mjs
 */
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname, posix, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SCOPES = [
  { dir: join(ROOT, 'docs', 'decisions'), label: 'decisions' },
  { dir: join(ROOT, 'docs', 'tickets'), label: 'tickets' },
]

// Do not scan our own outputs (contamination).
const SKIP_FILES = new Set([
  'citation-existence-sweep.md',
  'citation-existence-sweep.json',
])

// Root docs often cited bare.
const ROOT_DOCS = new Set([
  'CODE_VERIFY.md',
  'E2E.md',
  'AGENT_PIPELINE.md',
  'AGENTS_ROLES.md',
  'AGENT_PROTOCOL.md',
  'README.md',
  'CLAUDE.md',
  'package.json',
])

const PATHISH = [
  // repo-rooted backtick paths
  /`((?:docs|src|e2e|scripts|public|data|\.claude|\.github)\/[^`\n]+?)`/g,
  // markdown local links
  /\[[^\]]*\]\(((?:docs|src|e2e|scripts|\.\/|\.\.\/)[^)\s]+|\.?\.?\/?[\w./-]+\.md)\)/g,
  // bare *.md in backticks (decision/ticket cross-refs) — NOT bare .tsx/.ts
  /`([A-Za-z0-9_.@+-]+\.md)`/g,
  // bare root doc names already in ROOT_DOCS via md pattern
  // e2e/proofs and scripts with extension, non-backtick
  /(?<![A-Za-z0-9_/`])((?:docs|src|e2e|scripts)\/[A-Za-z0-9_./@+-]+\.[A-Za-z0-9.]+)/g,
]

function loadTree() {
  const out = execSync('git ls-tree -r --name-only HEAD', {
    cwd: ROOT,
    encoding: 'utf8',
  })
  const files = new Set(
    out
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((p) => p.replace(/\\/g, '/')),
  )
  const dirs = new Set()
  const byBase = new Map()
  for (const p of files) {
    const parts = p.split('/')
    for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join('/'))
    const b = parts[parts.length - 1]
    if (!byBase.has(b)) byBase.set(b, [])
    byBase.get(b).push(p)
  }
  return { files, dirs, byBase }
}

function stripNoise(raw) {
  let s = String(raw).trim()
  s = s.replace(/^['"]|['"]$/g, '')
  s = s.replace(/[.,;:)\]]+$/g, '')
  s = s.replace(/#L\d+([-:]\d+)?$/i, '')
  s = s.replace(/:\d+([–—-]\d+)?(:\d+)?$/, '')
  s = s.replace(/\s+§.*$/, '')
  s = s.replace(/\\/g, '/')
  if (s.startsWith('./')) s = s.slice(2)
  return s
}

function isSkip(p) {
  if (!p || p.length < 3) return true
  if (/^https?:\/\//i.test(p) || /^mailto:/i.test(p) || p.startsWith('#')) return true
  if (/^origin\//.test(p) || /^[0-9a-f]{7,40}$/i.test(p)) return true
  if (/^(npm|node|git|mklink)\b/i.test(p)) return true
  if (/<|>|\{|\}|T-###/.test(p)) return true
  if (p.includes('*') || p.includes('…')) return false // glob class later
  // bare non-md without slash is not a path claim in this pass
  if (!p.includes('/') && !p.endsWith('.md') && !ROOT_DOCS.has(p)) return true
  return false
}

function candidates(fromFile, cited) {
  const out = []
  const push = (p) => {
    if (!p) return
    const n = posix.normalize(p.replace(/\\/g, '/')).replace(/^\//, '').replace(/\/$/, '')
    // posix.normalize may leave ..
    if (n.includes('..')) {
      // resolve against fromFile
      const joined = posix.normalize(posix.join(posix.dirname(fromFile), p))
      if (!joined.startsWith('..') && !out.includes(joined)) out.push(joined)
      return
    }
    if (!out.includes(n)) out.push(n)
  }

  push(cited)

  if (cited.startsWith('../') || cited.startsWith('./')) {
    push(posix.normalize(posix.join(posix.dirname(fromFile), cited)))
  }

  if (!cited.includes('/')) {
    push(posix.join(posix.dirname(fromFile), cited))
    if (ROOT_DOCS.has(cited) || cited.endsWith('.md')) {
      push(posix.join('docs', cited))
      push(posix.join('docs', 'decisions', cited))
      push(posix.join('docs', 'tickets', cited))
      push(posix.join('docs', 'design', cited))
      push(cited)
    }
  }

  if (cited.startsWith('tickets/')) push(posix.join('docs', cited))
  if (cited.startsWith('decisions/')) push(posix.join('docs', cited))
  if (cited.startsWith('design/')) push(posix.join('docs', cited))

  return out
}

function isGitignoredPath(p) {
  if (p === 'data' || p.startsWith('data/')) return true
  if (p === 'e2e/output' || p.startsWith('e2e/output/')) return true
  if (p.startsWith('_land_run/')) return true
  return false
}

function classify(cands, tree, cited) {
  if (cited.includes('*') || cited.includes('…') || cited.includes('...')) {
    return { cls: 'GLOB', path: cited }
  }
  for (const p of cands) {
    if (tree.files.has(p)) return { cls: 'RESOLVES', path: p }
    if (tree.dirs.has(p)) return { cls: 'RESOLVES_DIR', path: p }
  }
  for (const p of cands) {
    if (isGitignoredPath(p)) return { cls: 'GITIGNORED', path: p }
  }
  // basename unique match for full path citations that used wrong prefix? only if cited has slash
  if (cited.includes('/')) {
    const b = basename(cited)
    const hits = tree.byBase.get(b) || []
    if (hits.length === 1) return { cls: 'RESOLVES_BASENAME', path: hits[0], noted: `cited ${cited}` }
  }
  return { cls: 'MISSING', path: cands[0] || cited }
}

function extractFromText(text, fromFile) {
  const found = new Map()
  const lines = text.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    for (const re of PATHISH) {
      re.lastIndex = 0
      let m
      while ((m = re.exec(line)) !== null) {
        const p = stripNoise(m[1])
        if (isSkip(p)) continue
        if (!found.has(p)) found.set(p, { lines: new Set() })
        found.get(p).lines.add(i + 1)
      }
    }
  }
  return found
}

function triage(path, cited) {
  if (/falcon-mut|_t00\d_/.test(path) || /falcon-mut|_t00\d_/.test(cited)) {
    return 'throwaway-or-worktree-probe'
  }
  if (path.startsWith('.claude/') || path.startsWith('.agents/') || path.startsWith('.cursor/') || path.startsWith('.codex/') || path.startsWith('.jcode/')) return 'harness-path-in-tracked-doc'
  if (
    /e2e\/(density-audit|ia-final-qa|ia-step1-qa)\.mjs$/.test(path) ||
    /e2e\/(density-audit|ia-final-qa|ia-step1-qa)\.mjs$/.test(cited)
  ) {
    return 'probe-script-not-shipped'
  }
  if (path.startsWith('docs/design/') || cited.startsWith('docs/design/')) return 'design-doc-missing'
  if (path.endsWith('.png') || path.endsWith('.webp') || path.endsWith('.jpg')) {
    return 'screenshot-basename-or-missing'
  }
  if (path.endsWith('.json') && !path.includes('/')) return 'local-artifact-basename'
  return 'unresolved-path'
}

function main() {
  const tree = loadTree()
  const head = execSync('git rev-parse --short HEAD', { cwd: ROOT, encoding: 'utf8' }).trim()
  const buckets = {
    RESOLVES: [],
    RESOLVES_DIR: [],
    RESOLVES_BASENAME: [],
    GITIGNORED: [],
    GLOB: [],
    MISSING: [],
  }
  const byFile = []

  for (const scope of SCOPES) {
    if (!existsSync(scope.dir)) continue
    for (const f of readdirSync(scope.dir).filter((x) => x.endsWith('.md')).sort()) {
      if (SKIP_FILES.has(f)) continue
      const repoPath = posix.join('docs', scope.label, f)
      const text = readFileSync(join(scope.dir, f), 'utf8')
      const cites = extractFromText(text, repoPath)
      const fileReport = { file: repoPath, missing: [], gitignored: [], resolves: 0 }

      for (const [cited, meta] of [...cites.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
        const cands = candidates(repoPath, cited)
        const { cls, path, noted } = classify(cands, tree, cited)
        const entry = {
          cited,
          resolved_as: path,
          cls,
          noted: noted || null,
          lines: [...meta.lines].sort((a, b) => a - b),
          file: repoPath,
        }
        buckets[cls].push(entry)
        if (cls === 'MISSING') fileReport.missing.push(entry)
        else if (cls === 'GITIGNORED') fileReport.gitignored.push(entry)
        else fileReport.resolves++
      }
      byFile.push(fileReport)
    }
  }

  function unique(list) {
    const m = new Map()
    for (const e of list) {
      const k = e.resolved_as
      if (!m.has(k)) m.set(k, [])
      m.get(k).push(e)
    }
    return [...m.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([path, hits]) => ({
        path,
        cited_as: [...new Set(hits.map((h) => h.cited))],
        cited_in: hits.map((h) => `${h.file}:${h.lines.join(',')}`),
        triage: triage(path, hits[0].cited),
      }))
  }

  const uniqueMissing = unique(buckets.MISSING)
  const uniqueIgnored = unique(buckets.GITIGNORED)
  const byTriage = new Map()
  for (const m of uniqueMissing) {
    if (!byTriage.has(m.triage)) byTriage.set(m.triage, [])
    byTriage.get(m.triage).push(m)
  }

  const report = {
    head,
    generated: new Date().toISOString(),
    method:
      'existence-only; path-rooted + bare *.md + md links; same-dir/docs resolution; e2e/output+data = GITIGNORED; bare source basenames excluded',
    totals: {
      files_scanned: byFile.length,
      resolves:
        buckets.RESOLVES.length + buckets.RESOLVES_DIR.length + buckets.RESOLVES_BASENAME.length,
      missing_citations: buckets.MISSING.length,
      unique_missing: uniqueMissing.length,
      gitignored_citations: buckets.GITIGNORED.length,
      unique_gitignored: uniqueIgnored.length,
      glob: buckets.GLOB.length,
      basename_rescue: buckets.RESOLVES_BASENAME.length,
    },
    unique_missing: uniqueMissing,
    unique_gitignored_sample: uniqueIgnored.slice(0, 20),
    by_file_missing: byFile
      .filter((f) => f.missing.length)
      .map((f) => ({
        file: f.file,
        missing: f.missing.map((m) => ({
          cited: m.cited,
          resolved_as: m.resolved_as,
          lines: m.lines,
          triage: triage(m.resolved_as, m.cited),
        })),
      })),
  }

  const outJson = join(ROOT, 'docs', 'decisions', 'citation-existence-sweep.json')
  const outMd = join(ROOT, 'docs', 'decisions', 'citation-existence-sweep.md')
  writeFileSync(outJson, JSON.stringify(report, null, 2), 'utf8')

  const md = []
  md.push('# Citation existence sweep')
  md.push('')
  md.push(`HEAD checked: \`${head}\``)
  md.push(`Generated: ${report.generated}`)
  md.push('')
  md.push('## Method')
  md.push('')
  md.push('- Scope: `docs/decisions/*`, `docs/tickets/*` (excludes this report file)')
  md.push('- Existence only against `git ls-tree HEAD`')
  md.push('- Extracts: repo-rooted paths (`docs|src|e2e|scripts|...`), markdown local links, bare `*.md` cross-refs')
  md.push('- Does **not** treat bare `Foo.tsx` basenames as path claims (prose component names)')
  md.push('- Bare `*.md` resolves: same directory → `docs/` → `docs/decisions|tickets|design/`')
  md.push('- `e2e/output/**`, `data/**` → **GITIGNORED** (local artifacts by design)')
  md.push('- Not doc-vs-code claim checking')
  md.push('')
  md.push('## Totals')
  md.push('')
  md.push('| metric | n |')
  md.push('|--------|---|')
  md.push(`| files scanned | ${report.totals.files_scanned} |`)
  md.push(`| citations RESOLVES | ${report.totals.resolves} |`)
  md.push(`| citations MISSING | ${report.totals.missing_citations} |`)
  md.push(`| unique MISSING paths | ${report.totals.unique_missing} |`)
  md.push(`| citations GITIGNORED | ${report.totals.gitignored_citations} |`)
  md.push(`| unique GITIGNORED | ${report.totals.unique_gitignored} |`)
  md.push(`| basename rescue | ${report.totals.basename_rescue} |`)
  md.push(`| GLOB | ${report.totals.glob} |`)
  md.push('')
  md.push('## Unique MISSING (actionable)')
  md.push('')
  if (!uniqueMissing.length) {
    md.push('(none)')
  } else {
    for (const [triageName, items] of [...byTriage.entries()].sort((a, b) =>
      a[0].localeCompare(b[0]),
    )) {
      md.push(`### ${triageName} (${items.length})`)
      md.push('')
      md.push('| path | cited in |')
      md.push('|------|----------|')
      for (const m of items) {
        const where = m.cited_in
          .slice(0, 8)
          .map((c) => `\`${c}\``)
          .join('<br>')
        const more = m.cited_in.length > 8 ? `<br>…+${m.cited_in.length - 8}` : ''
        md.push(`| \`${m.path}\` | ${where}${more} |`)
      }
      md.push('')
    }
  }
  md.push('## GITIGNORED (not broken tracked citations)')
  md.push('')
  md.push(
    `Count: **${report.totals.unique_gitignored}** unique paths (**${report.totals.gitignored_citations}** citations). Roots: \`e2e/output/\`, \`data/\`.`,
  )
  md.push('')
  md.push(
    'A decision that *requires* a reader to open a gitignored screenshot is a process smell, but it is not the same disease as citing a tracked path that does not exist.',
  )
  md.push('')
  md.push('## Follow-up (harness-path class)')
  md.push('')
  md.push('A TRACKED DOC MUST NOT CITE A LOCAL-ONLY HARNESS PATH. Distinct from other missing entries: those could exist; a harness path must not. Rule: docs/AGENTS_ROLES.md § AI harness stays local.')
  md.push('')
  md.push('## Class')
  md.push('')
  md.push('Same disease as ticket-cited probes that live only in a worktree: a reader cannot open the evidence.')
  md.push('Existence is cheaper than execution.')
  md.push('')
  md.push('| subclass | meaning |')
  md.push('|----------|---------|')
  md.push('| throwaway-or-worktree-probe | `_t00x_*`, `falcon-mut*` not on origin/dev |')
  md.push('| probe-script-not-shipped | audit drivers named in decisions, absent from tree |')
  md.push('| design-doc-missing | `docs/design/...` cited, not present |')
  md.push('| harness-path-in-tracked-doc | tracked doc cites local-only AI harness (must not; never ship to fix) |')
  md.push('| GITIGNORED | local output by design (separate bucket) |')
  md.push('')
  md.push('## Tickets re-pass note')
  md.push('')
  md.push('T-007/T-008 probe scripts: if still missing after falcon land, they remain throwaway-or-worktree-probe.')
  md.push('T-009 `e2e/proofs/t009-rule11a-no-check/probe.mjs` should RESOLVE if on tip.')
  md.push('')

  writeFileSync(outMd, md.join('\n'), 'utf8')

  console.log(JSON.stringify(report.totals, null, 2))
  console.log('\nMISSING by triage:')
  for (const [t, items] of [...byTriage.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`  ${t}: ${items.length}`)
    for (const m of items) {
      console.log(`    - ${m.path}`)
      for (const c of m.cited_in.slice(0, 3)) console.log(`        ${c}`)
    }
  }
  console.log(`\nwrote ${outMd}`)
}

main()
