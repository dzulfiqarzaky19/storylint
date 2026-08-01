/**
 * MANUAL DIAGNOSTIC — audit storylint worktrees before cleanup.
 *
 * A worktree is safe to remove only when nothing exists ONLY there. Work hides in:
 *   1. modified tracked files
 *   2. untracked files never added
 *   3. local commits whose PATCHES are not on origin/dev
 *
 * (3) is the one that bites: `--merged` and `--is-ancestor` both lie here,
 * because land uses --no-ff bubbles, so a fully landed branch tip usually is
 * NOT an ancestor of dev. Compare patch identity (--cherry-pick) instead.
 *
 * NOTE: `git stash` is REPO-GLOBAL, not per-worktree. An earlier version of this
 * script printed stash=29 on all 22 worktrees and made every one look like it
 * held work. That is one shared list of 29, counted once here.
 */
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const ROOT = 'D:\\dev\\projects'
const dirs = fs
  .readdirSync(ROOT, { withFileTypes: true })
  .filter((d) => d.isDirectory() && /^storylint/i.test(d.name))
  .map((d) => path.join(ROOT, d.name))

function git(cwd, args) {
  try {
    return execSync(`git ${args}`, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  } catch {
    return null
  }
}

const rows = []
for (const dir of dirs) {
  if (!fs.existsSync(path.join(dir, '.git'))) {
    rows.push({ dir, state: 'NOT-A-REPO' })
    continue
  }

  const branch = git(dir, 'rev-parse --abbrev-ref HEAD') || '(detached)'
  const status = (git(dir, 'status --porcelain') || '').split('\n').filter(Boolean)
  const modified = status.filter((l) => !l.startsWith('??'))
  const untracked = status.filter((l) => l.startsWith('??'))

  const unlandedRaw = git(dir, 'log --oneline --cherry-pick --right-only --no-merges origin/dev...HEAD')
  const unlanded = unlandedRaw ? unlandedRaw.split('\n').filter(Boolean) : []

  const trapped = modified.length > 0 || untracked.length > 0 || unlanded.length > 0
  rows.push({
    dir,
    branch,
    modified,
    untracked,
    unlanded,
    state: trapped ? 'HOLDS-WORK' : 'MERGED-CLEAN',
  })
}

const clean = rows.filter((r) => r.state === 'MERGED-CLEAN')
const holds = rows.filter((r) => r.state === 'HOLDS-WORK')
const notRepo = rows.filter((r) => r.state === 'NOT-A-REPO')

console.log(`\n=== HOLDS WORK — ${holds.length} (read before removing)`)
for (const r of holds) {
  console.log(`\n  ${path.basename(r.dir)}  [${r.branch}]`)
  if (r.unlanded.length) {
    console.log(`    UNLANDED COMMITS (${r.unlanded.length}) — content not on origin/dev:`)
    for (const c of r.unlanded.slice(0, 6)) console.log(`      ${c}`)
  }
  if (r.modified.length) {
    console.log(`    modified (${r.modified.length}):`)
    for (const c of r.modified.slice(0, 6)) console.log(`      ${c}`)
  }
  if (r.untracked.length) {
    console.log(`    untracked (${r.untracked.length}):`)
    for (const c of r.untracked.slice(0, 8)) console.log(`      ${c}`)
  }
}

console.log(`\n=== MERGED + CLEAN — ${clean.length} (branch content is on dev; safe to remove)`)
for (const r of clean) console.log(`  ${path.basename(r.dir).padEnd(32)} ${r.branch}`)

console.log(`\n=== NOT A GIT REPO — ${notRepo.length} (stale copies, no branch at all)`)
for (const r of notRepo) console.log(`  ${path.basename(r.dir)}`)

// Stash is repo-global: read it once from the main checkout.
const main = path.join(ROOT, 'storylint')
const stash = git(main, 'stash list')
const stashCount = stash ? stash.split('\n').filter(Boolean).length : 0
console.log(`\n=== SHARED STASH (repo-global, not per-worktree): ${stashCount} entries`)

console.log(`\ntotal=${rows.length} merged-clean=${clean.length} holds=${holds.length} not-repo=${notRepo.length}`)
