# Feature pipeline (founder-set, 2026-08-01)

**Two lanes.** Feature work is split into tickets that land into a **feature integration branch**
and reaches `dev` only after end-to-end verification of the whole feature. **Bugfixes take the
short lane** — one ticket, straight to `dev`, no integration branch.

Land mechanics (no-worse gate, `--no-ff` bubble, `npm run land`) are unchanged — see
[GIT_WORKFLOW.md](./GIT_WORKFLOW.md). What changed is **where a ticket lands** and **what must be
true before a feature reaches `dev`**.

---

## Two lanes

Not everything is a feature. Pick the lane by asking **what has to be true before this reaches
`dev`**.

| | **Feature lane** | **Bugfix lane** |
|---|---|---|
| When | New capability, multi-ticket work, anything where tickets must be verified *together* | A defect in shipped behaviour. One ticket, one coder |
| Ticket id | `feature-NN-ticket-MM` | `T-###` (existing scheme) |
| Branch | `feature-NN-ticket-MM` off `origin/feature-NN` | `storylint/<topic>` off `origin/dev` |
| Lands into | `feature-NN`, then `dev` after feature E2E | **straight to `dev`** |
| Gate before `dev` | Reviewer, then E2E on the **whole feature** | Reviewer, then the fix's own verification |
| Integration branch | Yes, rat creates it | **No** |

**Why bugfixes skip the feature branch.** The feature branch exists for one reason: several tickets
must be verified *as one thing*, because passing individually does not mean they work together. A
single bugfix has nothing to compose with. Routing it through an integration branch adds two merges
and a wait, and buys no evidence that the direct land does not already give.

**The lanes converge.** Both still get: a coder who self-reviewed end to end, a separate reviewer,
the no-worse land gate, and integration testing on `dev` afterwards. The bugfix lane removes the
feature branch, not the verification.

### Bugfix flow

```
T-###  →  coder codes it AND self-reviews end to end
             failed? coder fixes it
       →  reviewer checks the diff
             failed? back to the coder
             passed? lands to dev, reports to rat
       →  rat closes the ticket in the same land (standing rule 35)
```

```
git checkout -B storylint/<topic> origin/dev
npm run land -- storylint/<topic> --summary "<what this fixes>"
```

**A bugfix that turns out to need several tickets is a feature.** If the fix grows to where the
pieces must be verified together, stop and open a `feature-NN`. The lane is chosen by the work's
shape, not by what it was called when it was filed.

**E2E-verify a bugfix too.** Skipping the feature branch does not mean skipping verification that
the fix landed on the running product — that is standing rule 30 and it applies in both lanes. What
the bugfix lane drops is *composition* testing, because there is nothing to compose.

---

## The shape (feature lane)

```
feature-01                      ← integration branch, rat creates it
├── feature-01-ticket-01        ← coder branch
├── feature-01-ticket-02
└── feature-01-ticket-03

ticket branch
  → coder writes it AND re-reviews their own work end to end
      failed? coder fixes it. Does not hand up a known-broken change.
  → reviewer checks it
      failed? back to the coder (not to rat)
      passed? lands into feature-01, reports to rat
  → rat pools tickets until the feature is complete
  → E2E tester runs the WHOLE feature
      passed? merges feature-01 → dev, reports to rat
      failed? back to rat, who opens feature-01-ticket-01-fix-01 and restarts at step 1
  → dev pools features
  → integration testing across ALL features: did this break other work?
      new bug? report to rat, who opens tickets
```

---

## Stage 1 — Split a feature into tickets

rat receives or proposes a feature, then splits it.

| Rule | Why |
|---|---|
| Feature id is `feature-NN` (`feature-01`, `feature-02`) | The branch name and the ticket ids derive from it |
| Ticket ids are `feature-NN-ticket-MM` | The name says which feature it belongs to; no lookup needed |
| One ticket = one coder's complete unit of work | A ticket that needs two people is two tickets |
| Tickets should be independently reviewable | A reviewer must be able to judge it without the other tickets |
| rat creates the `feature-NN` branch **before** assigning | Ticket branches need it to exist to land into |

```
git fetch origin
git push origin origin/dev:refs/heads/feature-01   # branch off current dev
```

The feature branch starts as a copy of `dev`. It is an integration branch: only ticket lands write it.

**Splitting is a real design act, not clerical.** A bad split shows up as reviewers unable to judge a
ticket alone, or two coders editing the same file. `npm run tickets:check` hard-fails on two
`in_progress` tickets claiming the same path — use it before assigning, not after.

---

## Stage 2 — Assign

Every ticket goes to one coder. rat records owner and status on the ticket.

**rat is not an approval gate for code quality.** rat splits, assigns, pools, and opens fix tickets.
rat does not sit between "reviewed" and "landed" — that inbox is what produced the 83-commit
dev/main drift ([STANDING_RULES](./decisions/STANDING_RULES.md) 32).

---

## Stage 3 — Coder

Branch: `feature-NN-ticket-MM`, cut from the **feature branch**, not from `dev`.

```
git fetch origin
git checkout -B feature-01-ticket-01 origin/feature-01
```

**The coder's duty is a finished, self-verified change.**

1. Write the code.
2. **Re-review your own work end to end.** Not "the unit test passes" — drive the actual path a user
   takes, from entry to result. For product/UI work that means L1 owned-stack Playwright on the running
   app ([AGENT_PIPELINE_L1_L2.md](./AGENT_PIPELINE.md)).
3. **Failed? Fix it.** Do not report a known-broken change upward. A reviewer is not your test runner.
4. Passed? Report to rat: branch, commit sha, what you verified and how.

rat then assigns a reviewer.

**What "end to end" means here:** you must have observed the change working through the real path,
and you must be able to say what would have shown you it was broken. A check that could not have
failed is not a check ([STANDING_RULES](./decisions/STANDING_RULES.md) §Measurement).

---

## Stage 4 — Reviewer

The reviewer reads the diff and judges the change. This is a different question from "does it work"
(that is E2E, stage 5) — see [STANDING_RULES](./decisions/STANDING_RULES.md) 30.

| Outcome | Action |
|---|---|
| **Failed** | Send it **back to the coder directly.** Not to rat. The coder fixes and re-submits. |
| **Passed** | The reviewer lands the ticket into the feature branch, then reports to rat. |

```
npm run land -- feature-01-ticket-01 --summary "<what this ticket does>" --into feature-01
```

`--into feature-01` runs the full no-worse gate **against the feature branch**: fresh `test:green`
baseline on `origin/feature-01`, merge, `test:green` again, identity compare, `--no-ff` bubble, push,
read back. Same gate as a dev land, different target.

Then report to rat: ticket id, `origin/feature-01` hash after the land.

---

## Stage 5 — Feature complete → E2E tester

When every ticket in the feature has landed on `feature-NN`, rat hands the **whole feature** to an
E2E tester.

The E2E tester drives the running product across the feature as a user would — not per ticket, the
feature as one thing. Tickets passing individually does not mean the feature works; that is exactly
what composition testing exists to catch (isolation green ≠ composition green).

| Outcome | Action |
|---|---|
| **Passed** | The E2E tester merges `feature-NN` → `dev` and reports to rat with the `origin/dev` hash. |
| **Failed** | Report to **rat**, who opens `feature-NN-ticket-MM-fix-KK` and restarts at stage 1. |

```
npm run land -- feature-01 --summary "<feature summary>"      # target defaults to dev
```

**Fix tickets restart the pipeline.** `feature-01-ticket-01-fix-01` is a real ticket: coder,
self-review, reviewer, land into the feature branch, E2E again. It does not shortcut to `dev`.

---

## Stage 6 — Integration testing across features

`dev` pools features. After several land, an integration tester asks the question no single feature
owner can:

- Did other work break **because of** these updates?
- Do features interact in ways nobody tested?
- Any new bug that belongs to no single feature?

**New bug? Report to rat, who opens tickets.** An integration failure is a bug ticket, not a revert
([STANDING_RULES](./decisions/STANDING_RULES.md) 31).

`dev → main` remains the founder cadence: every 5 lands, milestone named on the subject.

---

## Reporting contract

Every handoff names what happened and where.

| Role | Reports | Must include |
|---|---|---|
| Coder | to rat, when self-review passes | branch, commit, **what you verified and how it could have failed** |
| Reviewer | to coder on fail; to rat on pass | ticket id, `origin/feature-NN` hash after land |
| E2E tester | to rat | pass: `origin/dev` hash. fail: what broke, shortest repro |
| Integration tester | to rat | new bugs with shortest repro |

Report on **state change**, not only at the end ([AGENT_PROTOCOL.md](./AGENT_PROTOCOL.md)).

---

## What does not change

- `npm run land` is the only authorized way to write `dev` or a feature branch
- The no-worse gate. There is no `--skip-tests`
- `main` receives merges from `dev` only, on the founder's account. `--into main` is refused by the
  land script
- Report the **origin** hash, never a local-only hash
- No agent idles without a blocker on record
- Only the root coordinator spawns agents

---

## Anti-patterns

- **Coder hands up a change they know is broken** — the reviewer is not your test runner
- **Reviewer sends a failure to rat instead of the coder** — adds a hop, loses context
- **Landing a feature ticket straight to `dev`** — it bypasses the feature's E2E gate
- **Routing a one-ticket bugfix through a feature branch** — two extra merges, no extra evidence
- **Merging `feature-NN` → `dev` before every ticket has landed** — the E2E ran on a partial feature
- **Treating an E2E failure as grounds to revert** — it is a fix ticket
- **A fix ticket that skips review** — fix tickets are tickets
- **Splitting so finely that no ticket is reviewable alone**, or so coarsely that one ticket is a
  whole feature
