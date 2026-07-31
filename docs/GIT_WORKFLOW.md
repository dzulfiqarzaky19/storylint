# Git workflow (locked)

**Rule: no direct commits to `main`.** `main` receives only merges from `dev`, done on the founder's account.

**Reporting cadence / handoffs / coordinator duties:** [AGENT_PROTOCOL.md](./AGENT_PROTOCOL.md) (state-change reports, shippable slices, no silent progress).

## Flow

```
storylint/<topic>  →  dev  →  main (merge from dev only)
```

1. Branch off **`origin/dev`** (not local `dev`, not another worker's branch):
   `git fetch origin && git checkout -B storylint/<topic> origin/dev`
2. Commit work there (small, scoped commits: `feat|fix|docs|test(scope): message`)
3. Push the branch: `git push -u origin storylint/<topic>`
4. Merge to `dev` with a merge commit for readable history, **then push**:
   `git checkout dev && git merge --no-ff storylint/<topic> && git push origin dev`
5. **Done means origin has it.** Confirm before reporting:
   `git fetch origin && git log --oneline -1 origin/dev`
   Report the **`origin/dev` hash**, never a local-only hash.
6. `dev → main`: agents may merge when dev is verified (tests + QA green), using the founder's account:
   `git checkout main && git pull && git merge --no-ff dev -m "Merge dev: <milestone summary>" && git push`
   Merge at milestones (a completed, verified batch), not per-commit. Never commit work directly on `main`.

## Branch naming

- Prefix `storylint/`, short kebab topic: `storylint/canon-entry`, `storylint/density-polish`
- Never put `main` or `master` tokens in branch names (push hooks refuse them)
- One topic per branch. QA-only work that produces no commits needs no branch.

## History rules (why "beautiful")

- `--no-ff` merges into `dev` so each task reads as one bubble; `--no-ff` merges into `main` so each milestone reads as one bubble
- No direct-to-`dev` commits except the merge commits themselves
- Rebase your **topic** branch on `origin/dev` before merging if `dev` moved; never rebase shared `dev` or `main`
- Delete merged remote branches unless they are release/backup refs

## Hardening (session scars — 2026-07-31)

Rules with a scar attached. Founder locks above stay intact; these close the multi-agent failure modes observed today.

### 1. Pushing is part of merging

A task is **not done** until:

```
git fetch origin
git log --oneline -1 origin/dev   # must show YOUR merge
```

Report the **origin** hash. Local `dev` after `merge --no-ff` is not a ship.

**Observed failure:** four "merged into dev" reports in one day where `origin/dev` did not have the merge. Stale bases followed; one near-miss dropped-commit reconcile (decision-record vs vocab/calm-checker lines).

### 2. Branch off `origin/dev`, never local `dev` or a peer branch

```
git fetch origin
git checkout -B storylint/<topic> origin/dev
```

Do **not** `git checkout dev && git checkout -b …` without fetch+ff. Do **not** branch off another worker's topic tip.

**Observed failure:** calm-budget commits landed inside octopus's merge bubble; `storylint/decision-record` was 4 commits stale and would have silently dropped the vocabulary and calm-checker lines on a naive merge.

### 3. If push is rejected

```
git fetch origin
git checkout dev
git merge --no-ff origin/dev          # bring remote forward on your line
# re-validate (tests / calm / task checks) on the MERGE RESULT
git push origin dev
```

- **Never** `--force` to `dev` or `main`
- **Never** rebase shared branches (`dev`, `main`)
- Topic branches may be rebased onto `origin/dev` **before** anyone else builds on them; once pushed and shared, prefer merge

**Observed failure:** unpushed local merges stacked under other agents' work; force would have rewritten peer history.

### 4. Validate on the merge result, not the topic branch

Run `npm test`, `npm run calm`, smokes, and QA **after** `merge --no-ff` into `dev` (or on a throwaway checkout of that merge commit). Topic-branch green does not prove the bubble is green once integrated.

**Observed failure:** topic passed while integrate order / sibling lines changed the meaning of the merge.

### 5. In a multi-agent tree, the working tree is not truth

The on-disk checkout belongs to **whichever agent checked out last**. Other agents (and the coordinator) must read committed state by ref:

```
git show <ref>:<path>          # e.g. git show origin/dev:docs/IA_MAP.md
git ls-tree -r --name-only <ref> <dir>
```

Do not treat `cat file` / editor buffers / a dirty worktree as the product of record.

**Observed failure:** coordinator read a reverted file from disk and nearly drew the wrong conclusion; a worker hit a worktree switch mid-task and momentarily lost a just-landed `dev` tip until recovered via `git show` / reflog-class commits.

### 6. Own worktree per agent — never switch the shared tree

`D:/dev/projects/storylint` is **common ground**. Other agents may be mid-edit there. **Do not** `git checkout` / `git switch` topic branches in a worktree you did not create.

```
# start a task
git fetch origin
git worktree add D:/dev/projects/storylint-<topic> -b storylint/<topic> origin/dev
cd D:/dev/projects/storylint-<topic>
# … work only here …

# when done
git worktree remove D:/dev/projects/storylint-<topic>
```

- Every agent works in **its own** worktree on **its own** topic branch.
- The shared tree stays on `origin/dev` (or detached at that tip). Restore it there if you disturbed it.
- Never assume the shared tree’s branch is yours.

**Observed failure (2026-07-31):** an agent switched the shared tree onto `storylint/release-prep` and displaced another agent’s checkout mid-task.

### 7. Worktrees in use (this machine — living table)

| Path | Role |
|------|------|
| `D:/dev/projects/storylint` | Shared main worktree — **contended**; leave on `origin/dev` |
| `D:/dev/projects/storylint-base` | Detached / base experiments |
| `D:/dev/projects/storylint-d4` | D4 Canon map chrome |
| `D:/dev/projects/storylint-rail` | Rail budget |
| `D:/dev/projects/storylint-e2e-health` | E2E / calm gate |
| `D:/dev/projects/storylint-pig-docs` | Docs-only when shared is busy |
| `D:/dev/projects/storylint-release` | Release readiness (AF) |
| `D:/dev/projects/storylint-a11y` | a11y / dirty-guard |

**Constraints:**

- Git refuses the same branch checked out in two worktrees at once (`dev` included).
- Workaround used by coordinator: **detached HEAD at `origin/dev`** (or a topic branch) inside a secondary worktree, merge there, push, then `git update-ref refs/heads/dev <merge>` only when no other worktree holds `dev`.
- Prefer `git worktree add <path> -b storylint/<topic> origin/dev` for long tasks so the shared tree stays free.
- When done, remove spare worktrees **you** created: `git worktree remove <path>`.

### 8. How to check main↔dev divergence on this repo

`--no-ff` merges into `main` leave a **merge bubble** on main that `dev` never carries as a tip. So:

```
git log origin/dev..origin/main          # often NON-empty — expected (merge commits only)
```

is **not** the divergence test. Real tests (both must be empty if main has no unique work):

```
git log --no-merges origin/dev..origin/main
git diff --stat $(git merge-base origin/dev origin/main) origin/main
```

If either shows unique non-merge commits or a tree delta, stop and tell the coordinator. That is a real fork, not a bubble.

**Observed false alarm (2026-07-31):** AF stopped on `184bb3e` (pure merge bubble; tree identical to second parent / merge-base). Cost real agent time; do not repeat.

## Swarm rules

- Coordinator assigns one branch per task; workers with disjoint scopes may share a branch only if told to
- Worker reports must include: **branch name**, **topic commit**, **`origin/dev` hash after push** (not local-only)
- Backup refs (`backup/*`) are snapshots — read-only, never build on them
- Before claiming collision-free, `git fetch` and re-read `origin/dev`; coordinate on shared files (e.g. graph) via DM, not optimism

## Done checklist (copy into reports)

Also follow [AGENT_PROTOCOL.md](./AGENT_PROTOCOL.md): report on state change, not only at the end.

1. `git fetch origin`
2. `git log --oneline -1 origin/dev` shows your `Merge storylint/<topic>…`
3. Report: `branch` · `topic=<sha>` · `origin/dev=<sha>`
4. Validation ran on the **merge result**
5. No force-push; no shared rebase
6. Work happened in **your** worktree; shared tree left on `origin/dev`
