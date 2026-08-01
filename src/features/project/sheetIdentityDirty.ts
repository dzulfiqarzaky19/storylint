import { normalizeIdentityText } from '../../domain/identityText.ts'
import type { Sheet, SheetKind } from '../../domain/types.ts'

/** Identity fields the sheet form owns (facts save per-action and are out of scope). */
export type SheetIdentity = {
  kind: SheetKind
  name: string
  aliases: string[]
  summary: string
  notes: string
  portrait: string
}

function normalizeAliases(aliases: readonly string[]): string[] {
  return [...aliases]
    .map((alias) => alias.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
}

/**
 * Normalize identity for dirty comparison.
 * Trims scalar text so type-space-delete is clean; aliases are order-insensitive.
 */
export function normalizeSheetIdentity(
  sheet: Pick<Sheet, 'kind' | 'name' | 'aliases' | 'summary' | 'notes' | 'portrait'> | null | undefined,
): SheetIdentity {
  return {
    kind: sheet?.kind ?? 'character',
    name: normalizeIdentityText(sheet?.name ?? ''),
    aliases: normalizeAliases(sheet?.aliases ?? []),
    summary: normalizeIdentityText(sheet?.summary ?? ''),
    notes: normalizeIdentityText(sheet?.notes ?? ''),
    portrait: normalizeIdentityText(sheet?.portrait ?? ''),
  }
}

/**
 * True only when draft identity differs from the loaded snapshot
 * (values at open or last successful save). Not keystroke-based.
 */
export function isSheetIdentityDirty(
  draft: Pick<Sheet, 'kind' | 'name' | 'aliases' | 'summary' | 'notes' | 'portrait'>,
  loaded: Pick<Sheet, 'kind' | 'name' | 'aliases' | 'summary' | 'notes' | 'portrait'> | null | undefined,
): boolean {
  const a = normalizeSheetIdentity(draft)
  const b = normalizeSheetIdentity(loaded)
  if (a.kind !== b.kind) return true
  if (a.name !== b.name) return true
  if (a.summary !== b.summary) return true
  if (a.notes !== b.notes) return true
  if (a.portrait !== b.portrait) return true
  if (a.aliases.length !== b.aliases.length) return true
  for (let i = 0; i < a.aliases.length; i += 1) {
    if (a.aliases[i] !== b.aliases[i]) return true
  }
  return false
}
