import type { Kind, ResearchScope } from "@/lib/domain/types";

/** A selectable scope for a research thread, shown in the create picker + switcher. */
export interface ScopeOption {
  value: ResearchScope;
  label: string;
}

/** Display label per wiki kind when it appears as a scope (plural, reader-facing). */
export const SCOPE_KIND_LABEL: Record<Kind, string> = {
  character: "People",
  world: "Places",
  organization: "Orders",
  lore: "Lore",
};

/** Canonical order the kind scopes appear in, independent of entry insertion order. */
const KIND_ORDER: Kind[] = ["character", "world", "organization", "lore"];

/**
 * The scope options offered for a research thread, given the current wiki entries.
 *
 * - `Chat` is ALWAYS first (broad conversation, no wiki context).
 * - Each wiki kind with at least one entry contributes one option; kinds with
 *   zero entries are HIDDEN (dynamic, F4-P2-S2).
 */
export function availableScopeOptions(
  entries: readonly { kind: Kind }[],
): ScopeOption[] {
  const options: ScopeOption[] = [{ value: "chat", label: "Chat" }];
  for (const kind of KIND_ORDER) {
    const count = entries.filter((e) => e.kind === kind).length;
    if (count >= 1) {
      options.push({ value: kind, label: SCOPE_KIND_LABEL[kind] });
    }
  }
  return options;
}
