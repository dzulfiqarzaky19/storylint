// =============================================================================
// resolveConfirmTarget (F6-S3b) — PURE. Maps the confirmation strip's user
// choice to the `enrichEntryId` argument confirmCard expects.
//
// The strip offers three actions when a recommendation exists:
//   - "Enrich <name>"        -> choice { kind: "recommended" }  -> rec.entryId
//   - "New entry instead"    -> choice { kind: "new" }          -> undefined
//   - pick a specific entry  -> choice { kind: "pick", entryId } -> that entryId
//
// undefined means "create a new entry" (confirmCard's default path). This is the
// single behavior-bearing decision behind the strip; the rest of the strip is
// presentational markup.
// =============================================================================

export type ConfirmTargetChoice =
  | { kind: "recommended" }
  | { kind: "new" }
  | { kind: "pick"; entryId: string };

export interface ConfirmRecommendation {
  entryId: string;
  name: string;
}

/**
 * The `enrichEntryId` to pass to confirmCard for a given strip choice, or
 * undefined to create a new entry.
 * @param choice what the writer clicked in the strip.
 * @param recommendation the recommender's suggestion, or null when none.
 */
export function resolveConfirmTarget(
  choice: ConfirmTargetChoice,
  recommendation: ConfirmRecommendation | null,
): string | undefined {
  switch (choice.kind) {
    case "recommended":
      // Only enrich the recommendation when one actually exists; otherwise fall
      // back to a new entry (never send a bogus/empty enrich target).
      return recommendation ? recommendation.entryId : undefined;
    case "pick":
      return choice.entryId;
    case "new":
      return undefined;
  }
}
