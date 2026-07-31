import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Sheet } from '../../domain/types.ts'
import { isSheetIdentityDirty, normalizeSheetIdentity } from './sheetIdentityDirty.ts'

function base(overrides: Partial<Sheet> = {}): Sheet {
  return {
    id: 'sheet-1',
    kind: 'character',
    name: 'Kael',
    aliases: ['The Blade', 'K'],
    summary: 'A tired knight.',
    notes: 'Keep oath quiet.',
    portrait: '⚔️',
    facts: [],
    ...overrides,
  }
}

test('untouched sheet is clean', () => {
  const sheet = base()
  assert.equal(isSheetIdentityDirty(sheet, sheet), false)
})

test('null loaded matches empty identity only', () => {
  assert.equal(
    isSheetIdentityDirty(
      {
        kind: 'character',
        name: '',
        aliases: [],
        summary: '',
        notes: '',
        portrait: '',
      },
      null,
    ),
    false,
  )
  assert.equal(
    isSheetIdentityDirty(
      {
        kind: 'character',
        name: 'Kael',
        aliases: [],
        summary: '',
        notes: '',
        portrait: '',
      },
      null,
    ),
    true,
  )
})

test('typed then reverted is clean', () => {
  const loaded = base()
  const draft = base({ name: 'Kael the Bold' })
  assert.equal(isSheetIdentityDirty(draft, loaded), true)
  assert.equal(isSheetIdentityDirty(base({ name: 'Kael' }), loaded), false)
})

test('whitespace-only change on trimmed fields is clean', () => {
  const loaded = base({ name: 'Kael', summary: 'A tired knight.', notes: 'Keep oath quiet.', portrait: '⚔️' })
  const draft = base({
    name: '  Kael  ',
    summary: '  A tired knight.  ',
    notes: '  Keep oath quiet.  ',
    portrait: '  ⚔️  ',
  })
  assert.equal(isSheetIdentityDirty(draft, loaded), false)
})

test('aliases reordered are clean; actually changed are dirty', () => {
  const loaded = base({ aliases: ['The Blade', 'K'] })
  assert.equal(isSheetIdentityDirty(base({ aliases: ['K', 'The Blade'] }), loaded), false)
  assert.equal(isSheetIdentityDirty(base({ aliases: ['K', 'The Blade', 'Sir'] }), loaded), true)
  assert.equal(isSheetIdentityDirty(base({ aliases: ['K'] }), loaded), true)
})

test('alias whitespace and empty tokens normalize clean', () => {
  const loaded = base({ aliases: ['The Blade', 'K'] })
  assert.equal(isSheetIdentityDirty(base({ aliases: ['  K  ', '', 'The Blade'] }), loaded), false)
})

test('kind changed is dirty', () => {
  const loaded = base({ kind: 'character' })
  assert.equal(isSheetIdentityDirty(base({ kind: 'lore' }), loaded), true)
})

test('portrait changed is dirty', () => {
  const loaded = base({ portrait: '⚔️' })
  assert.equal(isSheetIdentityDirty(base({ portrait: '🛡️' }), loaded), true)
  assert.equal(isSheetIdentityDirty(base({ portrait: undefined }), loaded), true)
})

test('normalizeSheetIdentity trims and sorts aliases', () => {
  assert.deepEqual(
    normalizeSheetIdentity({
      kind: 'world',
      name: '  Vale  ',
      aliases: ['b', ' a ', ''],
      summary: ' s ',
      notes: ' n ',
      portrait: ' p ',
    }),
    {
      kind: 'world',
      name: 'Vale',
      aliases: ['a', 'b'],
      summary: 's',
      notes: 'n',
      portrait: 'p',
    },
  )
})
