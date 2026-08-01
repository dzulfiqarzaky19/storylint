import assert from 'node:assert/strict'
import { test } from 'node:test'
import { normalizeIdentityText } from './identityText.ts'
import { normalizeLabCardText } from './lab.ts'
import { normalizeSheetIdentity } from '../features/project/sheetIdentityDirty.ts'

test('Lab and sheet identity text share normalizeIdentityText (coupled, not coincident)', () => {
  const samples = ['  hello  ', 'x', '', '  a b  ', '\tpad\n']
  for (const sample of samples) {
    assert.equal(
      normalizeLabCardText(sample, sample).title,
      normalizeIdentityText(sample),
      `lab title must equal shared normalizer for ${JSON.stringify(sample)}`,
    )
    assert.equal(
      normalizeLabCardText(sample, sample).body,
      normalizeIdentityText(sample),
    )
    assert.equal(
      normalizeSheetIdentity({
        kind: 'character',
        name: sample,
        aliases: [],
        summary: sample,
        notes: sample,
        portrait: sample,
      }).name,
      normalizeIdentityText(sample),
      `sheet name must equal shared normalizer for ${JSON.stringify(sample)}`,
    )
  }
})
