/**
 * Durable dirty — crash copy of form dirty sheet identity (T-004 / ox ruling).
 * Does NOT write Canon. Restore leaves the sheet dirty until Save or Discard.
 * @see docs/decisions/sheet-identity-durable-dirty.md
 */
import type { Sheet } from '../../domain/types.ts'
import {
  isSheetIdentityDirty,
  normalizeSheetIdentity,
  type SheetIdentity,
} from './sheetIdentityDirty.ts'

export const SHEET_IDENTITY_DRAFT_PREFIX = 'storylint:sheet-identity-draft:v1:'

/** Confirm threshold for old drafts — not a silent death clock. */
export const DRAFT_STALE_CONFIRM_MS = 7 * 24 * 60 * 60 * 1000

export type SheetIdentityDraftRecord = {
  base: SheetIdentity
  draft: SheetIdentity
  savedAt: number
}

export type RestoreDecision =
  | { kind: 'none' }
  | { kind: 'apply'; record: SheetIdentityDraftRecord; staleConfirm: boolean }
  | { kind: 'drop-equal-server'; record: SheetIdentityDraftRecord }
  | {
      kind: 'conflict'
      record: SheetIdentityDraftRecord
      server: SheetIdentity
    }

export function draftStorageKey(projectId: string, sheetId: string): string {
  const pid = projectId.trim() || '__no-project__'
  const sid = sheetId.trim() || '__new__'
  return `${SHEET_IDENTITY_DRAFT_PREFIX}${pid}:${sid}`
}

export function identitiesEqual(a: SheetIdentity, b: SheetIdentity): boolean {
  return !isSheetIdentityDirty(a, b)
}

export function applyIdentityDraft<T extends Sheet>(sheet: T, identity: SheetIdentity): T {
  return {
    ...sheet,
    kind: identity.kind,
    name: identity.name,
    aliases: [...identity.aliases],
    summary: identity.summary,
    notes: identity.notes,
    portrait: identity.portrait,
  }
}

function isIdentityShape(value: unknown): value is SheetIdentity {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.kind === 'string' &&
    typeof v.name === 'string' &&
    Array.isArray(v.aliases) &&
    v.aliases.every((a) => typeof a === 'string') &&
    typeof v.summary === 'string' &&
    typeof v.notes === 'string' &&
    typeof v.portrait === 'string'
  )
}

export function parseDraftRecord(raw: string | null | undefined): SheetIdentityDraftRecord | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const rec = parsed as Record<string, unknown>
    if (!isIdentityShape(rec.base) || !isIdentityShape(rec.draft)) return null
    if (typeof rec.savedAt !== 'number' || !Number.isFinite(rec.savedAt)) return null
    return {
      base: normalizeSheetIdentity(rec.base),
      draft: normalizeSheetIdentity(rec.draft),
      savedAt: rec.savedAt,
    }
  } catch {
    return null
  }
}

export function readSheetIdentityDraft(
  projectId: string,
  sheetId: string,
  storage: Pick<Storage, 'getItem'> | null | undefined = globalThis.localStorage,
): SheetIdentityDraftRecord | null {
  if (!storage || !projectId.trim()) return null
  try {
    return parseDraftRecord(storage.getItem(draftStorageKey(projectId, sheetId)))
  } catch {
    return null
  }
}

/**
 * Persist crash copy while form is dirty. No-op when clean or identical to base.
 * Clears the key when not dirty.
 */
export function storeSheetIdentityDraft(
  projectId: string,
  sheetId: string,
  draftSheet: Pick<Sheet, 'kind' | 'name' | 'aliases' | 'summary' | 'notes' | 'portrait'>,
  base: SheetIdentity,
  storage: Pick<Storage, 'setItem' | 'removeItem'> | null | undefined = globalThis.localStorage,
  now: number = Date.now(),
): void {
  if (!storage || !projectId.trim()) return
  const key = draftStorageKey(projectId, sheetId)
  const draft = normalizeSheetIdentity(draftSheet)
  const baseN = normalizeSheetIdentity(base)
  if (!isSheetIdentityDirty(draft, baseN)) {
    try {
      storage.removeItem(key)
    } catch {
      /* ignore */
    }
    return
  }
  const record: SheetIdentityDraftRecord = { base: baseN, draft, savedAt: now }
  try {
    storage.setItem(key, JSON.stringify(record))
  } catch {
    /* quota / private mode — form dirty still works in-memory */
  }
}

export function removeSheetIdentityDraft(
  projectId: string,
  sheetId: string,
  storage: Pick<Storage, 'removeItem'> | null | undefined = globalThis.localStorage,
): void {
  if (!storage || !projectId.trim()) return
  try {
    storage.removeItem(draftStorageKey(projectId, sheetId))
  } catch {
    /* ignore */
  }
}

/**
 * Decide how to treat a stored draft against current server identity.
 * Pure — no I/O. UI applies side effects.
 */
export function decideRestore(
  record: SheetIdentityDraftRecord | null,
  serverSheet: Pick<Sheet, 'kind' | 'name' | 'aliases' | 'summary' | 'notes' | 'portrait'> | null | undefined,
  now: number = Date.now(),
  staleAfterMs: number = DRAFT_STALE_CONFIRM_MS,
): RestoreDecision {
  if (!record) return { kind: 'none' }
  const server = normalizeSheetIdentity(serverSheet)
  if (identitiesEqual(server, record.draft)) {
    return { kind: 'drop-equal-server', record }
  }
  if (identitiesEqual(server, record.base)) {
    const age = now - record.savedAt
    return {
      kind: 'apply',
      record,
      staleConfirm: Number.isFinite(age) && age > staleAfterMs,
    }
  }
  return { kind: 'conflict', record, server }
}
