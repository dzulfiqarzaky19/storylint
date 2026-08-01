import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Sheet } from '../../domain/types.ts'
import { normalizeSheetIdentity } from './sheetIdentityDirty.ts'
import {
  DRAFT_STALE_CONFIRM_MS,
  applyIdentityDraft,
  decideRestore,
  draftStorageKey,
  parseDraftRecord,
  readSheetIdentityDraft,
  removeSheetIdentityDraft,
  storeSheetIdentityDraft,
  type SheetIdentityDraftRecord,
} from './sheetIdentityDraft.ts'

function baseSheet(overrides: Partial<Sheet> = {}): Sheet {
  return {
    id: 'sheet-kael',
    kind: 'character',
    name: 'Kael',
    aliases: ['K'],
    summary: 'A tired knight.',
    notes: 'Keep oath quiet.',
    portrait: '⚔️',
    facts: [],
    ...overrides,
  }
}

function memoryStorage(seed: Record<string, string> = {}) {
  const map = new Map<string, string>(Object.entries(seed))
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => {
      map.set(k, v)
    },
    removeItem: (k: string) => {
      map.delete(k)
    },
    _map: map,
  }
}

test('draftStorageKey scopes project + sheet; empty sheet → __new__', () => {
  assert.equal(
    draftStorageKey('proj-a', 'sheet-1'),
    'storylint:sheet-identity-draft:v1:proj-a:sheet-1',
  )
  assert.equal(
    draftStorageKey('proj-a', ''),
    'storylint:sheet-identity-draft:v1:proj-a:__new__',
  )
})

test('store while dirty; read back base+draft+savedAt', () => {
  const storage = memoryStorage()
  const server = baseSheet()
  const dirty = baseSheet({ name: 'Kael Dirty Refresh' })
  const base = normalizeSheetIdentity(server)
  storeSheetIdentityDraft('p1', server.id, dirty, base, storage, 1_700_000_000_000)
  const got = readSheetIdentityDraft('p1', server.id, storage)
  assert.ok(got)
  assert.equal(got!.draft.name, 'Kael Dirty Refresh')
  assert.equal(got!.base.name, 'Kael')
  assert.equal(got!.savedAt, 1_700_000_000_000)
})

test('store while clean removes key', () => {
  const storage = memoryStorage()
  const server = baseSheet()
  const base = normalizeSheetIdentity(server)
  storeSheetIdentityDraft('p1', server.id, baseSheet({ name: 'X' }), base, storage, 1)
  assert.ok(readSheetIdentityDraft('p1', server.id, storage))
  storeSheetIdentityDraft('p1', server.id, server, base, storage, 2)
  assert.equal(readSheetIdentityDraft('p1', server.id, storage), null)
})

test('removeSheetIdentityDraft clears key', () => {
  const storage = memoryStorage()
  const server = baseSheet()
  storeSheetIdentityDraft('p1', server.id, baseSheet({ name: 'X' }), normalizeSheetIdentity(server), storage, 1)
  removeSheetIdentityDraft('p1', server.id, storage)
  assert.equal(readSheetIdentityDraft('p1', server.id, storage), null)
})

test('decideRestore: server equals base → apply (not stale)', () => {
  const server = baseSheet()
  const record: SheetIdentityDraftRecord = {
    base: normalizeSheetIdentity(server),
    draft: normalizeSheetIdentity(baseSheet({ name: 'Kael Dirty' })),
    savedAt: 1_000,
  }
  const d = decideRestore(record, server, 1_000 + 60_000)
  assert.equal(d.kind, 'apply')
  if (d.kind === 'apply') assert.equal(d.staleConfirm, false)
})

test('decideRestore: server equals draft → drop-equal-server', () => {
  const draftId = normalizeSheetIdentity(baseSheet({ name: 'Saved Already' }))
  const record: SheetIdentityDraftRecord = {
    base: normalizeSheetIdentity(baseSheet({ name: 'Old' })),
    draft: draftId,
    savedAt: 1,
  }
  const d = decideRestore(record, baseSheet({ name: 'Saved Already' }), 2)
  assert.equal(d.kind, 'drop-equal-server')
})

test('decideRestore: server differs from both → conflict (no auto-pick)', () => {
  const record: SheetIdentityDraftRecord = {
    base: normalizeSheetIdentity(baseSheet({ name: 'Base' })),
    draft: normalizeSheetIdentity(baseSheet({ name: 'Mine' })),
    savedAt: 1,
  }
  const d = decideRestore(record, baseSheet({ name: 'ServerMoved' }), 2)
  assert.equal(d.kind, 'conflict')
  if (d.kind === 'conflict') {
    assert.equal(d.server.name, 'ServerMoved')
    assert.equal(d.record.draft.name, 'Mine')
    // Mutation: if someone auto-picks, this fixture fails.
    assert.notEqual(d.server.name, d.record.draft.name)
    assert.notEqual(d.server.name, d.record.base.name)
  }
})

test('decideRestore: older than 7d still apply but staleConfirm', () => {
  const server = baseSheet()
  const record: SheetIdentityDraftRecord = {
    base: normalizeSheetIdentity(server),
    draft: normalizeSheetIdentity(baseSheet({ name: 'OldDraft' })),
    savedAt: 1_000,
  }
  const d = decideRestore(record, server, 1_000 + DRAFT_STALE_CONFIRM_MS + 1)
  assert.equal(d.kind, 'apply')
  if (d.kind === 'apply') assert.equal(d.staleConfirm, true)
})

test('decideRestore: null record → none', () => {
  assert.equal(decideRestore(null, baseSheet()).kind, 'none')
})

test('applyIdentityDraft overlays identity only; keeps facts/id', () => {
  const sheet = baseSheet({
    facts: [{ id: 'f1', key: 'oath', value: 'keep', statement: 'oath: keep', claimKind: 'attribute' }],
  })
  const next = applyIdentityDraft(
    sheet,
    normalizeSheetIdentity(baseSheet({ name: 'New', summary: 'S' })),
  )
  assert.equal(next.id, 'sheet-kael')
  assert.equal(next.name, 'New')
  assert.equal(next.summary, 'S')
  assert.equal(next.facts.length, 1)
  assert.equal(next.facts[0]?.id, 'f1')
})

test('parseDraftRecord rejects garbage; accepts valid', () => {
  assert.equal(parseDraftRecord('not-json'), null)
  assert.equal(parseDraftRecord('{}'), null)
  const ok = parseDraftRecord(
    JSON.stringify({
      base: normalizeSheetIdentity(baseSheet()),
      draft: normalizeSheetIdentity(baseSheet({ name: 'X' })),
      savedAt: 42,
    }),
  )
  assert.ok(ok)
  assert.equal(ok!.savedAt, 42)
})

test('MUTATION: conflict decision must not equal apply or drop', () => {
  // Locks the ox override: server-moved is never silent drop or silent apply.
  const record: SheetIdentityDraftRecord = {
    base: normalizeSheetIdentity(baseSheet({ name: 'A' })),
    draft: normalizeSheetIdentity(baseSheet({ name: 'B' })),
    savedAt: 1,
  }
  const d = decideRestore(record, baseSheet({ name: 'C' }), 2)
  assert.equal(d.kind, 'conflict')
  assert.notEqual(d.kind, 'apply')
  assert.notEqual(d.kind, 'drop-equal-server')
  assert.notEqual(d.kind, 'none')
})
