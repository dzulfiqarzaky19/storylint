import type { Project, SheetKind } from '../domain/types.ts'

export type GraphNode = {
  id: string
  label: string
  kind: SheetKind
  portrait?: string
}

export type GraphEdge = {
  id: string
  factId: string
  ownerSheetId: string
  from: string
  to: string
  label: string
}

export type GraphDiagnostic = {
  ownerSheetId: string
  factId: string
  reason: string
}

export type ProjectGraph = {
  nodes: GraphNode[]
  edges: GraphEdge[]
  diagnostics: GraphDiagnostic[]
}

export function projectGraph(project: Project, kinds?: ReadonlySet<SheetKind>): ProjectGraph {
  const nodes = project.sheets
    .filter((sheet) => !kinds || kinds.has(sheet.kind))
    .map((sheet) => ({ id: sheet.id, label: sheet.name, kind: sheet.kind, portrait: sheet.portrait }))
  const visible = new Set(nodes.map((node) => node.id))
  const allSheets = new Set(project.sheets.map((sheet) => sheet.id))
  const edges: GraphEdge[] = []
  const diagnostics: GraphDiagnostic[] = []

  for (const sheet of project.sheets) {
    for (const fact of sheet.facts) {
      if (fact.claimKind !== 'relationship') continue
      if (!fact.fromSheetId || !fact.toSheetId ||
          !allSheets.has(fact.fromSheetId) || !allSheets.has(fact.toSheetId)) {
        diagnostics.push({
          ownerSheetId: sheet.id,
          factId: fact.id,
          reason: 'Relationship endpoint is missing',
        })
        continue
      }
      if (!visible.has(fact.fromSheetId) || !visible.has(fact.toSheetId)) continue
      edges.push({
        id: `${sheet.id}:${fact.id}`,
        factId: fact.id,
        ownerSheetId: sheet.id,
        from: fact.fromSheetId,
        to: fact.toSheetId,
        label: fact.key,
      })
    }
  }

  return { nodes, edges, diagnostics }
}
