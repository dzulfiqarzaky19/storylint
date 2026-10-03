import type { Kind } from "@/domain/types";

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

export function roleVocabFor(categoryId: string): readonly string[] {
  return ROLE_VOCAB[categoryId as Kind] ?? ROLE_VOCAB.lore;
}
