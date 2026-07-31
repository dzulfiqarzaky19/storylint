import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Project } from '../domain/types.ts'
import { projectGraph } from './projectGraph.ts'
import { upsertFact } from '../domain/project.ts'

function fixture(): Project {
  return {
    schemaVersion: 1,
    title: 'Graph fixture',
    chapters: [{ id: 'ch-1', title: 'Opening', body: '', craftTags: [], revision: 0 }],
    sheets: [
      {
        id: 'aria', kind: 'character', name: 'Aria', aliases: [], summary: '', notes: '', portrait: '🔥',
        facts: [
          { id: 'rel-1', key: 'member_of', value: 'Ember Order', statement: 'Aria belongs to the Ember Order', claimKind: 'relationship', fromSheetId: 'aria', toSheetId: 'order' },
          { id: 'attr-1', key: 'eye_color', value: 'blue', statement: 'Blue eyes', claimKind: 'attribute' },
        ],
      },
      { id: 'order', kind: 'organization', name: 'Ember Order', aliases: [], summary: '', notes: '', facts: [] },
      { id: 'lore', kind: 'lore', name: 'The Ember', aliases: [], summary: '', notes: '', facts: [] },
    ],
    proposals: [{
      id: 'pending-rel', fingerprint: 'pending-rel', status: 'pending', entityName: 'Aria',
      sheetKind: 'character', key: 'rival', value: 'Ember Order', statement: 'Aria rivals the order',
      claimKind: 'relationship', confidence: 1, fromSheetId: 'aria', toSheetId: 'order',
      source: { chapterId: 'ch-1', start: 0, end: 0, text: '' },
    }],
    rejectedFingerprints: [], marks: [], researchNotes: [], lab: { boards: [{ id: 'lab-board-bench', title: 'Bench', cardIds: [] }], cards: [] },
  }
}

test('projects every sheet and accepted relationship fact only', () => {
  const input = fixture()
  const before = structuredClone(input)
  const graph = projectGraph(input)
  assert.deepEqual(graph.nodes.map((node) => node.id), ['aria', 'order', 'lore'])
  assert.equal(graph.nodes[0].portrait, '🔥')
  assert.deepEqual(graph.edges.map((edge) => edge.id), ['aria:rel-1'])
  assert.equal(graph.edges[0].from, 'aria')
  assert.equal(graph.edges[0].to, 'order')
  assert.deepEqual(input, before)
})

test('kind filtering keeps only edges whose endpoints remain visible', () => {
  const graph = projectGraph(fixture(), new Set(['character']))
  assert.deepEqual(graph.nodes.map((node) => node.id), ['aria'])
  assert.deepEqual(graph.edges, [])
})

test('dangling relationship facts produce diagnostics, not rendered edges', () => {
  const input = fixture()
  input.sheets[0].facts.push({
    id: 'dangling', key: 'rival', value: 'Missing', statement: 'Aria rivals Missing',
    claimKind: 'relationship', fromSheetId: 'aria', toSheetId: 'missing',
  })
  const graph = projectGraph(input)
  assert.equal(graph.edges.length, 1)
  assert.equal(graph.diagnostics[0].factId, 'dangling')
})

test('multiple relationship facts with the same key retain distinct identities', () => {
  let project = fixture()
  project = upsertFact(project, 'aria', {
    id: 'rel-2', key: 'member_of', value: 'The Ember', statement: 'Aria belongs to the Ember',
    claimKind: 'relationship', fromSheetId: 'aria', toSheetId: 'lore',
  })
  const aria = project.sheets.find((sheet) => sheet.id === 'aria')
  assert.equal(aria?.facts.filter((fact) => fact.claimKind === 'relationship').length, 2)
})
