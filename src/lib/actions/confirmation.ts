// Product rule 1 — "Nothing enters the wiki without an explicit confirmation."
//
// This module encodes that invariant in the TYPE SYSTEM. A `WikiWriteConfirmation`
// is a branded token that can only be produced by `confirmWikiWrite({ confirmed: true })`.
// Every wiki-writing mutation helper requires this token as a parameter, so a
// non-confirmed code path cannot even type-check a call that writes to the wiki.
//
// The ONLY two server actions permitted to mint a token (and therefore the only
// two paths that reach the wiki) are:
//   * research.ts  -> confirmCard          ("Yes, write it in")
//   * wiki.ts      -> addSuggestionAsFact  ("Write it in" on the poster band)
//
// Do not export a way to fabricate this token without the `confirmed: true` gate.

declare const wikiWriteBrand: unique symbol;

/**
 * Opaque proof that an explicit wiki-write confirmation happened. Not
 * constructible except via `confirmWikiWrite`. Passed to wiki-writing helpers.
 */
export interface WikiWriteConfirmation {
  readonly [wikiWriteBrand]: true;
}

/**
 * The confirmation gate. Requires a literal `confirmed: true`; anything else is
 * a type error. Returns the branded token the wiki-write helpers demand.
 *
 * @throws if called with `confirmed` other than true (defence in depth for
 *         non-TS callers; the type signature already blocks it at compile time).
 */
export function confirmWikiWrite(input: { confirmed: true }): WikiWriteConfirmation {
  if (input.confirmed !== true) {
    // Unreachable via TypeScript; guards JS callers / erased types.
    throw new Error("confirmWikiWrite: explicit confirmation required (product rule 1).");
  }
  return { [wikiWriteBrand]: true } as WikiWriteConfirmation;
}
