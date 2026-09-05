/**
 * T-WIKI-COCKPIT-3: static per-kind role vocabulary for the Ties chip picker.
 * Deterministic — no DB table, mirrors KIND_LABEL pattern.
 */
import type { Kind } from "@/lib/domain/types";

/** Static role vocabularies keyed by Kind. Each array is a flat list of common
 *  relationship roles for that kind, used as clickable chips in the Ties chip picker.
 *  The writer can still free-type any role that isn't in this list. */
export const ROLE_VOCAB: Record<Kind, readonly string[]> = {
  character: [
    "friend", "enemy", "rival", "mentor", "student",
    "parent", "child", "sibling", "spouse", "lover",
    "employer", "employee", "colleague", "neighbor", "stranger",
    "ally", "adversary", "traveler", "captor", "prisoner",
  ] as const,
  world: [
    "home", "origin", "destination", "border", "contested",
    "allied", "enemy territory", "uncharted", "sacred", "forbidden",
  ] as const,
  organization: [
    "leader", "member", "founder", "rival", "ally",
    "supplier", "enemy", "client", "infiltrator", "defector",
  ] as const,
  lore: [
    "source", "context", "antagonist", "catalyst", "revelation",
    "legend", "prophecy", "curse", "blessing", "mystery",
  ] as const,
} as const;

/**
 * Look up the role vocabulary for a category id (which may be a Kind legacy id
 * or a user UUID). Returns the matching vocab, or the full lore vocab as the
 * safe default when the category id doesn't match a known Kind.
 */
export function roleVocabFor(categoryId: string): readonly string[] {
  return ROLE_VOCAB[categoryId as Kind] ?? ROLE_VOCAB.lore;
}
