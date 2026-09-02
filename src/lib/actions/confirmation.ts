// Product rule 1 — "Nothing enters the wiki without an explicit confirmation."
//
// This module encodes that invariant in the TYPE SYSTEM. A `WikiWriteConfirmation`
// is a branded token that can only be produced by `confirmWikiWrite({ confirmed: true })`.
// Every wiki-writing mutation helper requires this token as a parameter, so a
// non-confirmed code path cannot even type-check a call that writes to the wiki.
//
// The server actions permitted to mint a token (and therefore the only paths
// that reach the wiki) are:
//   * research.ts  -> confirmCard          ("Yes, write it in")
//   * wiki.ts      -> addSuggestionAsFact  ("Write it in" on the poster band)
//   * wiki.ts      -> linkEntry            (a tie between existing entries)
//   * wiki.ts      -> editEntry / editFact / createEntry / createFact
//        (manual authoring — inherently confirmed: the user typed it and saved).
//
// Every one of these is an EXPLICIT user act. Do not export a way to fabricate
// this token without the `confirmed: true` gate.

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
  // `wikiWriteBrand` is a TYPE-ONLY unique symbol (declare const): it has no
  // runtime value, so it must NOT appear as a runtime computed key. The token's
  // brand is a compile-time phantom; an empty object carries it structurally.
  return {} as WikiWriteConfirmation;
}

/** Per-mutation write envelope. Shared by every rail so a failed write surfaces. */
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// ---- Shared write-action guards (T-ARCH-5) ---------------------------------
//
// Hand-copied near-verbatim in wiki.ts/plot.ts (`requireWorldId`+`fail`) and
// inline in research.ts (`errMessage` + an inline refuse). One source here;
// callers import instead of re-deriving. Zero intended behavior change: each
// call site keeps its EXACT prior error text via the `suffix` param.

/** The one error-to-string reducer. Was hand-copied as `errMessage` (research.ts)
 * and `messageOf` (write.ts) and inline in `fail`; unified here (T-ARCH-8). */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Wraps a caught error into the shared `ActionResult` failure envelope. */
export function fail(err: unknown, where: string): { ok: false; error: string } {
  return { ok: false, error: `${where}: ${errorMessage(err)}` };
}

/**
 * The write-action envelope (T-ARCH-6). Runs a server action body and routes any
 * thrown error through `fail`, so an action collapses to its real logic:
 *
 *   export async function untie(input): Promise<ActionResult> {
 *     return runAction("wiki.untie", async () => { ... });
 *   }
 *
 * `where` preserves the exact prior prefix each call site passed to `fail`, so
 * the produced error string is byte-identical to the hand-written try/catch it
 * replaces. One seam: a change to how a failed write is shaped lives here.
 */
export async function runAction<T>(
  where: string,
  fn: () => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (err) {
    return fail(err, where);
  }
}

/**
 * Like `runAction`, but the failure carries the BARE error message with no
 * `where:` prefix. research.ts and write.ts surface these strings straight to
 * the user (and tests assert them verbatim, e.g. `toBe('gateway 500')`), so the
 * prefix must not be added. Same envelope, unprefixed shape (T-ARCH-8).
 */
export async function runActionBare<T>(
  fn: () => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

// TCK-E06 FAIL CLOSED: a NEW entry/thread/lane is invisible on its screen
// until it has a world link (loadWorldSnapshot / loadPlotProgression / the
// research rail all JOIN membership on the active world). If the caller
// cannot name that world we must REJECT the write rather than mint a
// persisted-but-invisible orphan. `suffix` preserves each caller's original
// wording (wiki's fuller phrasing is the default); pass "" for plot's
// shorter text, or a custom suffix to match another site's existing message.
export function requireWorldId(
  worldId: string | undefined,
  where: string,
  suffix: string = " - refusing to create a world-orphan entry",
): { ok: true; worldId: string } | { ok: false; error: string } {
  const trimmed = worldId?.trim();
  if (!trimmed) {
    return { ok: false, error: `${where}: missing worldId${suffix}` };
  }
  return { ok: true, worldId: trimmed };
}
