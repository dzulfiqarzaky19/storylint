import assert from 'node:assert/strict'
import { test } from 'node:test'
import { classifyKinship, isKinshipKey, layoutFamilyTree } from './familyTree.ts'
import type { ProjectGraph } from './projectGraph.ts'

function graph(nodes: string[], edges: Array<[string, string, string, string]>): ProjectGraph {
  return {
    nodes: nodes.map((id) => ({ id, label: id, kind: 'character' as const })),
    edges: edges.map(([id, from, to, label]) => ({
      id, factId: id, ownerSheetId: from, from, to, label,
    })),
    diagnostics: [],
  }
}

test('classifies parent/partner/sibling keys and ignores non-kinship', () => {
  assert.deepEqual(classifyKinship('father_of'), { kind: 'parent', reverse: false })
  assert.deepEqual(classifyKinship('child_of'), { kind: 'parent', reverse: true })
  assert.deepEqual(classifyKinship('spouse_of'), { kind: 'partner' })
  assert.deepEqual(classifyKinship('sibling_of'), { kind: 'sibling' })
  assert.equal(classifyKinship('member_of'), null)
  assert.equal(isKinshipKey('rival'), false)
})

test('normalizes child_of into parent direction and layers generations', () => {
  const layout = layoutFamilyTree(graph(
    ['parent', 'child'],
    [['e1', 'child', 'parent', 'child_of']],
  ))
  const parent = layout.positions.find((node) => node.id === 'parent')
  const child = layout.positions.find((node) => node.id === 'child')
  assert.ok(parent && child)
  assert.equal(parent.generation, 0)
  assert.equal(child.generation, 1)
  assert.ok(child.y > parent.y)
  assert.equal(layout.links[0]?.kind, 'parent')
  assert.equal(layout.links[0]?.from, 'parent')
  assert.equal(layout.links[0]?.to, 'child')
})

test('partners share a generation and multiple parents are supported', () => {
  const layout = layoutFamilyTree(graph(
    ['mom', 'dad', 'kid'],
    [
      ['p1', 'mom', 'dad', 'spouse_of'],
      ['p2', 'mom', 'kid', 'parent_of'],
      ['p3', 'dad', 'kid', 'father_of'],
    ],
  ))
  const mom = layout.positions.find((node) => node.id === 'mom')
  const dad = layout.positions.find((node) => node.id === 'dad')
  const kid = layout.positions.find((node) => node.id === 'kid')
  assert.ok(mom && dad && kid)
  assert.equal(mom.generation, dad.generation)
  assert.equal(kid.generation, mom.generation + 1)
  assert.equal(layout.links.filter((link) => link.kind === 'parent').length, 2)
  assert.equal(layout.links.filter((link) => link.kind === 'partner').length, 1)
})

test('disconnected families layout side by side without missing nodes', () => {
  const layout = layoutFamilyTree(graph(
    ['a1', 'a2', 'b1', 'b2'],
    [
      ['e1', 'a1', 'a2', 'parent_of'],
      ['e2', 'b1', 'b2', 'parent_of'],
    ],
  ))
  assert.equal(layout.positions.length, 4)
  const a1 = layout.positions.find((node) => node.id === 'a1')
  const b1 = layout.positions.find((node) => node.id === 'b1')
  assert.ok(a1 && b1)
  assert.notEqual(a1.x, b1.x)
})

test('parent cycles produce diagnostics and still place nodes', () => {
  const layout = layoutFamilyTree(graph(
    ['a', 'b'],
    [
      ['e1', 'a', 'b', 'parent_of'],
      ['e2', 'b', 'a', 'parent_of'],
    ],
  ))
  assert.equal(layout.positions.length, 2)
  assert.ok(layout.diagnostics.some((item) => /cycle/i.test(item)))
})

test('non-character nodes and non-kinship edges are excluded', () => {
  const layout = layoutFamilyTree({
    nodes: [
      { id: 'aria', label: 'Aria', kind: 'character' },
      { id: 'order', label: 'Order', kind: 'organization' },
    ],
    edges: [
      { id: 'e1', factId: 'f1', ownerSheetId: 'aria', from: 'aria', to: 'order', label: 'member_of' },
    ],
    diagnostics: [],
  })
  assert.deepEqual(layout.nodes.map((node) => node.id), ['aria'])
  assert.equal(layout.links.length, 0)
})
