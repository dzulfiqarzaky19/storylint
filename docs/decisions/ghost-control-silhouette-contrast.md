# Ghost control silhouette contrast (WCAG 1.4.11)

**From:** koala (TASK AW measurements)  
**To:** ox · rat  
**Status:** ruled — see `ghost-control-silhouette-ruling.md` (Option 1, ox). Implementation: `--color-border-control` on `.ui-button--ghost` only.  
**Provenance:** owned-stack computed styles @ `583e897` / rechecked path on `01a3c07`. Method: Playwright getComputedStyle + WCAG 2 relative luminance on effective background. Not TOKENS intent alone.

## Ask

Rule whether ghost controls need a stronger **boundary** (border, fill, or other treatment) so authors can see they are buttons. Do **not** treat this as a silent token bump without a visual call.

## Measurements (dark default unless noted)

| Pair | Computed / token | Ratio | AA UI 3:1 (1.4.11) |
|---|---|---:|---|
| Ghost label `--color-text` on `--color-surface` | `#e3e5e8` on `#1a1a1a` | **13.79:1** | n/a (text PASS 4.5) |
| Ghost border `--color-border` on surface | `#2e2e2e` on `#1a1a1a` | **1.28:1** | **FAIL** |
| Border-strong on surface | `#3f3f3f` on `#1a1a1a` | **1.65:1** | **FAIL** |
| Light theme border on light surface | ~`#d9d2c6` on raised/surface | **~1.33:1** | **FAIL** |

Today’s one-primary-door demotes (`dc059e6`) did **not** change ink. Demoted doors keep readable labels:

| Control (true-empty) | variant | text ratio | border ratio |
|---|---|---:|---:|
| Binder **New sheet** | ghost | 13.79:1 PASS | 1.28:1 FAIL |
| Companion **Write first chapter** | ghost | 12.30:1 PASS | ~1.14:1 FAIL |

So: quieting was weight/shape, not unreadable type. The demote **raises how often** an author must trust the ghost silhouette to know something is a control — especially on the empty Canon/Draft path.

## Scope if changed

Every `.ui-button--ghost` (ecosystem Draft/Lab/Canon, demoted doors, default footer ghosts, etc.). Token-level `--color-border` also paints non-button chrome. A fix is a **product/visual** choice, not a one-line empty-state align.

## Options (for ox)

1. **Stronger ghost border** (e.g. border-strong or a dedicated `--color-border-control` ≥3:1 on surface) — keeps ghost = outline, fixes 1.4.11.
2. **Light fill** on ghost (surface-raised / accent-subtle) — silhouette via fill, border can stay soft.
3. **Different demoted treatment** only on empty doors (not global ghost) — limits calm-budget blast radius; leaves other ghosts weak.
4. **Accept** current ghost outline as chrome grain and rely on label contrast + placement — document exception; know empty-path demotes lean on it harder.

## Explicit non-asks

- No change requested to primary label contrast (already ~11:1).
- P1 empty-row copy (`subtle` → `muted`) is a separate koala land aligning to `ui-empty-state__hint`; not this decision.
- Motion / reduced-motion: closed, no action (AW).

## Rat gate

Rat: measure and write up; **do not fix P2** until ox rules.

— koala | TASK AW P2 handoff
