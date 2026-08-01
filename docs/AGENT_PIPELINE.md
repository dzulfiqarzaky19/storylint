# Agent pipeline (L1 → land → L2 → main)

Founder flow. Same loop the founder runs; git vehicle is **`npm run land` + `--no-ff`**, not squash-to-dev.

Cross-links: [GIT_WORKFLOW.md](./GIT_WORKFLOW.md) · [AGENT_PROTOCOL.md](./AGENT_PROTOCOL.md) · [E2E.md](./E2E.md) · [decisions/STANDING_RULES.md](./decisions/STANDING_RULES.md) · [tickets/README.md](./tickets/README.md) · [AUDIT_HANDOFF.md](./AUDIT_HANDOFF.md)

## Sprint model (founder-set)

Work is assigned in **sprints**, so priority is known before anyone picks anything up.

| | |
|--|--|
| Who holds priority | **rat** (coordinator). One ranked queue; agents do not self-select from the backlog. |
| Sprint boundary | **Until the batch is done.** Not a clock, not a commit count. |
| Why no clock | We are not running against a release or inbound user requests. There is therefore **no reason to rush and every reason to be correct**. Slow and right beats fast. |
| Grouping | By **theme**, not by severity. Half a story shipped is how docs end up claiming what the code does not do. |
| `dev → main` | **Every 5 lands** (founder cadence), with a **named milestone** on the merge subject. Count triggers; name describes. |
| Land granularity | **One land per feature**, not per step. A ticket lands with its own close. ([GIT_WORKFLOW § Land granularity](./GIT_WORKFLOW.md#land-granularity)) |

A sprint closes when its items are landed **and** verified (below), not when they are merged.

## Flow

```
sprint (rat holds priority) → rat assigns
  → coder works → local self-check → L1 Playwright (owned-stack, their change)
  → CODE REVIEW (reviewer: is the change sound?)
      bad → coder again
  → coder lands: npm run land → origin/dev   # --no-ff bubble; NEVER squash-to-dev
  → E2E VERIFY (verifier: did the ticket's intent land on the running product?)
      did not land → BUG → new ticket → back into the sprint at >= prior priority
dev pools until the story/batch is complete
  → L2 story/composition E2E on origin/dev
  → merge dev → main EVERY 5 LANDS, subject names the MILESTONE
```

**The coordinator is not an approval gate in this flow.** rat assigns and ranks; the reviewer reviews; the coder lands; the verifier verifies. Inserting the coordinator between "reviewed" and "landed" is what produced an 83-commit drift between `dev` and `main` — every agent waited on one inbox.

## The two verification lanes are different questions

They are **not** redundant, and neither substitutes for the other. They catch different defect classes.

| Lane | Asks | Reads code? | Drives the app? |
|------|------|-------------|-----------------|
| **Code review** | Is this **sound**? Is the evidence attributed? **Does the check actually check** (mutate it and watch it fail)? | **Yes — primary job** | Only if a gate needs proof |
| **E2E verify** | Did the **ticket's intent** land on the **running product**? Can an author now actually do X and get Y? | **No** | **Yes — required** |

Why both exist: a change can be perfectly reviewable and still not do what its ticket promised, and a probe can report a correct fix as broken. Both happened in the density pass. Review alone missed the first; a live probe alone nearly caused a revert of good work.

**A failed E2E verify is a BUG, not a review rejection.** It does not revert the land. It opens a ticket and re-enters the sprint with a priority.

**Verifier discipline (why its reports are trusted):**

- Verify against the **ticket intent**, not the diff. The diff belongs to review.
- Own the stack; cite provenance (HEAD + served bundle + what was examined).
- **State plainly what you did not verify.** Explicit non-claims are the reason a PASS is worth anything. A verdict with no stated limits is a verdict with unknown limits.
- **Report; do not fix.** A verifier who patches the thing loses the seat.

## Rules (locked)

1. **Same loop as founder intent.** The git vehicle is **land + `--no-ff`**, not squash. Attribution = first-parent merge bubble:
   ```
   git log --first-parent origin/dev
   ```
   Each land is one bubble: `Merge storylint/<topic> into dev: <summary>`. Raw tips and squash-to-dev erase attribution. See [GIT_WORKFLOW.md](./GIT_WORKFLOW.md).

2. **L1 = change-level owned-stack Playwright before land (isolation).**
   - Coder/Verifier runs Playwright against the **owned stack** for *this change* (slice smoke, focused e2e, calm rows that touch the surface).
   - Provenance required: HEAD + served bundle + what was examined ([STANDING_RULES](./decisions/STANDING_RULES.md) measurement).
   - L1 green means the change is safe **in isolation**. It is the gate before `npm run land`.

3. **L2 = story/composition E2E after the story pool sits on `origin/dev`.**
   - Run on **integrated** `origin/dev`, not the topic alone.
   - **One command:** `npm run test:l2` → `e2e/l2-composition.mjs` (guard + owned stack).
   - Same evidence discipline as `test:green`: owned stack, HEAD + shell.css provenance, fail-closed, NOT-MEASURED / precondition = fail (exit 2 refuse).
   - **Not a renamed L1.** `all-smoke` isolates each feature smoke on its own mint. L2 keeps **one project** and walks Draft → Canon → Lab → reload, proving body + sheet + active pointer survive the shared container.
   - **Named claim, not general composition-safe.** Load-bearing mutations currently cover Canon-sheet→Draft-body and Draft-chapter→Canon-sheets only. Lab is on the path; Inbox/graph are not claimed. Cite the two directions, not "no surface can clobber another."
   - Story/composition paths: multi-surface journeys, load fixtures, cross-region jobs that L1 never composed. Grow `l2-composition.mjs` (or story-scoped runners it calls) when a new composition defect class appears — do not append isolated smokes and call it L2.
   - **Isolation green ≠ composition green.** L1 pass does not close a story. L2 pass does (for that story). Tickets with `l2_required: yes` stay short of `done` until L2 is green on the integrated tip. L2 fail → reopen ≥ prior priority with shortest repro (never silent downgrade).
   - Artifacts (untracked): `e2e/output/l2-composition-last.md` + `.json`. Cite provenance: HEAD, owned flag, shell hash.

4. **PR is optional review UI.** Opening a GitHub PR does not write `dev`. **`npm run land` is the only *authorized* way to write `dev`** — and that is a **norm, not an enforcement**: git will still accept `git push origin HEAD:dev`, and [GIT_WORKFLOW](./GIT_WORKFLOW.md) documents a manual fallback for when the script itself is broken. There is no pre-receive hook. The rule holds because agents keep it, not because the repo stops you. Never `git push origin <topic>:dev` outside that documented fallback. Never squash-merge into `dev`.

5. **`dev → main` every 5 lands**, after L2 (and product verification) for the batch, with the milestone named on the merge subject. Founder account. `--no-ff`. See GIT_WORKFLOW § Flow step 6.

   With one land per feature, those 5 should read as 5 features. If the milestone name is hard to write, the batch was fragments.

6. **A diagnostic proven only on the happy path is not proven.** Step timers, error labels, failure logs and timeout messages exist for the failure path — so **fault-inject** and watch the failure output name the thing. A log that fires when nothing is wrong tells you nothing when something is. (Same disease as a check that passes on absence.)

7. **Verification is delegated, not centralised.** The person who wrote a change is the worst reader of it, and so is anyone who has been inferring instead of driving the product. Fresh eyes on an owned stack.

## Where tickets fit

| Moment | Ticket action |
|--------|----------------|
| Start implement work | **Priority check** — highest open P0, else highest P1 for assigned story, else assigned ticket ([tickets/README.md](./tickets/README.md)) |
| Before land | Ticket exists; status → `in_review` / `landing`; priority unchanged unless ox/rat re-ranks |
| Land hits `origin/dev` | Status → `integrated` |
| E2E verify fails | **New bug ticket** with shortest repro; re-enters the sprint at **≥ prior priority**. The land stays. |
| L2 fail | Reopen at **≥ prior priority**; attach shortest repro; never silent downgrade |
| L2 pass + story close | Status → `done`; eligible for main with the milestone |

Run: `npm run tickets:check` (optional `--agent=`, `--story=`, `--strict`).

## Audit entry point

When work starts from measurement (density, a11y, load, doctrine catch):

```
measure → report-first → ox ruling (if product) → ticket with shortest repro → then pipeline from code
```

Do **not** jump from a probe finding straight to land. Report criteria and handoff shape: [AUDIT_HANDOFF.md](./AUDIT_HANDOFF.md). Measure **condition labels / probe chrome are not default product evidence** (STANDING_RULES + audit handoff).

## Role ownership (proof)

| Gate | Owns proof reading |
|------|--------------------|
| Sprint priority / assignment | **Coordinator (rat)** — not an approval gate on landing |
| Code review (soundness) | **Reviewer** — reads the diff; mutation-tests the checks |
| L1 (owned-stack, pre-land) | **Verifier** (Coder runs smoke; Verifier fails closed on output) |
| Land / origin hash | Coder via `npm run land`; report `origin/dev=<sha>` |
| E2E verify (intent on running product, post-land) | **E2E Verifier** — files bugs, does not fix, does not gate the land |
| L2 (composition on dev) | **Verifier** on `origin/dev` after story pool |
| Priority / reopen | Coordinator + ticket owner; ox/rat for re-rank |

## Do not

- Squash-to-dev or push topic tip as `dev`
- Treat absolute-green as the land gate (land uses **no-worse**; see GIT_WORKFLOW)
- Claim story-done on L1 alone
- Start lower-priority implement work while a P0 is open without founder/rat override on the ticket
- Use condition/probe chrome as default pass evidence
- **Wait on the coordinator to approve a land** — review, then land, then verify
- **Treat an E2E-verify failure as grounds to revert** — it is a bug ticket
- **Merge `dev → main` without naming the milestone** on the subject (the count triggers it; the name still has to be written)
- **Land each step of one feature separately** — a ticket's fix, its status change, and its review follow-ups are one land
- **Ship a failure diagnostic without forcing the failure once**
