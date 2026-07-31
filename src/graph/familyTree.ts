import type { GraphEdge, GraphNode, ProjectGraph } from './projectGraph.ts'

export type FamilyLinkKind = 'parent' | 'partner' | 'sibling'

export type FamilyLink = {
  id: string
  edgeId: string
  kind: FamilyLinkKind
  from: string
  to: string
  label: string
}

export type FamilyPosition = {
  id: string
  x: number
  y: number
  generation: number
}

export type FamilyTreeLayout = {
  nodes: GraphNode[]
  positions: FamilyPosition[]
  links: FamilyLink[]
  connectors: Array<{ id: string; points: Array<{ x: number; y: number }> }>
  width: number
  height: number
  diagnostics: string[]
}

export type FamilyTreeMetrics = {
  nodeWidth: number
  nodeHeight: number
  gapX: number
  gapY: number
  paddingX: number
  paddingY: number
}

const DEFAULT_METRICS: FamilyTreeMetrics = {
  nodeWidth: 120,
  nodeHeight: 88,
  gapX: 48,
  gapY: 96,
  paddingX: 48,
  paddingY: 48,
}

type KinshipClass =
  | { kind: 'parent'; reverse: false }
  | { kind: 'parent'; reverse: true }
  | { kind: 'partner' }
  | { kind: 'sibling' }

const KINSHIP: Record<string, KinshipClass> = {
  parent_of: { kind: 'parent', reverse: false },
  father_of: { kind: 'parent', reverse: false },
  mother_of: { kind: 'parent', reverse: false },
  child_of: { kind: 'parent', reverse: true },
  son_of: { kind: 'parent', reverse: true },
  daughter_of: { kind: 'parent', reverse: true },
  spouse_of: { kind: 'partner' },
  married_to: { kind: 'partner' },
  partner_of: { kind: 'partner' },
  sibling_of: { kind: 'sibling' },
  brother_of: { kind: 'sibling' },
  sister_of: { kind: 'sibling' },
}

export function classifyKinship(key: string): KinshipClass | null {
  return KINSHIP[key.trim().toLocaleLowerCase('en-US')] ?? null
}

export function isKinshipKey(key: string): boolean {
  return classifyKinship(key) !== null
}

function undirectedKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

function normalizeLinks(edges: GraphEdge[]): { links: FamilyLink[]; diagnostics: string[] } {
  const links: FamilyLink[] = []
  const diagnostics: string[] = []
  const seenPartner = new Set<string>()
  const seenSibling = new Set<string>()
  const seenParent = new Set<string>()

  for (const edge of edges) {
    const kinship = classifyKinship(edge.label)
    if (!kinship) continue
    if (edge.from === edge.to) {
      diagnostics.push(`Self kinship ignored: ${edge.id}`)
      continue
    }

    if (kinship.kind === 'parent') {
      const from = kinship.reverse ? edge.to : edge.from
      const to = kinship.reverse ? edge.from : edge.to
      const key = `${from}->${to}`
      if (seenParent.has(key)) continue
      seenParent.add(key)
      links.push({ id: `parent:${edge.id}`, edgeId: edge.id, kind: 'parent', from, to, label: edge.label })
      continue
    }

    if (kinship.kind === 'partner') {
      const key = undirectedKey(edge.from, edge.to)
      if (seenPartner.has(key)) continue
      seenPartner.add(key)
      links.push({ id: `partner:${edge.id}`, edgeId: edge.id, kind: 'partner', from: edge.from, to: edge.to, label: edge.label })
      continue
    }

    const key = undirectedKey(edge.from, edge.to)
    if (seenSibling.has(key)) continue
    seenSibling.add(key)
    links.push({ id: `sibling:${edge.id}`, edgeId: edge.id, kind: 'sibling', from: edge.from, to: edge.to, label: edge.label })
  }

  return { links, diagnostics }
}

function connectedComponents(nodeIds: string[], links: FamilyLink[]): string[][] {
  const adjacency = new Map(nodeIds.map((id) => [id, new Set<string>()]))
  for (const link of links) {
    adjacency.get(link.from)?.add(link.to)
    adjacency.get(link.to)?.add(link.from)
  }
  const seen = new Set<string>()
  const groups: string[][] = []
  for (const id of nodeIds) {
    if (seen.has(id)) continue
    const queue = [id]
    const group: string[] = []
    seen.add(id)
    while (queue.length > 0) {
      const current = queue.shift()
      if (!current) break
      group.push(current)
      for (const next of adjacency.get(current) ?? []) {
        if (seen.has(next)) continue
        seen.add(next)
        queue.push(next)
      }
    }
    groups.push(group.sort((a, b) => a.localeCompare(b)))
  }
  return groups
}

function assignGenerations(nodeIds: string[], links: FamilyLink[]): Map<string, number> {
  const parents = new Map(nodeIds.map((id) => [id, new Set<string>()]))
  const children = new Map(nodeIds.map((id) => [id, new Set<string>()]))
  for (const link of links) {
    if (link.kind !== 'parent') continue
    parents.get(link.to)?.add(link.from)
    children.get(link.from)?.add(link.to)
  }

  const generation = new Map<string, number>()
  const visiting = new Set<string>()
  const diagnosticsCycle = new Set<string>()

  function visit(id: string): number {
    const cached = generation.get(id)
    if (cached !== undefined) return cached
    if (visiting.has(id)) {
      diagnosticsCycle.add(id)
      generation.set(id, 0)
      return 0
    }
    visiting.add(id)
    let value = 0
    for (const parent of parents.get(id) ?? []) value = Math.max(value, visit(parent) + 1)
    visiting.delete(id)
    generation.set(id, value)
    return value
  }

  for (const id of nodeIds) visit(id)

  // Partners share a generation when one side is known.
  let changed = true
  while (changed) {
    changed = false
    for (const link of links) {
      if (link.kind !== 'partner') continue
      const a = generation.get(link.from) ?? 0
      const b = generation.get(link.to) ?? 0
      if (a === b) continue
      const next = Math.max(a, b)
      if (a !== next) {
        generation.set(link.from, next)
        changed = true
      }
      if (b !== next) {
        generation.set(link.to, next)
        changed = true
      }
    }
  }

  if (diagnosticsCycle.size > 0) {
    // Cycles collapse to the computed values already stored; callers collect diagnostics separately.
  }
  return generation
}

function partnerClusters(ids: string[], links: FamilyLink[]): string[][] {
  const parent = new Map(ids.map((id) => [id, id]))
  function find(id: string): string {
    const current = parent.get(id) ?? id
    if (current === id) return id
    const root = find(current)
    parent.set(id, root)
    return root
  }
  function union(a: string, b: string): void {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent.set(ra, rb)
  }
  for (const link of links) {
    if (link.kind !== 'partner') continue
    if (!parent.has(link.from) || !parent.has(link.to)) continue
    union(link.from, link.to)
  }
  const groups = new Map<string, string[]>()
  for (const id of ids) {
    const root = find(id)
    const list = groups.get(root) ?? []
    list.push(id)
    groups.set(root, list)
  }
  return [...groups.values()].map((group) => group.sort((a, b) => a.localeCompare(b)))
}

export function layoutFamilyTree(
  graph: ProjectGraph,
  metrics: Partial<FamilyTreeMetrics> = {},
): FamilyTreeLayout {
  const size = { ...DEFAULT_METRICS, ...metrics }
  const familyNodes = graph.nodes.filter((node) => node.kind === 'character')
  const familyIds = new Set(familyNodes.map((node) => node.id))
  const familyEdges = graph.edges.filter((edge) =>
    familyIds.has(edge.from) && familyIds.has(edge.to) && isKinshipKey(edge.label),
  )
  const { links, diagnostics } = normalizeLinks(familyEdges)
  if (familyNodes.length === 0) {
    return { nodes: [], positions: [], links: [], connectors: [], width: size.paddingX * 2, height: size.paddingY * 2, diagnostics }
  }

  // Detect parent cycles for diagnostics.
  const parentAdj = new Map(familyNodes.map((node) => [node.id, [] as string[]]))
  for (const link of links) {
    if (link.kind === 'parent') parentAdj.get(link.from)?.push(link.to)
  }
  const cycleSeen = new Set<string>()
  const stack = new Set<string>()
  function detect(id: string): void {
    if (stack.has(id)) {
      diagnostics.push(`Parent cycle involving ${id}`)
      return
    }
    if (cycleSeen.has(id)) return
    cycleSeen.add(id)
    stack.add(id)
    for (const child of parentAdj.get(id) ?? []) detect(child)
    stack.delete(id)
  }
  for (const node of familyNodes) detect(node.id)

  const components = connectedComponents(familyNodes.map((node) => node.id), links)
  const positions = new Map<string, FamilyPosition>()
  let cursorX = size.paddingX
  let maxBottom = size.paddingY

  for (const component of components) {
    const generation = assignGenerations(component, links)
    const byGeneration = new Map<number, string[]>()
    for (const id of component) {
      const gen = generation.get(id) ?? 0
      const list = byGeneration.get(gen) ?? []
      list.push(id)
      byGeneration.set(gen, list)
    }
    const generations = [...byGeneration.keys()].sort((a, b) => a - b)
    let componentWidth = 0
    const localX = new Map<string, number>()

    for (const gen of generations) {
      const members = byGeneration.get(gen) ?? []
      const clusters = partnerClusters(members, links)
      let x = 0
      for (const cluster of clusters) {
        for (const [index, id] of cluster.entries()) {
          localX.set(id, x + index * (size.nodeWidth * 0.75))
        }
        x += cluster.length * (size.nodeWidth * 0.75) + size.gapX
      }
      componentWidth = Math.max(componentWidth, x - size.gapX + size.nodeWidth)
    }

    for (const gen of generations) {
      for (const id of byGeneration.get(gen) ?? []) {
        const x = cursorX + (localX.get(id) ?? 0) + size.nodeWidth / 2
        const y = size.paddingY + gen * (size.nodeHeight + size.gapY) + size.nodeHeight / 2
        positions.set(id, { id, x, y, generation: gen })
        maxBottom = Math.max(maxBottom, y + size.nodeHeight / 2)
      }
    }
    cursorX += componentWidth + size.gapX * 2
  }

  const connectors: FamilyTreeLayout['connectors'] = []
  for (const link of links) {
    const start = positions.get(link.from)
    const end = positions.get(link.to)
    if (!start || !end) continue
    if (link.kind === 'partner' || link.kind === 'sibling') {
      const midY = (start.y + end.y) / 2
      connectors.push({
        id: link.id,
        points: [
          { x: start.x, y: start.y },
          { x: start.x, y: midY },
          { x: end.x, y: midY },
          { x: end.x, y: end.y },
        ],
      })
      continue
    }
    const midY = (start.y + end.y) / 2
    connectors.push({
      id: link.id,
      points: [
        { x: start.x, y: start.y + size.nodeHeight / 2 },
        { x: start.x, y: midY },
        { x: end.x, y: midY },
        { x: end.x, y: end.y - size.nodeHeight / 2 },
      ],
    })
  }

  return {
    nodes: familyNodes,
    positions: [...positions.values()],
    links,
    connectors,
    width: Math.max(cursorX, size.paddingX * 2 + size.nodeWidth),
    height: Math.max(maxBottom + size.paddingY, size.paddingY * 2 + size.nodeHeight),
    diagnostics,
  }
}
