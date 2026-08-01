# Ticket backlog

Living index. **Source of truth** = each `T-###.md` frontmatter. Keep this table sorted **P0 → P3**, then id.

Validate: `npm run tickets:check`

| ID | P | Status | Story | Title | Owner |
|----|---|--------|-------|-------|-------|
| [T-002](./T-002.md) | P1 | integrated | agent-pipeline | Formalize L2 story/composition gate on origin/dev | horse |
| [T-003](./T-003.md) | P1 | integrated | density-milestone | Binder list scroll restore after detail Back (AZ hold) | buffalo |
| [T-006](./T-006.md) | P2 | open | none | Silent calm death after b6 self-test (no stack, exit 1) | unassigned |
| [T-008](./T-008.md) | P2 | open | none | Project path lock is per-process; concurrent processes on one file still EPERM | unassigned |

## Closed / not open

| ID | Note |
|----|------|
| ~~T-014~~ | Lab composer form column **done**. Cap .lab__composer to manuscript.pageMaxWLg (40rem); canvas untouched. Land `22c40dd`. |
| ~~T-010~~ | Resting face row fits 2-digit/capped Inbox badge at 272px desk rail **done**. Density + 99+ + base max-width; geometry smoke mutation-proved. Land `ebe9d0b`. |
| ~~T-013~~ | Honest propose-edge body below 2 sheets **done**. Disclosure stays (ox); hint-only body; fieldsShown=0 lock. Land `af5ff70`. |
| ~~T-012~~ | One primary New sheet **done** (already-satisfied close). Map owns empty CTA; binder ghost empty. Product via b6-primary-per-job `dc059e6`. Land `af5ff70`. |
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

T-006 and T-008 stay **separate**. Salvaged specimen `e2e/proofs/calm-crash/` (serial loop @
`ea0500a`, run-08 full EPERM stack) is B1/T-005-class on a pre-path-lock tip — not a silent
T-006 B2 hit and not a multi-process T-008 natural repro. Do not merge the tickets.
T-008 remains the open residual from the T-005 review (per-process lock scope). T-007 closed the
single-root precondition on origin/dev @ `6008659` (falcon @ `b9f964f`, koala PASS). T-005 itself
stays correct @ `df405c8`. Triage: a single-process EPERM on the atomic rename is a T-005
regression; a multi-process one is T-008 firing. T-009 (rule 11a check) closed @ `3a7a52e`.
Founder decision on T-008: cross-process lock (stale-owner policy) **or** accept per-process
boundary and make multi-process failure loud — not an EPERM retry.
