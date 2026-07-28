import { useMemo, useState } from 'react'
import { SHEET_KINDS, type Project, type SheetKind } from '../../domain/types.ts'
import { projectGraph, type GraphEdge } from '../../graph/projectGraph.ts'
import { proposeGraphEdge } from '../project/api.ts'
import { Button, EmptyState, Input } from '../../components/ui'
import './graph.css'

function readTokenPx(name: string, fallback: number): number {
  if (typeof document === 'undefined') return fallback
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  const value = Number.parseFloat(raw)
  return Number.isFinite(value) ? value : fallback
}

function graphGeometry() {
  const width = readTokenPx('--size-graph-view-w', 800)
  const height = readTokenPx('--size-graph-view-h', 520)
  return {
    width,
    height,
    centerX: width / 2,
    centerY: height / 2,
    radius: readTokenPx('--size-graph-radius', 185),
    nodeRadius: readTokenPx('--size-graph-node', 76) / 2,
  }
}

export function RelationshipGraph({
  project,
  onProject,
  onOpenSheet,
  projectGeneration,
  trackMutation,
  beginMutation,
}: {
  project: Project
  onProject: (project: Project, generation?: number) => void
  onOpenSheet: (sheetId: string) => void
  projectGeneration: () => number
  trackMutation: <T>(operation: Promise<T>) => Promise<T>
  beginMutation: () => number | null
}) {
  const [kinds, setKinds] = useState<Set<SheetKind>>(() => new Set(SHEET_KINDS))
  const [from, setFrom] = useState(project.sheets[0]?.id ?? '')
  const [to, setTo] = useState(project.sheets[1]?.id ?? '')
  const [key, setKey] = useState('relationship')
  const [statement, setStatement] = useState('')
  const [targetFactId, setTargetFactId] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const geometry = useMemo(() => graphGeometry(), [])
  const graph = useMemo(() => projectGraph(project, kinds), [project, kinds])
  const positions = useMemo(() => new Map(graph.nodes.map((node, index) => {
    const angle = graph.nodes.length <= 1 ? 0 : (Math.PI * 2 * index) / graph.nodes.length - Math.PI / 2
    return [node.id, {
      x: graph.nodes.length === 1 ? geometry.centerX : geometry.centerX + Math.cos(angle) * geometry.radius,
      y: graph.nodes.length === 1 ? geometry.centerY : geometry.centerY + Math.sin(angle) * geometry.radius,
    }]
  })), [geometry, graph.nodes])

  function toggleKind(kind: SheetKind) {
    setKinds((current) => {
      const next = new Set(current)
      if (next.has(kind)) next.delete(kind)
      else next.add(kind)
      return next
    })
  }

  function editEdge(edge: GraphEdge) {
    setFrom(edge.from)
    setTo(edge.to)
    setKey(edge.label)
    setStatement(project.sheets.find((sheet) => sheet.id === edge.ownerSheetId)?.facts
      .find((fact) => fact.id === edge.factId)?.statement ?? '')
    setTargetFactId(edge.factId)
    setNotice('Editing creates a pending replacement; canon remains unchanged until Accept.')
  }

  async function propose() {
    if (!from || !to || !key.trim() || !statement.trim() || busy) return
    const generation = beginMutation()
    if (generation === null) return
    setBusy(true)
    setNotice(null)
    try {
      const next = await trackMutation(proposeGraphEdge({
        fromSheetId: from,
        toSheetId: to,
        key: key.trim(),
        statement: statement.trim(),
        targetFactId,
      }))
      if (generation !== projectGeneration()) return
      onProject(next, generation)
      setTargetFactId(undefined)
      setNotice('Relationship proposal is pending in the agent panel. Accept is required for canon.')
    } catch (caught) {
      if (generation !== projectGeneration()) return
      setNotice(caught instanceof Error ? caught.message : 'Could not propose relationship')
    } finally {
      if (generation === projectGeneration()) setBusy(false)
    }
  }

  return (
    <main className="graph" aria-label="Relationship graph">
      <header className="graph__header">
        <div><h2>Relationships</h2><p>Accepted bible facts only. Pending proposals never render as edges.</p></div>
        <div className="graph__filters" aria-label="Filter by sheet kind">
          {SHEET_KINDS.map((kind) => (
            <Button key={kind} aria-pressed={kinds.has(kind)} onClick={() => toggleKind(kind)}>{kind}</Button>
          ))}
        </div>
      </header>

      {graph.nodes.length === 0 ? (
        <EmptyState title="No visible sheets" hint="Enable a sheet kind or create a bible sheet." />
      ) : (
        <svg className="graph__canvas" viewBox={`0 0 ${geometry.width} ${geometry.height}`} role="img" aria-label="Bible relationship network">
          <defs><marker id="graph-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" /></marker></defs>
          {graph.edges.map((edge) => {
            const start = positions.get(edge.from)
            const end = positions.get(edge.to)
            if (!start || !end) return null
            return (
              <g key={edge.id} className="graph__edge" role="button" tabIndex={0}
                aria-label={`${edge.label}: ${graph.nodes.find((node) => node.id === edge.from)?.label} to ${graph.nodes.find((node) => node.id === edge.to)?.label}`}
                onClick={() => editEdge(edge)} onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); editEdge(edge) }
                }}>
                <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} markerEnd="url(#graph-arrow)" />
                <text x={(start.x + end.x) / 2} y={(start.y + end.y) / 2}>{edge.label}</text>
              </g>
            )
          })}
          {graph.nodes.map((node) => {
            const position = positions.get(node.id)
            if (!position) return null
            return (
              <g key={node.id} className="graph__node" role="button" tabIndex={0}
                aria-label={`Open ${node.label} ${node.kind} sheet`}
                transform={`translate(${position.x} ${position.y})`}
                onClick={() => onOpenSheet(node.id)} onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpenSheet(node.id) }
                }}>
                <circle r={geometry.nodeRadius} />
                <text className="graph__portrait" textAnchor="middle" y="-4">{node.portrait || node.label.slice(0, 2).toUpperCase()}</text>
                <text className="graph__label" textAnchor="middle" y={geometry.nodeRadius + 20}>{node.label}</text>
                <text className="graph__kind" textAnchor="middle" y={geometry.nodeRadius + 35}>{node.kind}</text>
              </g>
            )
          })}
        </svg>
      )}

      <section className="graph__editor" aria-labelledby="relationship-editor">
        <h3 id="relationship-editor">{targetFactId ? 'Propose edge edit' : 'Propose new edge'}</h3>
        <label><span>From</span><select value={from} onChange={(event) => setFrom(event.target.value)}>{project.sheets.map((sheet) => <option key={sheet.id} value={sheet.id}>{sheet.name}</option>)}</select></label>
        <label><span>To</span><select value={to} onChange={(event) => setTo(event.target.value)}>{project.sheets.map((sheet) => <option key={sheet.id} value={sheet.id}>{sheet.name}</option>)}</select></label>
        <label><span>Relationship</span><Input value={key} onChange={(event) => setKey(event.target.value)} placeholder="father_of, member_of, rival…" /></label>
        <label><span>Statement</span><Input value={statement} onChange={(event) => setStatement(event.target.value)} placeholder="Aria is a member of the Ember Order" /></label>
        <Button variant="primary" disabled={busy || from === to || !statement.trim()} onClick={() => void propose()}>{busy ? 'Proposing…' : 'Send proposal'}</Button>
        {notice ? <p role="status">{notice}</p> : null}
      </section>
    </main>
  )
}
