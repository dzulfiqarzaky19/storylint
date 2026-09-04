/**
 * RowIcons — the app's shared inline-SVG glyph set for index-rail rows.
 *
 * One register, everywhere: viewBox "0 0 16 16", a 1em box so the glyph tracks
 * its button's font-size, `stroke="currentColor"` so it inherits whatever colour
 * token the row is painting with, and `aria-hidden` + `focusable="false"` so it
 * stays decorative — the BUTTON's aria-label carries the meaning, never the icon.
 *
 * These live here rather than beside any one surface because /wiki, /write and
 * /research all draw the same rename/delete/disclosure affordances on their rail
 * rows; three private copies had already drifted apart once.
 */

/** Disclosure chevron. A right-pointing glyph; direction is driven by CSS (an
 *  "open" modifier rotates it 90deg). State lives on aria-expanded, not here. */
export function Chevron({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <polyline points="6 4 10 8 6 12" />
    </svg>
  );
}

/** Rename. A visible affordance because double-click is undiscoverable and a
 *  touch device has no double-click at all. */
export function PencilIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M11 2.5 L13.5 5 L5.5 13 L2.5 13.5 L3 10.5 Z" />
      <path d="M10 3.5 L12.5 6" />
    </svg>
  );
}

// TCK-HF2W-A2: this replaced a U+1F5D1 trash EMOJI. An emoji renders in the
// platform's own colour and shape, so it could neither inherit the row's colour
// token nor stay crisp at the sizes these buttons use.
export function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M2.5 4 H13.5" />
      <path d="M6 4 V2.75 A0.75 0.75 0 0 1 6.75 2 H9.25 A0.75 0.75 0 0 1 10 2.75 V4" />
      <path d="M4 4 L4.6 13.1 A1 1 0 0 0 5.6 14 H10.4 A1 1 0 0 0 11.4 13.1 L12 4" />
      <path d="M6.5 7 V11" />
      <path d="M9.5 7 V11" />
    </svg>
  );
}
