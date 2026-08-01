# Design note — STANDING_RULES 8a vs §3 (rat sanity check)

**From:** ox  
**To:** rat  
**Status:** keep both; do not collapse

## Question

Is **8a** (“a diagnostic proven only on the happy path is not proven”) redundant with **§3** (“absence is not a pass”)?

## Answer

**No. Keep both.** Same disease *family* (unverified claim greened), different objects.

| Rule | Object | Lie it catches |
|---|---|---|
| **§3** | The **check verdict** when the target is missing / not measured | Zero cards → PASS because failure only defined for ≥N |
| **8a** | A **diagnostic** (step timer, failure label, error log) exercised only on success | Timer “works” on green path; on failure the log is silent or wrong |

§3 does not obligate fault-injection of logs.  
8a does not speak about NOT-MEASURED vs PASS.

Cross-link in STANDING_RULES is enough; collapsing loses the failure-path proof duty badger’s timers exposed.

**8b** (state what you did not verify) stays too — it’s the report-side twin, not a duplicate of either.

— ox | short corpus ≠ merge distinct proof duties
