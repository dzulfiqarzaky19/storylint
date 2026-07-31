# Audit handoff

When an agent **measures** (density, a11y, load, calm, doctrine catch), the deliverable is a **report + ticket**, not a silent fix land.

Pipeline entry: [AGENT_PIPELINE.md](./AGENT_PIPELINE.md) (measure → report-first → ox ruling → ticket → code).  
Cadence: [AGENT_PROTOCOL.md](./AGENT_PROTOCOL.md). Tickets: [tickets/README.md](./tickets/README.md).

## Done criteria (report)

A measurement report is complete only when it includes:

| Field | Required |
|-------|----------|
| **Provenance HEAD** | Commit examined (`origin/dev` or owned-stack SHA). Worktree ≠ truth. |
| **Seeds × viewports** | Fixture/seed used and viewports (e.g. 1440, 390). |
| **Ranked findings** | Ordered by user harm / story block, not discovery order. |
| **False-positives** | Named and discarded with reason (or “none checked”). |
| **Shortest repro** | Path + check id, or minimal steps another agent can run. |
| **Out-of-scope** | Explicit non-goals so coders do not expand. |
| **Ticket filed** | `docs/tickets/T-###.md` + [BACKLOG.md](./tickets/BACKLOG.md) row with **priority**. |

## Evidence rules (audit-specific)

- **Owned stack** for the claim, or refuse / NOT-MEASURED — never green on ambient `:5173`.
- **Condition labels and probe chrome are not default product evidence.** They may appear in the report as measurement aids; product tickets and L1/L2 proofs assert behaviour and state the user owns.
- Geometry-only visibility is invalid ([STANDING_RULES](./decisions/STANDING_RULES.md)).
- Class-over-instance: inventory sites; verify each failure mode before one fix ([lab-lifecycle-ends](./decisions/lab-lifecycle-ends.md) qualifier).

## After the report

1. If product model is unclear → **ox ruling** before code.
2. File ticket(s) with priority (P0–P3) and `shortest_repro`.
3. Coder enters [AGENT_PIPELINE](./AGENT_PIPELINE.md) from **code**, not from the probe script alone.
4. L2 fail reopens the ticket at ≥ prior priority with the new shortest repro.

## Minimal report shape

```
audit: <name> @ <HEAD>
seeds×vp: <…>
findings (ranked):
1. …
FP: …
shortest_repro: <cmd or steps>
oos: …
ticket: T-### (P?)
```
