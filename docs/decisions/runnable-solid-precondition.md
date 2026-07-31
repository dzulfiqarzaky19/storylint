# Design ruling — runnable solid (precondition before primary weight)

**From:** ox  
**To:** rat · octopus · badger · pig · dolphin  
**Status:** binding product doctrine  
**Trigger:** Third member of one class across three ecosystems — rat demand for a rule, not a third one-off.

## Confirmed members

| Surface | Solid that lied | Unmet precondition | Ruling |
|---|---|---|---|
| Canon map | **Send proposal** | &lt;2 sheets (nothing to link) | empty-canon-send-proposal-weight |
| Draft Check | **Run Continuity** | empty chapter body (nothing to check) | seeded-default-first-impression P1 |
| Companion Chat | composer / write path | no chapter (nothing to attach to) | companion empty (rat) — door, not enabled composer |

Three separate tips. **One property.**

## Doctrine (one line)

**A solid primary must not advertise a job that cannot succeed in the current state.**

Weight promises the action is available and worth doing now. If a hard precondition is unmet, **solid weight is a lie** even when the control is technically clickable or only disabled.

## Relation to siblings

| Rule | Limits |
|---|---|
| **one-primary-per-job** | How **many** solids compete for the same job in one viewport |
| **runnable solid** (this) | Whether a solid is **entitled to exist** at all |
| **panel ≠ unit of work** | Lock/busy axis is kind-of-work, not face name |
| **empty rulebook when empty** | Empty surfaces share door/rest rules regardless of arrival |

A screen can pass one-primary-per-job perfectly and still **lie** under this rule (empty Canon: New sheet solid + Send solid were different jobs — letter OK, spirit false until Send withheld).

## Product consequences

1. **Omit solid** when precondition fails (preferred), or replace with quiet status.  
2. **Disabled solid is still costume** — same class as companion empty rejection.  
3. **Ghost / secondary** may remain if it teaches the tool without promising “do it now” (D4 propose disclosure OK; solid Send not OK).  
4. **Runnable threshold is job-specific** — express as data the product already knows (`sheets.length`, `body.trim().length`, `hasChapter`).  
5. **Third state:** rules that branch only on empty vs populated miss **seeded / blank-page** (chapter exists, prose empty). Preconditions must name the real enabling fact, not “has a row in the binder.”

## Checkability (ox read for rat / octopus)

**Yes — checkable as structure, not ratio.** Sibling of B6, not a threshold thrash.

### What to assert

For each **catalogued** solid primary in a fixture viewport:

```
solid is allowed only if its declared precondition holds
```

### Preconditions are a small closed catalog (v1)

Do **not** infer “can succeed” from LLM or network. Bind to **DOM/project facts** already on the page:

| Solid job key (examples) | Precondition (machine) | Fixture that must fail if solid present |
|---|---|---|
| `create-sheet` / map New sheet | true-empty Canon OK; or author in create flow | (always runnable when shown as empty CTA) |
| `send-proposal` | `sheets.length >= 2` (and preferably editor open) | true-empty / single-sheet Canon |
| `run-continuity` | active chapter `body.trim().length > 0` | seeded-default empty body; true-empty has no chapter |
| `send-chat` / cowrite generate | `hasChapter` | no-chapter companion |
| `create-chapter` | always runnable when shown | — |

Extend the catalog when a new solid job ships — **explicit registration**, not magic.

### Fixture matrix (three states, not two)

Wherever a rule branches on emptiness or “has work”:

| Fixture | Meaning |
|---|---|
| **true-empty** | 0 chapters and/or 0 sheets as relevant |
| **seeded-default** | 1 empty-body chapter, 0 sheets (first boot) — **first-class**, not a variant |
| **prose-populated** (or multi-sheet) | precondition satisfied for Continuity / edges |

B6 empty fixtures alone will **miss** Continuity-on-blank-chapter. Seeded-default must be a **named calm/primary fixture**.

### HARD when

- Catalog entry exists  
- Fixture owns project state  
- Solid visible (and not inside closed `<details>` — IM1)  
- Precondition false  

→ **HARD fail** (same epistemic bar as B6).  

If a solid has **no catalog precondition**, do not invent one in the checker — file as review-only until product declares the enablement fact. Honest gap &gt; false green.

### What not to check

- Soft quality (“is this a good time to Continuity?”)  
- Live LLM success  
- Disabled-but-solid costume if product still paints primary chrome — **do** fail that (weight lie)  
- Ratio of solids to whitespace  

### Implementation sketch (octopus / badger when scheduled)

- Extend B6 or add **B6-runnable-solid** (name flexible).  
- Reuse `measurePrimaryPerJob` solid scan + `insideClosedDetails`.  
- Join each solid’s job key to precondition predicates evaluated in-page from project/DOM (`data-canon-empty`, chapter body length via manuscript value, sheet count).  
- Fixtures: true-empty Canon (Send), seeded-default Draft+Check (Continuity), no-chapter companion if not already covered.  
- Self-test both ways: precondition false → solid absent; precondition true → solid may be present (not required if collapsed tools).

## Pig P1 note

Seed title change will break `server.test.ts` asserting `'Chapter One'` — update the assertion with the product seed; do not keep the old string as sacred.

## Non-goals

- Do not merge this into one-primary-per-job as a sub-bullet only — it must be findable as its own doctrine.  
- Do not bulk-disable every primary when any busy flag is set (job vs decision locks stay separate).  
- Do not require seeded fixture for every calm check — only for rules that branch on emptiness / first job / Continuity / create weight.

— ox | weight promises runnable; three members → one rule; checkable via catalog + three fixtures
