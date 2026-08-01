# Git workflow (locked)

**Rule: no direct commits to `main`.** `main` receives only merges from `dev`, done on the founder's account.

**Reporting cadence / handoffs / coordinator duties:** [AGENT_PROTOCOL.md](./AGENT_PROTOCOL.md) (state-change reports, shippable slices, no silent progress).

**Agent pipeline (L1 / L2):** [AGENT_PIPELINE.md](./AGENT_PIPELINE.md) — L1 owned-stack Playwright **before** `npm run land`; L2 story/composition E2E on `origin/dev` **before** story close / `dev → main`. Land mechanics on this page are unchanged (no-worse gate, `--no-ff` bubble, only land writes `dev`).

## Flow

```
storylint/<topic>  →  dev  →  main (merge from dev only)
```

1. Branch off **`origin/dev`** (not local `dev`, not another worker's branch):
   `git fetch origin && git checkout -B storylint/<topic> origin/dev`
2. Commit work there (small, scoped commits: `feat|fix|docs|test(scope): message`)
3. Push the topic branch: `git push -u origin storylint/<topic>`
4. **Land onto `dev` with the script (this is the instruction):**
   ```
   npm run land -- storylint/<topic> --summary "<why this lands>"
   ```
   The script refuses a dirty tree, runs a **fresh** `test:green` baseline on detached `origin/dev` (same run, not a cache), merges `origin/dev` **into** the topic, runs `test:green` on that merge result, compares failure **identities** (no-worse: pre-existing reds on dev do not block; new reds abort; fixed reds are reported), detaches at `origin/dev`, `merge --no-ff` the topic with the house message form, pushes `HEAD:dev`, retries the **whole** sequence on rejection (no rebase), then fetches and prints the **origin** hash it actually reads back. It never filters its own output. There is no `--skip-tests`.
5. **Done means origin has it.** The script already prints this; re-check if you need to:
   `git fetch origin && git log --oneline -1 origin/dev`
   Report the **`origin/dev` hash**, never a local-only hash.
6. `dev → main`: agents may merge when dev is verified (tests + QA green), using the founder's account:
   `git checkout main && git pull && git merge --no-ff dev -m "Merge dev: <milestone summary>" && git push`
   Merge at milestones (a completed, verified batch), not per-commit. Never commit work directly on `main`.

   **Cadence (founder-set): every 5 PRs landed to `dev`, horse merges `dev → main`.** The count is the trigger; the milestone name is what the merge subject says. Both hold — do not wait for someone to declare a milestone, and do not merge per-commit.

   Full founder flow: topic branch → hawk reviews → not ok, author retries → ok, author lands to `dev` via `npm run land` → every 5 lands, horse merges `dev → main`.

   **One land per feature, not per commit-sized step (founder-set 2026-08-01).** A land is the unit the
   founder reads. It should be a thing they can recognize as a feature, a fix, or a closed ticket —
   not one step of the work that produced it. See [Land granularity](#land-granularity).

   Check the count before deciding:
   ```
   git rev-list --count --first-parent origin/main..origin/dev
   ```

   **Scar:** this rule lived only in conversation. rat grepped the docs, found nothing, and told horse the rule was invented — reporting "not in the docs" as if it disproved "the founder set it". A missing citation disproves the citation, not the claim ([STANDING_RULES](./decisions/STANDING_RULES.md) 34). Drift reached 28 lands before the first merge, then 20 before this was caught. A rule that is not written down is one bad memory away from being overridden.

### Manual land sequence (fallback / understanding only)

Use only if `npm run land` is unavailable. The script remains the instruction.

```
git status --porcelain          # must be empty
git fetch origin
git merge origin/dev            # INTO the topic; abort on conflict, never auto-resolve
npm run test:green              # baseline on origin/dev, then again on topic-after-dev
# no-worse: abort only on failures NOT already on origin/dev (identity compare)
git checkout --detach origin/dev
git merge --no-ff storylint/<topic> -m "Merge storylint/<topic> into dev: <summary>"
git push origin HEAD:dev        # full output, unfiltered — never bury this in a pipeline
# on rejection: checkout topic, restart from fetch — do not rebase
git fetch origin
git log --oneline -1 origin/dev # report THIS hash
```

**House merge subject:** `Merge storylint/<topic> into dev: <summary>`  
**After a land, `origin/dev` must be a merge commit** (two parents). A raw tip means the land failed even if the content is right.  
**Do not** `git push origin <topic>:dev`. **Do not** rebase onto moving `dev` to win a race. **No force-push** to `dev` or `main`.

**Why a script (2026-07-31):** three agents produced correct *content* through wrong *process* under tip pressure, after reading these docs:
1. Mutating `git push` buried inside a filtered verification one-liner — result unobservable (unattributed action).
2. Merged `dev` into topic, then pushed the **topic** tip as `dev` — bubble reads backwards on the first-parent line.
3. Raced a concurrent merge, rebased to a linear tip, pushed a **raw commit** to `dev` with no bubble.

When a correct procedure is reliably performed incorrectly, more documentation will not fix it. Encode the procedure. History honesty over graph beauty: do **not** rewrite bad bubbles already on `origin/dev` / `main`.

## Branch naming

- Prefix `storylint/`, short kebab topic: `storylint/canon-entry`, `storylint/density-polish`
- Never put `main` or `master` tokens in branch names (push hooks refuse them)
- One topic per branch. QA-only work that produces no commits needs no branch.

## History rules (why "beautiful")

- `--no-ff` merges into `dev` so each task reads as **one bubble per task**; `--no-ff` merges into `main` so each milestone reads as one bubble. "Beautiful history" means **one bubble per task**, not a linear topic branch. It never required a rebase onto a moving `dev`.
- No direct-to-`dev` commits except the merge commits themselves
- If `dev` moved, **merge `origin/dev` INTO your topic branch**, then `merge --no-ff` the topic into `dev`. **Do not rebase onto a moving `dev`.** Rebasing is acceptable only on a private branch nobody has read, and never as a precondition for merging. A `--no-ff` merge from a slightly stale base is correct and expected under concurrency: git resolves it and the bubble records what happened honestly.
- Never rebase shared `dev` or `main`

**Observed failure (2026-07-31):** an agent rebased a docs-only branch four times chasing a tip that moved every few minutes, and merged zero times. Merging is what makes the tip stop moving.
- Delete merged remote branches unless they are release/backup refs

## Hardening (session scars — 2026-07-31)

Rules with a scar attached. Founder locks above stay intact; these close the multi-agent failure modes observed today.

### 0. Land with `npm run land`

```
npm run land -- storylint/<topic> --summary "<why this lands>"
```

See **Flow** §4. Self-host rule: changes to `scripts/land.mjs` land via `npm run land`. If the script cannot land its own branch, it is not finished.

**Gate = no-worse, not absolute green (rat 2026-07-31).** A fresh `test:green` on `origin/dev` is the baseline for that run. Compare failure identities (check name + fixture), never bare counts. Pre-existing reds on dev are named and do not block. Failures you introduce abort. Failures that disappear are reported as fixes. Absolute-green-only serialises every agent behind every open red and will get the script disabled under pressure — which destroys it. First self-test of the script correctly **refused** a land when the gate was still absolute-green; that refusal is the proof the procedure held, and it is what forced this ruling.

There is **no** `--skip-tests`. `--allow-known` is accepted and unused (no-worse already covers inheritance).

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

Prefer `npm run land` (it retries the full sequence). Manual fallback is under **Flow**.

- **Never** `--force` to `dev` or `main`
- **Never** rebase shared branches (`dev`, `main`)
- Topic branches: if `dev` moved under you, **merge** `origin/dev` into the topic (additive). Do not rebase a pushed/shared topic onto moving `dev`. Private-only rebase remains the rare exception, never a merge precondition.

**Observed failure:** unpushed local merges stacked under other agents' work; force would have rewritten peer history.

### 4. Validate on the merge result, not the topic branch alone

`npm run land` baselines `origin/dev`, merges it into the topic, runs `test:green` again, and applies the no-worse identity compare before the `--no-ff` bubble. Topic-branch green alone does not prove the land is safe once integrated.

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
| `D:/dev/projects/storylint-release` | Release readiness (AF) / land-script |
| `D:/dev/projects/storylint-a11y` | a11y / dirty-guard |
| `D:/dev/projects/storylint-watcher` | Agent pipeline + tickets (process) |

**Constraints:**

- Git refuses the same branch checked out in two worktrees at once (`dev` included).
- Standard move when another worktree holds `dev`: **detached HEAD at `origin/dev`** inside your worktree, `merge --no-ff` the topic, `git push origin HEAD:dev`, then `git fetch` and report `origin/dev`. Prefer `npm run land`, which does exactly this. Avoid `git update-ref` unless you own the shared ref and no other worktree holds `dev`.
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

## Land granularity

**Rule (founder-set 2026-08-01): one land per feature.** Batch the steps that produce a feature onto
one branch and land once. Do not land each step.

### The scar (measured, 2026-08-01)

`origin/dev` took **128 lands in one day**. The founder's read: "it's already 500 PRs only for today,
I don't want it to be too many, make PR per feature instead."

The count is what they experience, and their instinct was right even though the exact number differed.
What produced 128:

| Pattern | Example | Should have been |
|---|---|---|
| Ticket work split from its own close | `t005-path-lock`, `t005-done`, `t005-close` (3 lands) | 1 land: fix + ticket status together |
| Review follow-ups landed separately | `falcon-caveat-land`, `falcon-followup-land`, `falcon-t008-land` | fold into the branch under review before it lands |
| Corpus/doc entries one per idea | `ox-8d-property-gone`, `ox-8f-verdict-predicate`, `ox-gate-ok-vocab` | 1 land per session's corpus additions |
| A gate split across its own parts | `gate-b-mutant-validity`, `gate-b-header-notes` | 1 land: the gate and its notes |

**21 of the 128 were pure bookkeeping** — ticket closes, board syncs, drift sweeps — landed apart from
the work they described. That is the cheapest half of the fix: a ticket's status change belongs in the
same land as the change that earned it.

### What counts as one feature

One land = one thing the founder would name. Concretely:

- A ticket and its close, together. `T-005 path lock` is one land, not fix → done → close.
- A gate and everything that makes it real: mechanism, self-test, wiring, notes.
- A review cycle's outcome. hawk's findings get folded into the branch **before** it lands, not landed
  after it as repair. If review requires a change, amend the branch and re-land it once.
- A sweep across many files for one reason, e.g. one `l1_proof` citation sweep.

### What still justifies a separate land

Do not batch to hit a number. These stay separate:

- **Independent risk.** Two changes that could each break something different, where a revert should be
  able to take one without the other.
- **Different reviewers or different tickets.** Two tickets are two lands even if touched the same hour.
- **A hotfix.** Never batch an urgent fix behind unrelated work.
- **A land that is already green and pushed.** Never rewrite published history to make the count prettier
  (History honesty over graph beauty, above).

### Consequence for the `dev → main` cadence

Every-5 is unchanged, but its meaning improves: 5 lands should now be **5 features**, not 5 steps. Horse's
merge subject names the milestone, and with per-feature lands that name gets easier to write honestly —
if a milestone summary is hard to state, the batch was probably fragments rather than features.

## Verification vs mutation

- Never combine a verification command with a mutating one. Verify, read the result, then act as a **separate** command.
- Never filter the output of a command that mutates a remote. A push you cannot see is an unattributed action — same defect class as a measurement you cannot attribute.
- Citable land gate = no-worse vs a fresh `origin/dev` `test:green` in the same run (identity compare). Absolute green on both sides is ideal; inherited reds named by the script are allowed. Retrying until green is forbidden. There is no `--skip-tests`.
- Ambient gitignored data is not a seed. A smoke that passes only when `data/` already exists is not evidence (milestone ninth verification lie).
- See [decisions/STANDING_RULES.md](./decisions/STANDING_RULES.md) §9–10.

## Swarm rules

- Coordinator assigns one branch per task; workers with disjoint scopes may share a branch only if told to
- Worker reports must include: **branch name**, **topic commit**, **`origin/dev` hash after push** (not local-only), and `land=npm-run-land` when applicable
- Backup refs (`backup/*`) are snapshots — read-only, never build on them
- Before claiming collision-free, `git fetch` and re-read `origin/dev`; coordinate on shared files (e.g. graph) via DM, not optimism

## Done checklist (copy into reports)

Also follow [AGENT_PROTOCOL.md](./AGENT_PROTOCOL.md): report on state change, not only at the end.

1. `git fetch origin`
2. `git log --oneline -1 origin/dev` shows your `Merge storylint/<topic>…` (land script prints this)
3. Report: `branch` · `topic=<sha>` · `origin/dev=<sha>` · `land=npm-run-land`
4. Validation ran no-worse vs fresh `origin/dev` baseline (`test:green` twice inside land); introduced failures empty
5. No force-push; no shared rebase; no filtered mutating-command output
6. Work happened in **your** worktree; shared tree left undisturbed
7. Did **not** push a non-merge tip to `dev`
