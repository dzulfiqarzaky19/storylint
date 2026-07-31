# Agent pipeline (L1 → land → L2 → main)

Founder flow. Same loop the founder runs; git vehicle is **`npm run land` + `--no-ff`**, not squash-to-dev.

Cross-links: [GIT_WORKFLOW.md](./GIT_WORKFLOW.md) · [AGENT_PROTOCOL.md](./AGENT_PROTOCOL.md) · [E2E.md](./E2E.md) · [decisions/STANDING_RULES.md](./decisions/STANDING_RULES.md) · [tickets/README.md](./tickets/README.md) · [AUDIT_HANDOFF.md](./AUDIT_HANDOFF.md)

## Flow

```
code → local self-check → L1 Playwright (owned-stack, their change)
  bad → coder again
  good → push topic branch (PR optional UI only)
       → npm run land → origin/dev   # --no-ff bubble; NEVER squash-to-dev
dev pools until 1 story/feature complete
  → L2 story/composition E2E on origin/dev
  bad → reopen coder with shortest repro + ticket
  good → merge dev → main at milestone
```

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
   - Story/composition paths: multi-surface journeys, load fixtures, cross-region jobs that L1 never composed.
   - **Isolation green ≠ composition green.** L1 pass does not close a story. L2 pass does (for that story).

4. **PR is optional review UI.** Opening a GitHub PR does not write `dev`. **Only `npm run land` writes `dev`.** Never `git push origin <topic>:dev`. Never squash-merge into `dev`.

5. **`dev → main` only at milestones**, after L2 (and product verification) for the batch. Founder account. `--no-ff`. See GIT_WORKFLOW § Flow step 6.

## Where tickets fit

| Moment | Ticket action |
|--------|----------------|
| Start implement work | **Priority check** — highest open P0, else highest P1 for assigned story, else assigned ticket ([tickets/README.md](./tickets/README.md)) |
| Before land | Ticket exists; status → `in_review` / `landing`; priority unchanged unless ox/rat re-ranks |
| Land hits `origin/dev` | Status → `integrated` |
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
| L1 (owned-stack, pre-land) | **Verifier** (Coder runs smoke; Verifier fails closed on output) |
| Land / origin hash | Coder via `npm run land`; report `origin/dev=<sha>` |
| L2 (composition on dev) | **Verifier** on `origin/dev` after story pool |
| Priority / reopen | Coordinator + ticket owner; ox/rat for re-rank |

## Do not

- Squash-to-dev or push topic tip as `dev`
- Treat absolute-green as the land gate (land uses **no-worse**; see GIT_WORKFLOW)
- Claim story-done on L1 alone
- Start lower-priority implement work while a P0 is open without founder/rat override on the ticket
- Use condition/probe chrome as default pass evidence
