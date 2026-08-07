# Building with Storylint

Storylint is a novel-writing workspace. The design language is quiet, paper-and-ink, dark by
default — not a generic SaaS blue. Chrome is near-black; the accent is a warm brass, used
sparingly for the *active* thing only.

## Setup: theme goes on a root element

All tokens live on `:root` and are **dark by default**. Two independent switches, both set as
attributes on an ancestor (the app puts them on `<html>`):

- `data-theme="dark" | "light"` — the app chrome. Dark is the default; `light` is a warm paper
  desk, not a white one.
- `data-reading="day" | "sepia" | "mint" | "night"` — the *manuscript paper* only. Independent
  of chrome theme. `Manuscript` reads it from an ancestor, so wrap it.

The DS also assumes the page background is painted with `var(--color-canvas)` — the shipped
stylesheet does this on `body`. If you render into a container that sets its own background,
paint it yourself or components will sit on the wrong canvas:

```jsx
<div data-theme="dark" style={{ background: 'var(--color-canvas)', color: 'var(--color-text)' }}>
  {/* … */}
</div>
```

## Styling idiom: tokens only — there are no utility classes

**There is no Tailwind and no utility-class vocabulary.** Do not write `bg-surface-1`, `p-4`, or
any utility name — none of them resolve. Style your own layout with `var(--token)` values in
plain CSS or inline styles. Never write a raw hex or a raw px value: if a value is missing, the
correct fix is a new token, not a literal.

Component internals use `.ui-*` classes (`.ui-button--primary`, `.ui-list-row--active`,
`.ui-badge--danger`). Treat those as private — you get at them through props, and every
component forwards `className` if you need to attach your own.

Real token families (all verified in the shipped stylesheet):

| Family | Names |
|---|---|
| Surfaces | `--color-canvas`, `--color-surface`, `--color-surface-raised`, `--color-surface-overlay`, `--color-paper`, `--color-paper-ink` |
| Text | `--color-text`, `--color-text-muted`, `--color-text-subtle`, `--color-text-inverse` |
| Accent / status | `--color-accent`, `--color-accent-hover`, `--color-accent-muted`, `--color-accent-subtle`, `--color-primary`, `--color-success`, `--color-warning`, `--color-danger`, `--color-pending` |
| Continuity marks | `--color-mark-red`, `--color-mark-red-bg`, `--color-mark-yellow`, `--color-mark-yellow-bg` |
| Borders / focus | `--color-border`, `--color-border-strong`, `--color-border-control`, `--border-width`, `--color-focus-ring`, `--focus-ring-width`, `--focus-ring-offset` |
| Spacing | `--space-0` … `--space-16` (`0,1,2,3,4,5,6,8,10,12,16`) |
| Radius | `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl`, `--radius-pill` |
| Type | `--text-xs`, `--text-sm`, `--text-body`, `--text-md`, `--text-lg`, `--text-xl`, `--text-manuscript`, `--text-manuscript-title`; `--leading-*`, `--weight-regular/medium/semibold` |
| Fonts | `--font-ui`, `--font-manuscript` (serif — manuscript body only), `--font-mono` |
| Sizing | `--size-control`, `--size-icon`, `--size-icon-sm`, `--size-icon-lg`, `--size-binder`, `--size-agent`, `--size-topbar` |
| Layering | `--z-base`, `--z-rail`, `--z-dropdown`, `--z-drawer`, `--z-overlay`, `--z-modal`, `--z-toast` |

Focus states: add `ui-focusable` to anything custom that takes focus so it picks up the shared
focus ring. Icons are bare `<svg>` with no intrinsic size — always size them (inside
`IconButton` they get `--size-icon` automatically).

## Where the truth is

Read `_ds/<folder>/styles.css` and everything it `@import`s before styling — it is the whole
palette and the component CSS. Per-component API and examples live in each
`components/<group>/<Name>/<Name>.prompt.md`.

## Idiomatic example

```jsx
import { Badge, Button, ListRow } from 'storylint'

<div data-theme="dark" style={{ background: 'var(--color-canvas)', color: 'var(--color-text)' }}>
  <section style={{
    display: 'flex', flexDirection: 'column', gap: 'var(--space-2)',
    padding: 'var(--space-3)', background: 'var(--color-surface)',
    border: 'var(--border-width) solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
  }}>
    <ListRow active meta="1,842">1. The Lighthouse Keeper</ListRow>
    <ListRow meta="2,310">2. Salt and Rope</ListRow>
    <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
      <Badge tone="danger">Contradiction</Badge>
      <Button variant="primary">Run Continuity</Button>
    </div>
  </section>
</div>
```

`Shell`, `Binder`, `Manuscript` and `AgentPanel` are whole app regions wired to Storylint's own
domain types — compose apps from the primitives, and reach for those four only when you
genuinely want the workspace layout.
