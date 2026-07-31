# Git workflow (locked)

**Rule: no direct commits to `main`.** `main` receives only merges from `dev`, done on the founder's account.

## Flow

```
storylint/<topic>  →  dev  →  main (merge from dev only)
```

1. Branch off `dev`: `git checkout dev && git pull && git checkout -b storylint/<topic>`
2. Commit work there (small, scoped commits: `feat|fix|docs|test(scope): message`)
3. Push the branch: `git push -u origin storylint/<topic>`
4. Merge to `dev` with a merge commit for readable history:
   `git checkout dev && git merge --no-ff storylint/<topic> && git push`
5. `dev → main`: agents may merge when dev is verified (tests + QA green), using the founder's account:
   `git checkout main && git pull && git merge --no-ff dev -m "Merge dev: <milestone summary>" && git push`
   Merge at milestones (a completed, verified batch), not per-commit. Never commit work directly on `main`.

## Branch naming

- Prefix `storylint/`, short kebab topic: `storylint/canon-entry`, `storylint/density-polish`
- Never put `main` or `master` tokens in branch names (push hooks refuse them)
- One topic per branch. QA-only work that produces no commits needs no branch.

## History rules (why "beautiful")

- `--no-ff` merges into `dev` so each task reads as one bubble; `--no-ff` merges into `main` so each milestone reads as one bubble
- No direct-to-`dev` commits except the merge commits themselves
- Rebase your branch on `dev` before merging if `dev` moved; never rebase `dev` or `main`
- Delete merged remote branches unless they are release/backup refs

## Swarm rules

- Coordinator assigns one branch per task; workers with disjoint scopes may share a branch only if told to
- Worker reports must include branch name + commit hash
- Backup refs (`backup/*`) are snapshots — read-only, never build on them
