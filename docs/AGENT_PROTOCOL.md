# Agent reporting protocol

Multi-agent work fails as **silent progress**, not as bad code. Coordinators cannot see your worktree. One line on a state change beats a perfect report at the end.

Sibling to [GIT_WORKFLOW.md](./GIT_WORKFLOW.md) (push / origin hash / worktrees). This file is **cadence and ownership**.

---

## Workers

### 1. Report on STATE CHANGE, not only on task completion

Send a one-liner when any of these land:

- a commit (include branch + sha)
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
