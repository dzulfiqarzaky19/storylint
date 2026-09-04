# Design — storylint

Locked design system. Future Hallmark runs read this file first; surfaces defer
to it. Amend intentionally — the file is the rule.

This is an **app**, not a marketing site: every surface is a working tool a
novelist sits inside for hours. Read it alongside `CONTEXT.md` (the ubiquitous
language, and the "index rail / signal rail" naming that this file assumes).

## System

- Genre · **editorial** — serif reading face, mono filing labels, paper ground.
- Macrostructure · **Workbench** — index rail (left) · work column (centre) ·
  signal rail (right). /wiki, /write and /research all take this shape; /plot is
  deliberately outside it (modal drill-down drawer, no index rail).
- Theme · **custom — "cockpit paper"**, derived from `prototypes/*-c-cockpit.html`,
  which stay the binding visual reference until a surface is fully ported.
- Axes · light paper (`--ground` L≈93%) / high-contrast-serif display (Fraunces) /
  warm accent (amber, ~60°).

## Tokens

**`src/app/globals.css` `:root` is the source of truth** — not a generated
`tokens.css`. That file's own header states the rule this system runs on:

> Single source of truth for color and geometry. Do not write a hex literal
> anywhere outside this file.

A raw `rgba()` or a bare `120ms ease` at a call site is the same violation as a
raw hex. Emitting a second token file beside it would create the drift the rule
exists to prevent, so this project deliberately has no `tokens.css`.

Groups, and what each is for:

| Group | Rule |
| --- | --- |
| Colour | `--ground` `--panel` `--surface` grounds · `--ink` `--body-ink` text · `--accent` (amber) affordances · `--slate` the wiki-write CONFIRM path only · `--danger` faults · `--warning` unrecorded |
| Type roles | `--font-serif` reading + display · `--font-sans` body/UI · `--font-mono` kickers, labels, counts. Components read the ROLE, never a face name. |
| Type scale | `--text-0` (10px) … `--text-12`, plus `--text-display` for a screen H1. Band headings (26–40px) and optical half-steps (10.5/12.5px) stay literal — art direction, not a reading rung. |
| Space | `--gutter` page inset (steps down at ≤560px) · `--space-1..7` on a 4pt base |
| Geometry | `--radius: 0` for CHROME · `--radius-sm/md/lg/pill` for shapes inside it. A literal radius is a bug. |
| Elevation | `--shadow-card` `--shadow-lift` — ink-tinted, never neutral black |
| Motion | `--dur-short` `--dur-base` · `--ease-out` (house curve) `--ease-in` `--ease-in-out` |

### Colour rules that are not obvious from the values

- **`--faint` is a HAIRLINE tone, never text.** At 2.53:1 on `--panel` it fails
  the WCAG AA 4.5:1 floor. Quiet meta reads in `--muted` (5.09:1).
- **There is no second, quieter text tone.** On this cream paper anything
  lighter than `--muted` drops under the floor. Secondary text is set apart by
  **weight, size and position** — never by a paler colour.
- **`--slate` is reserved** for the one action that writes to the wiki. It is
  not a second accent.
- **Signals never collapse**: a contradiction is red AND solid; an unrecorded
  detail is amber AND dotted. Hue and line style both differ, always.

## Type

Fraunces 400/600/700 · IBM Plex Sans 400/500/600/700 · IBM Plex Mono 400/500/700.

**Never declare a weight the face does not load** — the browser synthesizes a
smeared fake bold. IBM Plex tops out at 700, so nothing in this app asks past it.
800 and 900 are not available and must not appear in a stylesheet.

Headers are roman. Italic is for body-copy emphasis and for lifted quotations
(the signal rail's `.railQuote` is the writer's own prose, so it sets in italic
serif) — never for a heading.

## Component voice

- **Rows** — 40px minimum height across every rail (TCK-HF4). A rail row is a
  tile: `--radius-sm`, hover to `--surface`, active to `--accent-soft`.
- **Row actions** (rename/delete) — hidden with `opacity: 0` + `pointer-events:
  none`, revealed on `:hover` AND `:focus-within`, and permanently visible under
  `@media (hover: none)`. **Never `display: none`** — it removes the buttons from
  the tab order, which is how the wiki rail lost its keyboard path entirely.
- **Cards** — a signal-coloured card takes a full hairline ring in that colour.
  No thick leading stripe; an asymmetric coloured edge is a recognised tell.
- **Icons** — one set: `components/shell/RowIcons.tsx`, 16px viewBox, 1em box,
  `stroke="currentColor"`, `aria-hidden`. No emoji, ever, and no literal `+`/`–`
  standing in for the chevron. The BUTTON's `aria-label` carries the meaning.
- **Buttons** — primary fills `--accent` (or `--slate` on the confirm path);
  secondary is an outline in `--rule` that goes `--accent` on hover.
- **Disclosure** — a control only where it actually discloses. Above 1200px the
  index-rail head is a `<div>`, not a `<button>`: a focusable control that
  expands nothing is a dead end for keyboard users.
- **Inline rename** — there are exactly **two** shapes, and adding a third is a
  regression:
  1. *Field swap* — `useInlineRename` (wiki shelf, wiki index rail, research
     rail, plot drawer). The row swaps to an `<input>`. Enter commits, Escape
     cancels; whether **blur** commits or cancels is the caller's call
     (`onBlur` vs `cancel`), because /research must never write a half-typed
     thread name.
  2. *Edit in place* — `contentEditable` (the /write chapter title and the
     manuscript H1 it mirrors). Used only where the text IS the reading surface.
- **Never nest interactive content in a `<button>`.** A `contentEditable` is
  interactive content. Where a row must be both clickable and editable, the
  select target is a **stretched empty overlay** (`.itemSelect`), the content
  sits above it at `pointer-events: none`, and only the editable text takes its
  events back. Nesting them costs you the screen-reader announcement and buys a
  pile of `stopPropagation`.

## Motion stance

Near-silent. Transitions are `--dur-short var(--ease-out)` on `opacity`,
`transform`, `background`, `border-color` — nothing else, and never `all`.

- The bare `ease` keyword is banned; it is the browser default and reads generic.
- **Focus rings never animate.** Global `:focus-visible` is `2px solid
  var(--accent)` at `2px` offset, instant.
- Every animation has a `prefers-reduced-motion: reduce` branch.

## Responsive

One structural breakpoint at **1200px** (rails fold to sticky-bottom
disclosures; the page scrolls as one document) and a phone tier at **560px**
(gutter and `--text-display` step down, tap targets go to 44px).

`html, body` carry `overflow-x: clip` at every width. Scrollbars are hidden
app-wide — panels and rails carry their own rules and counts as the depth cue.

## Exports

`src/app/globals.css` is the source of truth. For Tailwind v4 `@theme`, DTCG
`tokens.json`, or shadcn/ui CSS variables, ask *"extend design.md with Tailwind
exports"* and Hallmark will append them.
