import type { SheetKind } from '../../domain/types.ts'

export { SHEET_KINDS } from '../../domain/types.ts'
export type { Chapter, Sheet, SheetKind } from '../../domain/types.ts'
export type { TranscriptEntry } from '../../agent/types.ts'

export const SHEET_KIND_LABEL: Record<SheetKind, string> = {
  character: 'Characters',
  lore: 'Lore',
  world: 'World',
  organization: 'Organizations',
}
