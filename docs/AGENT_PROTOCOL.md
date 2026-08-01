# Agent reporting protocol

Multi-agent work fails as **silent progress**, not as bad code. Coordinators cannot see your worktree. One line on a state change beats a perfect report at the end.

Sibling to [GIT_WORKFLOW.md](./GIT_WORKFLOW.md) (push / origin hash / worktrees). Pipeline + gates: [AGENT_PIPELINE.md](./AGENT_PIPELINE.md). Tickets: [tickets/README.md](./tickets/README.md). Audit measure handoff: [AUDIT_HANDOFF.md](./AUDIT_HANDOFF.md). This file is **cadence and ownership**.

---

## Workers

### 0. Priority check before implement work

Before starting implement work: run `npm run tickets:check` (optional `--agent=` / `--story=`). Pick highest open P0, else highest P1 for the assigned story, else the assigned ticket. Do not start lower priority while a P0 is open unless founder/rat override is on the ticket. Before land: ticket exists and status → `in_review`/`landing`. Full rules: [tickets/README.md](./tickets/README.md).

**Work arrives by sprint assignment.** The coordinator holds one ranked queue and assigns from it; do not self-select from the backlog, and do not pick up a new item after finishing one without checking in. A sprint runs **until its batch is done** — there is no clock, so correctness beats speed. Model: [AGENT_PIPELINE § Sprint model](./AGENT_PIPELINE.md).

**Do not wait on the coordinator to approve a land.** The chain is review → land → E2E verify. Coordinator sits at assignment, not at the merge.

### 1. Report on STATE CHANGE, not only on task completion

Send a one-liner when any of these land:

- a commit (include branch + sha; **include ticket id** when working a ticket, e.g. `T-001`)
- a blocker appears or clears
- scope discovery ("this is larger / wrong file / needs X first")
- a handoff (you took work, or you gave it away)
- validation result that changes the plan

Silence reads as **stalled**. Working hard with 0/N todos and no DM is still silent.

**Scar:** bear held a finished P0 unreported ~45m; deer held D4 fold work committed unmentioned ~42m. Both WORKING, neither blocked. Coordinator only found out by reading worktrees.

### 2. Land work in shippable pieces

One bubble per coherent change. Do **not** hold a finished P0 hostage to the rest of the task. Merge+push the ready piece; open a **second branch** for the risky remainder.

Cross-link: [GIT_WORKFLOW.md](./GIT_WORKFLOW.md) — one topic per branch, `--no-ff` bubble, push is part of merging.

### 3. Say blocked immediately

If you cannot make progress, DM **now**: what is blocked, and **what would unblock you** (merge, ruling, file owner, secret, repro). No agent idles without a blocker on record.

### 4. Hand off rather than collide (pig→deer pattern)

When the same files are live in another agent's task:

1. DM the owner: short brief + exact labels/acceptance.
2. Offer `HAND_TO_ME | YOU_TAKE_IT | WAIT_UNTIL_<x>`.
3. One owner. The other does **not** open a competing branch on those files.
4. Tell the coordinator which way you went.

**Model:** pig→deer on C5 graph kind labels while D4 owned `RelationshipGraph` / `graph.css`.

### 4a. Never work in the shared main worktree

`D:\dev\projects\storylint` is shared. `git checkout` there **switches the branch under every other agent using it**, silently discarding uncommitted edits in the process.

Give yourself your own worktree before you touch anything:

```
git worktree add -B storylint/<topic> D:\dev\projects\storylint-<you>-<topic> origin/dev
```

**Scar:** rat edited `AGENT_PIPELINE.md` in the shared tree; an agent checked out a feature branch there mid-edit; the change was gone at commit time with no error, only a confusing "nothing added to commit." Losing work is the mild failure. The dangerous one is committing to whichever branch happened to be checked out at that instant.

### 4b. A reviewer must not operate inside the worktree of the agent under review

Re-running a mutation yourself instead of trusting the author's artifact is **correct and expected** — it is how three decorative checks were caught in one session. Do it in **your own** worktree, against the author's commit:

```
git worktree add -B storylint/<you>-review D:\dev\projects\storylint-<you> <their-commit>
cd D:\dev\projects\storylint-<you> && npm install
```

A reviewee's tree is usually mid-land. Builds, checkouts and left-behind mutations there race a live `test:green`, and an owned stack whose bundle changes underneath it dies without a stack trace.

**Scar:** hawk mutated `src/` inside horse's `storylint-l2` during review and left it uncompilable, breaking an in-flight land. Self-reported and restored (`7169274`).

**Non-scar, kept deliberately:** a calm-budget death in another agent's tree was *hypothesised* to be the same cause and it was **not** — the reviewer's last write preceded the run by four minutes. The hypothesis came from an open-files list, which carries **no timestamps**. Correlation of files touched is not evidence of interference; check the clock (`git reflog`, file mtimes, artifact timestamps) before attributing.

### 5. Report the ORIGIN hash, never local-only

After merge: `git fetch origin && git log --oneline -1 origin/dev`.  
Report `origin/dev=<sha>`. Local merge without push is not done.

Full rule + scars: [GIT_WORKFLOW.md § Hardening](./GIT_WORKFLOW.md).

---

## Coordinators

### 6. Do not assume silence means idle — and do not double-book adjacent files

- If an agent is quiet past a reasonable beat, **read their worktree / branch / `git log`** before re-assigning the same work.
- Before sending a task, check who already has the target files open (swarm list, worktree list, recent commits). Prefer handoff over a second owner.
- Your failure mode is duplicate live work, not under-delegation.

**Scar:** near-duplicate assignments while bear/deer were mid-flight with unreported commits.

---

## Minimal report shapes

```
state: committed storylint/<topic> @ <topic-sha> — <one line what>
state: blocked on <x>; unblock = <y>
state: handoff C5 → deer (HAND_TO_ME); I will not open graph-kind-labels
done: branch=… topic=… origin/dev=…  # after fetch confirms
```

Keep the whole protocol under a page. Bureaucracy is not the goal; seven agents rewriting each other is the cost of silence.
