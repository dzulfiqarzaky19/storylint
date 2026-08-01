# Ticket backlog

Living index. **Source of truth** = each `T-###.md` frontmatter. Keep this table sorted **P0 → P3**, then id.

Validate: `npm run tickets:check`

| ID | P | Status | Story | Title | Owner |
|----|---|--------|-------|-------|-------|
| [T-002](./T-002.md) | P1 | integrated | agent-pipeline | Formalize L2 story/composition gate on origin/dev | horse |
| [T-003](./T-003.md) | P1 | integrated | density-milestone | Binder list scroll restore after detail Back (AZ hold) | buffalo |
| [T-006](./T-006.md) | P2 | open | none | Silent calm death after b6 self-test (no stack, exit 1) | unassigned |
| [T-008](./T-008.md) | P2 | open | none | Project path lock is per-process; concurrent processes on one file still EPERM | unassigned |
| [T-010](./T-010.md) | P2 | open | none | Companion face row has 1px of fit; Inbox badge re-clips Research at rest | unassigned |
| [T-014](./T-014.md) | P3 | open | none | Lab composer stretches to full viewport width | unassigned |

## Closed / not open

| ID | Note |
|----|------|
| ~~T-013~~ | Honest propose-edge body below 2 sheets **done**. Disclosure stays (ox); hint-only body; fieldsShown=0 lock. Land PENDING. |
| ~~T-012~~ | One primary New sheet **done** (already-satisfied close). Map owns empty CTA; binder ghost empty. Product via b6-primary-per-job `dc059e6`. Land PENDING. |
| ~~T-011~~ | Mutation-lock title overpromised **done**. Retitled to name the mechanism it verifies; siblings swept and found honest. Generalized as standing 8g. |
| ~~T-007~~ | Single-root ProjectFileRoot **done**. Land `6008659`; falcon APPROVE @ b9f964f (MUT-1..5); koala PASS. No realpath. |
| ~~T-009~~ | Standing rule 11a no-retry check **done**. Land `3a7a52e`; falcon APPROVED wiring @ 419406c (MUT-A/D/E). Optional source tripwire left open intentionally. |
| ~~T-005~~ | Path-keyed project IO lock **done**. Land `df405c8`; falcon APPROVE @ f1d4a96; koala PASS author-facing (fail surfaces; thrash 0; MUT-6). |
| ~~T-004~~ | Durable dirty sheet identity **done**. Land `9713335`; hawk APPROVE @ daf3a97. 7d stale confirm remains open follow-on. |
| ~~T-001~~ | Lab lifecycle ends **done**. Restore octopus `d3570f4`; dismiss/source-gate/wiring dolphin `7fc4d17`/`5331466`/`9fac01d` (koala). Domain-title follow-on `184436d` ("25c"), not T-001. |
| ~~BL phone drawer~~ | Integrated on origin/dev @ `bd56a5d` (dismiss-on-outside). No open ticket. |
| ~~BA/BF a11y local-only~~ | Prior a11y lands on dev (face tabs, focus). Fresh a11y topic work files new tickets if needed. |

## Next free id

`T-015`

## Notes

T-008 remains the open residual from the T-005 review (per-process lock scope). T-007 closed the
single-root precondition on origin/dev @ `6008659` (falcon @ `b9f964f`, koala PASS). T-005 itself
stays correct @ `df405c8`. Triage: a single-process EPERM on the atomic rename is a T-005
regression; a multi-process one is T-008 firing. T-009 (rule 11a check) closed @ `3a7a52e`.
