# design-sync notes — storylint

Repo-specific gotchas for future syncs. Read this before touching `config.json`.

## Build shape

- This repo is a **private Vite app, not a published library**. `package.json` has no
  `main`/`module`/`exports`, and root `dist/` is an *app* bundle — never the DS entry.
- `npm` will not self-install `node_modules/storylint`, so the converter's default
  `PKG_DIR = node_modules/<pkg>` fails with `ENOENT … storylint/package.json`. **Always pass
  `--entry ./.design-sync/ds-entry.ts`** — that file re-exports the whole component set and
  makes `PKG_DIR` resolve to the repo root by walking up to the nearest named `package.json`.
- **`types/` must be regenerated before every build**: `npx tsc -p .design-sync/tsconfig.dts.json`.
  Without a `.d.ts` tree, `findTypesRoot` falls back to the repo root, finds nothing, and every
  prop contract silently collapses to `{ [key: string]: unknown }` — the build still exits 0, so
  this fails quietly. `types/` is gitignored.
- `cfg.tokensGlob` is resolved under `--node-modules`, not the repo, so a repo-relative value
  silently produces an empty `tokens/` dir. Tokens are not shipped that way here — they arrive
  inlined in `_ds_bundle.css` via the JS import chain (`src/design/index.ts` imports
  `tokens.css`). Leave `tokensGlob` unset.

## CSS

- `cfg.cssEntry` points at **`.design-sync/globals.css`**, not `src/index.css`. It is
  `src/index.css` with its first line (`@import './design/tokens.css'`) removed: the converter
  appends `cssEntry` verbatim, and that relative import does not resolve in the output
  (`[CSS_IMPORT_MISSING]`). The tokens it referenced are already in `_ds_bundle.css`.
- The preview card template hardcodes `body{background:#fff}` **after** the stylesheet links.
  This DS is dark-first (`:root` → `--color-canvas: #0e0e0e`), so cards rendered on white and
  low-contrast rows were invisible. Fixed by `cfg.provider` → `DsPreviewRoot`
  (`.design-sync/preview-root.tsx`), which paints `--color-canvas` and sets `data-theme="dark"`.
  It is excluded from the component list via `componentSrcMap: {"DsPreviewRoot": null}`.

## Render check / browser

- Playwright is **not** a repo dependency. The global package at `D:/npm-global/node_modules`
  is junction-linked into `.ds-sync/node_modules/{playwright}`; `playwright-core` is not present
  globally but is not needed.
- Run validate/capture with `DS_CHROMIUM_PATH` pointed at system Edge:
  `/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe`. Per this machine's rules,
  do **not** `playwright install chromium` on Windows without asking first.

## Component composition

- `.ui-drawer` ships **no padding** — drawer content must supply its own.
- Shell icons (`BinderIcon`, `AgentIcon`, `FocusIcon`, `ThemeIcon`) are bare
  `<svg viewBox="0 0 16 16">` with no intrinsic size. Outside `IconButton` (which sizes them via
  `.ui-icon-button > svg { width: var(--size-icon) }`) they expand to fill and trip
  `[RENDER_THIN]`. Always preview them inside a sized wrapper.
- `.manuscript` has no `flex`/`width`, and its children are `width: 100%`. As a **flex** child it
  collapses to zero and renders blank. Preview wrappers must use `display: grid`.
- `Manuscript` reads the paper profile from an **ancestor** `[data-reading]` attribute, not from
  its own `reading` prop (the prop only drives the bookmark chip). Wrappers set both.
- Preview fixtures live in `.design-sync/fixtures.ts`, built from `src/domain/types.ts` and
  `src/agent/types.ts`. Mark/proposal spans are computed from string lengths so
  `body.slice(start, end) === span.text` stays true — do not hand-edit the offsets.

## Known render warns

These are triaged as legitimate. An unrecorded warn on a future sync means something new:

- `[FONT_MISSING]` — "Literata", "Source Serif 4", "Cascadia Code", "Fira Code". **Expected and
  correct.** These are optional entries in stacks that already begin with system fonts
  (`--font-manuscript` starts Georgia/Times New Roman; `--font-mono` falls back to
  `ui-monospace`). The repo ships no webfonts by design. Do **not** "fix" this with
  `cfg.extraFonts`.
- `tokens: 2 missing` — below threshold, unchanged across the run.

## Card modes

`cfg.overrides` card modes are presentation-only and exist because these components are wider
than a grid cell: `column` for AgentPanel, Badge, Binder, Input, ListRow, Manuscript, Textarea;
`single` for Drawer (overlay, `760x420`) and Shell (fixed-position chrome, `primaryStory:
AppShell`).

## Re-sync risks

- **`globals.css` is a hand-maintained copy** of `src/index.css` minus the tokens import. If
  `src/index.css` changes, this file silently goes stale. Diff them on every sync.
- **`Shell` renders a red "Not Found" bar.** `Shell` is a self-contained app root that fetches
  its project on mount; with no backend behind the preview it lands in the not-found state. The
  chrome, place tabs and empty state above it are real — the error bar is the offline data
  layer, not a design element. If Storylint ever gains a fixture/offline mode, revisit this card.
- **Shell-region previews inline fixture data** (`Chapter`, `Sheet`, `Proposal`, `Project`,
  `TranscriptEntry`). These drift as domain types change; a type change may compile fine but
  render a misleading card. Re-read the sheets after any `src/domain/types.ts` change.
- `AgentPanel`, `Binder`, `Manuscript` and `Shell` are app regions wired to Storylint's own
  domain, not reusable primitives. They were included at the user's explicit request.
- Build assumed: node 26.5, playwright 1.57 (global), Edge as render browser, `npm` lockfile.
