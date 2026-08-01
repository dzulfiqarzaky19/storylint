/**
 * MANUAL DIAGNOSTIC — remove storylint worktrees whose content is fully on dev.
 *
 * Safety: re-audits each target at removal time rather than trusting an earlier
 * report. A worktree that gained work between audit and delete must survive.
 *
 * Removes ONLY worktrees passing all four:
 *   - no modified tracked files
 *   - no untracked files
 *   - no commits whose patches are missing from origin/dev (--cherry-pick)
 *   - not the main checkout, not this one
 *
 * Dry run by default. Pass --apply to actually remove.
 */
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const APPLY = process.argv.includes('--apply')
const MAIN = 'D:\\dev\\projects\\storylint'
const SELF = 'D:\\dev\\projects\\storylint-rat-docs'

function git(cwd, args, quiet = true) {
  try {
    return execSync(`git ${args}`, {
      cwd,
      encoding: 'utf8',
      stdio: quiet ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    })
  } catch (e) {
    return null
  }
}

// Registered worktrees, from the main checkout.
const listing = git(MAIN, 'worktree list --porcelain') || ''
const worktrees = []
for (const block of listing.split(/\r?\n\r?\n/)) {
  const m = block.match(/^worktree (.+)$/m)
  if (m) worktrees.push(path.normalize(m[1].trim()))
}

const safe = []
const kept = []

for (const wt of worktrees) {
  const name = path.basename(wt)
  if (path.normalize(wt).toLowerCase() === MAIN.toLowerCase()) {
    kept.push([name, 'main checkout'])
    continue
  }
  if (path.normalize(wt).toLowerCase() === SELF.toLowerCase()) {
    kept.push([name, 'this agent worktree'])
    continue
  }
  // storylint-release tracks main. One main checkout is worth keeping: it lets
  // anyone read shipped state without disturbing a dev worktree.
  if (name.toLowerCase() === 'storylint-release') {
    kept.push([name, 'tracks main — kept deliberately'])
    continue
  }
  if (path.normalize(wt).toLowerCase().startsWith(MAIN.toLowerCase() + path.sep)) {
    kept.push([name, 'nested inside main checkout'])
    continue
  }
  if (!fs.existsSync(wt)) {
    kept.push([name, 'path missing (prune will handle)'])
    continue
  }

  const status = (git(wt, 'status --porcelain') || '').split('\n').filter(Boolean)
  if (status.length) {
    kept.push([name, `${status.length} uncommitted/untracked file(s)`])
    continue
  }

  const unlanded = (
    git(wt, 'log --oneline --cherry-pick --right-only --no-merges origin/dev...HEAD') || ''
  )
    .split('\n')
    .filter(Boolean)
  if (unlanded.length) {
    kept.push([name, `${unlanded.length} commit(s) not on origin/dev`])
    continue
  }

  safe.push(wt)
}

console.log(`\n=== KEEPING — ${kept.length}`)
for (const [n, why] of kept) console.log(`  ${n.padEnd(32)} ${why}`)

console.log(`\n=== ${APPLY ? 'REMOVING' : 'WOULD REMOVE'} — ${safe.length}`)
for (const wt of safe) console.log(`  ${path.basename(wt)}`)

if (!APPLY) {
  console.log('\ndry run. re-run with --apply to remove.')
  process.exit(0)
}

let removed = 0
for (const wt of safe) {
  const out = git(MAIN, `worktree remove "${wt}"`)
  if (out === null) {
    console.log(`  FAILED  ${path.basename(wt)} (left in place)`)
  } else {
    removed++
    console.log(`  removed ${path.basename(wt)}`)
  }
}
git(MAIN, 'worktree prune')
console.log(`\nremoved=${removed}/${safe.length}`)
