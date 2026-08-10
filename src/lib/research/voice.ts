// Pure research-voice relabel (F2a e). The `who` field is free text; any legacy
// turn stored with the old "Research" speaker label must render as "Collaborator"
// WITHOUT a data migration. Isolating the rule here keeps it unit-testable and
// mutation-proven; Turn.tsx consumes it for display only (no persisted change).

/** The legacy speaker label, superseded by "Collaborator" at display time. */
export const LEGACY_THEM_LABEL = "Research";
/** The current collaborator-voice display label. */
export const COLLABORATOR_LABEL = "Collaborator";

/**
 * Map a stored `who` value to its display label. Legacy "Research" turns show
 * as "Collaborator"; every other label (including the current "Collaborator"
 * and the writer's "You") passes through unchanged.
 */
export function voiceLabel(who: string): string {
  return who === LEGACY_THEM_LABEL ? COLLABORATOR_LABEL : who;
}
