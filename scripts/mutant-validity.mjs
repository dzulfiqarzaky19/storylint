/**
 * GATE B — mutant validity preamble (standing 8d as a control).
 *
 * Before any mutant suite run, assert four legs and abort as MUTANT_INVALID
 * (exit 2) otherwise — distinct from exit 1 (test failure / real death):
 *
 *   1. BUILD succeeds (optional but recommended when product TS is in play)
 *   2. ANCHOR was FOUND (the thing you meant to change existed)
 *   3. PROPERTY is verifiably GONE from the mutated source
 *   4. SUITE ran a nonzero test count AND the count was PARSED, not assumed
 *      (assertSuiteRan). A survival against a suite that did not run is pure
 *      not-measured.
 *
 * Sibling guidance (not a fifth leg — cannot assert mechanically; 8f):
 *   A MUTANT THAT KILLS A WHOLE CONSTRUCT DOES NOT PROVE ITS PARTS ARE COVERED.
 *   For alternations, boolean chains, and lists: mutate ONE ARM AT A TIME.
 *   Fixtures must isolate one marker per case. A whole-regex neuter that dies
 *   can flatter two unprotected arms (falcon/hawk E1 LOCAL_STEP_RE).
 *
 * Shape from hawk's per-mutant throwaways (no library existed to import).
 * Instances that burned us today:
 *   - partial .replace left a second MANUAL DIAGNOSTIC token (leg 3)
 *   - two-marker fixture flattered a whole-regex neuter (leg 3 / granularity)
 *   - TAP parse "fail count ?" misread as survival (leg 4)
 *   - literal template anchors miss after indent normalisation (leg 2)
 *   - node:test summary lines use the info glyph (tests N), not only "# tests"
 *
 * Header contract (measured / named so future legs re-check):
 *   1. LEG INDEPENDENCE IS MEASURED, not assumed. hawk @ GATE B land:
 *      neutering leg1/2/3 each fails only its own test(s); collateral ZERO.
 *      Re-check when adding a fifth leg.
 *   2. HAPPY-PATH GUARDS OVER-REJECTION. Reject tests catch under-throw;
 *      only happy path catches throw-for-everything. Do not trim it.
 *   3. COUNT CHECK = TOO-LITTLE / TOO-MUCH PAIR. expectedRemovals /
 *      expectedRemaining exist because a mutant can remove too little
 *      (8d false survival) OR too much (whole-construct kill flattering
 *      the fixture). The machine cannot choose grain; it can refuse a
 *      mutant that removed 2 when you declared 1.
 *   4. THE VERDICT PREDICATE IS UNTESTED CODE (hawk item 15). Gate B
 *      validates the mutant. Nothing validates the checker's own
 *      pass/fail sentence. Four green legs != a correct answer.
 *
 * @see docs/decisions/mutation-must-build.md (8d)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

/** Distinct from 1 = test failure. Broken appliers must never look like deaths. */
export const MUTANT_INVALID_EXIT = 2

export class MutantInvalidError extends Error {
  /**
   * @param {string} reason short machine-stable token, e.g. ANCHOR_NOT_FOUND
   * @param {Record<string, unknown>} [details]
   */
  constructor(reason, details = {}) {
    super(reason)
    this.name = 'MutantInvalidError'
    this.code = 'MUTANT_INVALID'
    this.reason = reason
    this.details = details
  }
}

/**
 * Count occurrences of a property in source.
 * @param {string} src
 * @param {string | RegExp | ((src: string) => number)} property
 */
export function countProperty(src, property) {
  if (typeof property === 'function') return property(src)
  if (property instanceof RegExp) {
    const flags = property.flags.includes('g') ? property.flags : property.flags + 'g'
    const re = new RegExp(property.source, flags)
    return (src.match(re) || []).length
  }
  if (typeof property === 'string') {
    if (!property) return 0
    let n = 0
    let i = 0
    while ((i = src.indexOf(property, i)) !== -1) {
      n += 1
      i += property.length
    }
    return n
  }
  throw new TypeError('property must be string | RegExp | function')
}

/**
 * Locate anchor in source by content predicate (preferred), string, or RegExp.
 * Never anchor by a full multi-line template that indent-normalisation can break.
 *
 * @param {string} src
 * @param {string | RegExp | ((src: string, lines: string[]) => number)} anchor
 *   function returns line index (>=0) or -1; string/RegExp search first match line
 * @returns {{ index: number, line: string, lineNo: number }}
 */
export function findAnchor(src, anchor) {
  const lines = src.split('\n')
  if (typeof anchor === 'function') {
    const index = anchor(src, lines)
    if (!Number.isInteger(index) || index < 0 || index >= lines.length) {
      return { index: -1, line: '', lineNo: -1 }
    }
    return { index, line: lines[index], lineNo: index + 1 }
  }
  if (typeof anchor === 'string') {
    const index = lines.findIndex((l) => l.includes(anchor))
    if (index < 0) return { index: -1, line: '', lineNo: -1 }
    return { index, line: lines[index], lineNo: index + 1 }
  }
  if (anchor instanceof RegExp) {
    // Prefer line-wise so multi-line regex spans do not pretend to be one line.
    const index = lines.findIndex((l) => anchor.test(l))
    if (index >= 0) return { index, line: lines[index], lineNo: index + 1 }
    // Fall back to whole-source match → first line of match.
    const m = src.match(anchor)
    if (!m || m.index == null) return { index: -1, line: '', lineNo: -1 }
    const before = src.slice(0, m.index)
    const lineNo = before.split('\n').length
    return { index: lineNo - 1, line: lines[lineNo - 1] ?? '', lineNo }
  }
  throw new TypeError('anchor must be string | RegExp | function')
}

/**
 * Parse node:test / TAP summary counts from combined stdout+stderr.
 * Accepts both "ℹ tests N" and "# tests N" forms.
 * @param {string} output
 * @returns {{ tests: number | null, pass: number | null, fail: number | null }}
 */
export function parseSuiteCounts(output) {
  const text = String(output ?? '')
  const grab = (label) => {
    const m =
      text.match(new RegExp(`(?:ℹ|#)\\s*${label}\\s+(\\d+)`, 'i')) ||
      text.match(new RegExp(`^#\\s*${label}\\s+(\\d+)\\s*$`, 'im'))
    return m ? Number(m[1]) : null
  }
  return {
    tests: grab('tests'),
    pass: grab('pass'),
    fail: grab('fail'),
  }
}

/**
 * Leg 4: suite must have been observed to run a nonzero number of tests.
 * @param {string} output
 * @param {string} [label]
 */
export function assertSuiteRan(output, label = 'suite') {
  const counts = parseSuiteCounts(output)
  if (counts.tests == null) {
    throw new MutantInvalidError('SUITE_COUNTS_UNPARSED', { label, counts })
  }
  if (counts.tests === 0) {
    throw new MutantInvalidError('SUITE_RAN_ZERO_TESTS', { label, counts })
  }
  return counts
}

/**
 * Run a build command. Default: `npm run build` in cwd.
 * @param {{ cwd?: string, command?: string, args?: string[], env?: NodeJS.ProcessEnv }} [opts]
 * @returns {{ ok: boolean, exit: number, output: string }}
 */
export function runBuild(opts = {}) {
  const command = opts.command ?? (process.platform === 'win32' ? 'npm.cmd' : 'npm')
  const args = opts.args ?? ['run', 'build']
  const r = spawnSync(command, args, {
    cwd: opts.cwd,
    env: opts.env ?? process.env,
    encoding: 'utf8',
    // Do not set shell:true — args are not escaped under shell (DEP0190).
    // npm.cmd resolves via PATHEXT on Windows without a shell.
  })
  const output = `${r.stdout ?? ''}${r.stderr ?? ''}`
  const exit = r.status == null ? (r.error ? 1 : 0) : r.status
  return { ok: exit === 0, exit, output }
}

/**
 * Apply a mutant with 8d validity legs. Writes the file only after all checks pass.
 *
 * @param {object} opts
 * @param {string} opts.path absolute or cwd-relative path to mutate
 * @param {string | RegExp | Function} opts.anchor content anchor (see findAnchor)
 * @param {(ctx: { src: string, lines: string[], index: number, line: string }) => string | { src?: string, lines?: string[] }} opts.mutate
 *   Return full new source string, OR { lines } / { src }. Must change the file.
 * @param {string | RegExp | ((src: string) => number)} opts.property
 *   Property that must be gone (count === 0) after mutation, OR use expectedRemaining.
 * @param {number} [opts.expectedRemaining=0] allowed remaining property count
 * @param {number} [opts.expectedRemovals] if set, require before-count - after-count === this
 * @param {boolean | (() => { ok: boolean, exit?: number, output?: string })} [opts.build=false]
 *   true → runBuild(); function → custom; false/omit → skip build leg
 * @param {boolean} [opts.log=true] print before/after + stripped line
 * @returns {{ before: string, after: string, removed: number, anchorLineNo: number }}
 */
export function applyMutant(opts) {
  const {
    path,
    anchor,
    mutate,
    property,
    expectedRemaining = 0,
    expectedRemovals,
    build = false,
    log = true,
  } = opts

  if (!path) throw new TypeError('applyMutant: path required')
  if (anchor == null) throw new TypeError('applyMutant: anchor required')
  if (typeof mutate !== 'function') throw new TypeError('applyMutant: mutate function required')
  if (property == null) throw new TypeError('applyMutant: property required')

  // --- leg 1: build ---
  if (build) {
    const result = typeof build === 'function' ? build() : runBuild()
    if (!result || result.ok !== true) {
      throw new MutantInvalidError('BUILD_FAILED', {
        exit: result?.exit,
        outputTail: String(result?.output ?? '').slice(-500),
      })
    }
    if (log) console.log(`BUILD_EXIT=0`)
  }

  const before = readFileSync(path, 'utf8')
  const beforeCount = countProperty(before, property)

  // --- leg 2: anchor found ---
  const hit = findAnchor(before, anchor)
  if (hit.index < 0) {
    throw new MutantInvalidError('ANCHOR_NOT_FOUND', { path })
  }
  if (log) {
    console.log(`anchor@${hit.lineNo}: ${hit.line.trim()}`)
  }

  const lines = before.split('\n')
  const mutated = mutate({
    src: before,
    lines: lines.slice(),
    index: hit.index,
    line: hit.line,
  })

  let after
  if (typeof mutated === 'string') {
    after = mutated
  } else if (mutated && typeof mutated === 'object') {
    if (typeof mutated.src === 'string') after = mutated.src
    else if (Array.isArray(mutated.lines)) after = mutated.lines.join('\n')
    else throw new TypeError('mutate must return string | { src } | { lines }')
  } else {
    throw new TypeError('mutate must return string | { src } | { lines }')
  }

  if (after === before) {
    throw new MutantInvalidError('MUTATION_NO_OP', { path, lineNo: hit.lineNo })
  }

  // --- leg 3: property gone (or reduced as claimed) ---
  const afterCount = countProperty(after, property)
  const removed = beforeCount - afterCount

  if (expectedRemovals != null) {
    if (removed !== expectedRemovals) {
      throw new MutantInvalidError('PROPERTY_NOT_REMOVED', {
        beforeCount,
        afterCount,
        removed,
        expectedRemovals,
        path,
      })
    }
  } else if (afterCount !== expectedRemaining) {
    throw new MutantInvalidError('PROPERTY_NOT_REMOVED', {
      beforeCount,
      afterCount,
      expectedRemaining,
      path,
    })
  }

  if (log) {
    console.log(
      `stripped ${removed} occurrence(s); property removed: verified (before=${beforeCount} after=${afterCount})`,
    )
  }

  writeFileSync(path, after)
  return {
    before,
    after,
    removed,
    anchorLineNo: hit.lineNo,
    beforeCount,
    afterCount,
  }
}

/**
 * Restore a file from a prior applyMutant().before snapshot.
 * @param {string} path
 * @param {string} before
 */
export function restoreMutant(path, before) {
  writeFileSync(path, before)
}

/**
 * Convenience: apply → run fn → always restore.
 * Does not catch MutantInvalidError (caller decides).
 *
 * @template T
 * @param {Parameters<typeof applyMutant>[0]} opts
 * @param {(info: ReturnType<typeof applyMutant>) => T} fn
 * @returns {T}
 */
export function withMutant(opts, fn) {
  const info = applyMutant(opts)
  try {
    return fn(info)
  } finally {
    restoreMutant(opts.path, info.before)
  }
}
