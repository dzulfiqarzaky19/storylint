# Report line must not outrank the check

**From:** ox (binding; rat brief; hawk unwired-check sweep)
**Kind:** standing measurement / vocabulary
**Status:** **Accept — binding** on `origin/dev`
**Standing:** **8e** (report-strength; sits with 8c/8d)

## Claim

> A report line must not name a stronger verdict than the check performed.

An execution-shaped token on a convention-only check is a **costume**. Readers grepping permanent land logs treat it as coverage evidence. That is the same substitution class as 8c (proxy for execution), one layer up: in the **reporter**, not in the check under test.

## Instance

`e2e/guard-helpers.mjs` emitted:

```text
gate-ok  canon-load-audit.mjs
```

after verifying helpers import + forbidden-pattern absence — a **convention** verdict. Membership is filename/heuristic, not "named in a runner." Files can print `gate-ok` in every land log while no runner ever executes them (`canon-load-audit.mjs`, `canon-under-load-az.mjs`, `graph-audit.mjs` in hawk's sweep).

`gate-ok` does **not** mean gated. The word lied.

## Binding vocabulary (guard notes)

| Token | Meaning | When emitted |
|---|---|---|
| **`convention-ok`** | Helpers import + no forbidden patterns for scripts the guard treats as measurement-shaped | Replaces former `gate-ok` |
| **`legacy-exploratory`** | Grandfathered manual/exploratory driver (already honest) | Unchanged |
| **`diagnostic`** | File header declares `MANUAL DIAGNOSTIC` (or equivalent); not a gate | Emit when guard sees that header on a non-exempt script it would otherwise skip or convention-check — see below |

**Forbidden going forward:** `gate-ok` as a convention token. Do not reintroduce execution words (`gate`, `covered`, `proven`, `PASS` as a per-file convention note) for convention-only work.

Overall guard success line may remain `PASS: e2e helper convention holds` — that names the **guard's own** job (convention), not per-file execution.

## Answers beyond the rename

### 1. Should the guard speak about files not in a runner?

**Stay silent on runner membership.** The guard does not know the runner graph and must not pretend to. Wiring / "in a runner or labelled" is a **separate** check (hawk's greppable can-fail inventory) — that check may fail the build; this guard must not print a soft "unwired" that looks like a mild PASS.

Convention-ok only answers: "this measurement-shaped file obeys helper convention."

### 2. MANUAL DIAGNOSTIC token?

**Yes.** When a non-exempt `.mjs` under `e2e/` contains a file-level `MANUAL DIAGNOSTIC` marker (header comment), the guard should emit:

```text
diagnostic  path/to/file.mjs
```

so the distinction is visible in the land log, not only inside the file. Do **not** call it `diagnostic-ok` (ok implies success of a product claim). Plain `diagnostic` = classified, not executed as gate.

Diagnostics are not required to import helpers unless they also trip measurement-shaped heuristics and are not labelled — prefer: labelled diagnostic ⇒ note + skip gate forbidden rules (or only soft-check). Minimal binding for this land:

- Emit `diagnostic` for header-marked files.
- Do not emit `convention-ok` for the same file in one run (one classification).
- Do not treat diagnostic as legacy-exploratory unless it is on that list.

Builder may refine skip vs convention-check; the **token and non-overlap** are binding.

### 3. Already covered by 8c three duties?

**Same disease family; distinct layer.**  

| Rule | Layer |
|---|---|
| **8c** | Check object / wiring / run before **citing the check** |
| **8d** | Mutation instrument real before citing survival |
| **8e** | **Report token** strength ≤ check strength |

8c.3 says a green is only evidence if the artifact ran. 8e says the **log must not costume** a weaker check as that green. Keep both.

## Rename is the product change for this ruling

1. `gate-ok` → `convention-ok` in `e2e/guard-helpers.mjs`.
2. Add `diagnostic` emission for `MANUAL DIAGNOSTIC` headers (same PR preferred so dolphin/hawk land into stable vocab).
3. No mass rewrite of historical proof artifacts required; new lands use new tokens. Optional note in e2e/README.

## Non-claims

- Does not put every diagnostic into all-smoke.
- Does not make the helper guard a runner-membership gate.
- Does not rename `legacy-exploratory`.
- Does not invalidate old logs that say `gate-ok`; readers of old logs should treat `gate-ok` as **convention-ok (legacy token)**.

## Review cue

If a per-file land-log token contains `gate` / `cover` / `proven`, ask what check ran. Convention → must say convention. Execution → must be a runner result line, not this guard.

— ox | costume verdicts are 8c wearing a reporter badge
