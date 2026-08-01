/**
 * GATE A — proof artifact provenance stamp.
 *
 * A proof that says PASS but cannot name the code that produced it is not evidence
 * (standing rule 1). Every writer under e2e/proofs must stamp:
 *   head SHA, worktree_dirty, exact command, exit code, timestamp
 *
 * Use writeProofArtifact / formatProvenanceStamp. Do not hand-roll partial headers.
 *
 * Decision (what this gate is / is not):
 *   Detects unstamped and malformed artifacts, and accidental non-existent SHAs
 *   (git cat-file must resolve head to a commit/tag). Provenance is a self-report
 *   with a well-formedness gate — it does NOT prove the producer told the truth
 *   about head/dirty/exit, and it is not a defence against a dishonest author.
 *   Value: catches mistakes (wrong or missing identity on a PASS claim), not lies.
 *
 * Scan scope: data artifacts only. Companion source under e2e/proofs (*.mjs / *.cjs
 * / *.js) is skipped by listProofArtifactRels — probes are code, not proof claims.
 * Dropping an unstamped .md/.txt/.json/.jsonl/.output/.log goes red; a .mjs does not.
 */
import { execSync } from 'node:child_process'
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  readdirSync,
  statSync,
} from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT_DEFAULT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export const PROVENANCE_BEGIN = '--- proof-provenance ---'
export const PROVENANCE_END = '--- end-proof-provenance ---'

/** @param {string} [root] */
export function readGitProvenance(root = ROOT_DEFAULT) {
  try {
    const head = execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf8' }).trim()
    const porcelain = execSync('git status --porcelain', { cwd: root, encoding: 'utf8' })
    return {
      head,
      worktree_dirty: porcelain.trim().length > 0,
    }
  } catch (error) {
    throw new Error(
      `cannot read git provenance under ${root}: ${error instanceof Error ? error.message : error}`,
    )
  }
}

/**
 * True when git cat-file -t <sha> is commit or tag.
 * @param {string} head
 * @param {string} [root]
 */
export function headResolvesToObject(head, root = ROOT_DEFAULT) {
  if (!/^[0-9a-f]{7,40}$/i.test(head)) return false
  try {
    const kind = execSync(`git cat-file -t ${head}`, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    return kind === 'commit' || kind === 'tag'
  } catch {
    return false
  }
}

/**
 * @param {{
 *   root?: string,
 *   command: string,
 *   exit: number,
 *   timestamp?: string,
 *   head?: string,
 *   worktree_dirty?: boolean,
 * }} input
 * @returns {{ head: string, worktree_dirty: boolean, command: string, exit: number, timestamp: string }}
 */
export function collectProvenance(input) {
  const root = input.root ?? ROOT_DEFAULT
  if (typeof input.command !== 'string' || !input.command.trim()) {
    throw new Error('collectProvenance: command is required (exact invocation string)')
  }
  if (!Number.isFinite(input.exit)) {
    throw new Error('collectProvenance: exit must be a number')
  }
  const hasHead = input.head !== undefined
  const hasDirty = input.worktree_dirty !== undefined
  if (hasHead !== hasDirty) {
    throw new Error(
      'collectProvenance: head and worktree_dirty must both be supplied or both omitted (no mixed self-report / measured stamp)',
    )
  }
  const git = hasHead
    ? { head: input.head, worktree_dirty: Boolean(input.worktree_dirty) }
    : readGitProvenance(root)
  return {
    head: git.head,
    worktree_dirty: git.worktree_dirty,
    command: input.command.trim(),
    exit: Number(input.exit),
    timestamp: input.timestamp ?? new Date().toISOString(),
  }
}

/**
 * Machine-parseable stamp block. Always includes all five required fields.
 * @param {{ head: string, worktree_dirty: boolean, command: string, exit: number, timestamp: string }} p
 */
export function formatProvenanceStamp(p) {
  const dirty = p.worktree_dirty ? 'true' : 'false'
  return [
    PROVENANCE_BEGIN,
    `head: ${p.head}`,
    `worktree_dirty: ${dirty}`,
    `command: ${p.command}`,
    `exit: ${p.exit}`,
    `timestamp: ${p.timestamp}`,
    PROVENANCE_END,
    '',
  ].join('\n')
}

/**
 * Parse first provenance block in text. Returns null if missing/incomplete.
 * @param {string} text
 * @returns {{ head: string, worktree_dirty: boolean, command: string, exit: number, timestamp: string } | null}
 */
export function parseProvenanceStamp(text) {
  const begin = text.indexOf(PROVENANCE_BEGIN)
  if (begin < 0) return null
  const afterBegin = begin + PROVENANCE_BEGIN.length
  const end = text.indexOf(PROVENANCE_END, afterBegin)
  if (end < 0) return null
  const block = text.slice(afterBegin, end)
  /** @type {Record<string, string>} */
  const fields = {}
  for (const line of block.split(/\r?\n/)) {
    const m = line.match(/^\s*([a-z_]+):\s*(.*)\s*$/i)
    if (!m) continue
    fields[m[1]] = m[2]
  }
  const required = ['head', 'worktree_dirty', 'command', 'exit', 'timestamp']
  for (const key of required) {
    if (fields[key] === undefined || fields[key] === '') return null
  }
  if (fields.worktree_dirty !== 'true' && fields.worktree_dirty !== 'false') return null
  const exit = Number(fields.exit)
  if (!Number.isFinite(exit)) return null
  return {
    head: fields.head,
    worktree_dirty: fields.worktree_dirty === 'true',
    command: fields.command,
    exit,
    timestamp: fields.timestamp,
  }
}

/**
 * @param {string} text
 * @param {{ root?: string, requireResolvableHead?: boolean }} [opts]
 */
export function validateProvenanceStamp(text, opts = {}) {
  const root = opts.root ?? ROOT_DEFAULT
  const parsed = parseProvenanceStamp(text)
  if (!parsed) {
    return { ok: false, reason: 'missing or incomplete proof-provenance block' }
  }
  if (opts.requireResolvableHead !== false && !headResolvesToObject(parsed.head, root)) {
    return {
      ok: false,
      reason: `head does not resolve to a git commit/tag: ${parsed.head}`,
      parsed,
    }
  }
  return { ok: true, parsed }
}

/**
 * Write a proof file with provenance stamp prepended to body.
 * @param {string} filePath absolute or repo-relative
 * @param {{ body: string, command: string, exit: number, root?: string, timestamp?: string }} opts
 */
export function writeProofArtifact(filePath, opts) {
  const root = opts.root ?? ROOT_DEFAULT
  const abs = resolve(root, filePath)
  mkdirSync(dirname(abs), { recursive: true })
  const stamp = formatProvenanceStamp(
    collectProvenance({
      root,
      command: opts.command,
      exit: opts.exit,
      timestamp: opts.timestamp,
    }),
  )
  const body = opts.body.startsWith('\n') ? opts.body : `\n${opts.body}`
  writeFileSync(abs, stamp + body, 'utf8')
  return abs
}

/**
 * List proof artifact paths relative to root (posix).
 * Skips companion source under proofs (*.mjs) by default.
 * @param {{ root?: string, includeSource?: boolean }} [opts]
 * @returns {string[]}
 */
export function listProofArtifactRels(opts = {}) {
  const root = opts.root ?? ROOT_DEFAULT
  const dir = resolve(root, 'e2e/proofs')
  const includeSource = opts.includeSource === true
  /** @type {string[]} */
  const out = []
  if (!existsSync(dir)) return out

  /** @param {string} d */
  function walk(d) {
    for (const name of readdirSync(d)) {
      const p = resolve(d, name)
      if (statSync(p).isDirectory()) {
        walk(p)
        continue
      }
      if (!includeSource && /\.(mjs|cjs|js)$/i.test(name)) continue
      const rel = p.slice(root.length + 1).split(/[/\\]/).join('/')
      out.push(rel)
    }
  }
  walk(dir)
  return out.sort()
}

export { readFileSync, ROOT_DEFAULT }
