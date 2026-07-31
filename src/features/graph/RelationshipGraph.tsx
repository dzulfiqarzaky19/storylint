import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { SHEET_KINDS, type Project, type SheetKind } from '../../domain/types.ts'
import { layoutFamilyTree } from '../../graph/familyTree.ts'
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
<<<<<<< HEAD
=======
  const networkNodeRadius = readTokenPx('--size-graph-network-node', 56) / 2
  const networkLabelY = networkNodeRadius + readTokenPx('--space-5', 20)
>>>>>>> storylint/lab-slice
  return {
    width,
    height,
    centerX: width / 2,
    centerY: height / 2,
<<<<<<< HEAD
    radius: readTokenPx('--size-graph-radius', 185),
    nodeRadius: readTokenPx('--size-graph-node', 76) / 2,
=======
    radius: readTokenPx('--size-graph-radius', 180),
    innerRadius: readTokenPx('--size-graph-radius-inner', 100),
    networkNodeRadius,
    networkLabelY,
    networkKindY: networkLabelY + readTokenPx('--space-4', 16),
>>>>>>> storylint/lab-slice
    familyNodeW: readTokenPx('--size-graph-node', 76) + readTokenPx('--space-8', 32),
    familyNodeH: readTokenPx('--size-graph-node', 76) + readTokenPx('--space-3', 12),
    familyGapX: readTokenPx('--space-8', 32) + readTokenPx('--space-4', 16),
    familyGapY: readTokenPx('--space-12', 48) + readTokenPx('--space-8', 32),
    familyPad: readTokenPx('--space-8', 32) + readTokenPx('--space-4', 16),
    parallax: readTokenPx('--space-3', 12),
    radiusLg: readTokenPx('--radius-lg', 8),
  }
}

<<<<<<< HEAD
=======
function networkPosition(index: number, count: number, geometry: ReturnType<typeof graphGeometry>) {
  if (count === 1) return { x: geometry.centerX, y: geometry.centerY }
  if (count <= 12) {
    const angle = (Math.PI * 2 * index) / count - Math.PI / 2
    return {
      x: geometry.centerX + Math.cos(angle) * geometry.radius,
      y: geometry.centerY + Math.sin(angle) * geometry.radius,
    }
  }

  const innerCount = Math.max(4, Math.round(count / 3))
  const inner = index < innerCount
  const ringIndex = inner ? index : index - innerCount
  const ringCount = inner ? innerCount : count - innerCount
  const angleOffset = inner ? Math.PI / ringCount : 0
  const angle = (Math.PI * 2 * ringIndex) / ringCount - Math.PI / 2 + angleOffset
  const radius = inner ? geometry.innerRadius : geometry.radius
  return {
    x: geometry.centerX + Math.cos(angle) * radius,
    y: geometry.centerY + Math.sin(angle) * radius,
  }
}

function networkLabel(label: string, dense: boolean): string {
  return dense && label.length > 12 ? `${label.slice(0, 11).trimEnd()}…` : label
}

>>>>>>> storylint/lab-slice
function pointsPath(points: Array<{ x: number; y: number }>): string {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`).join(' ')
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
  const [view, setView] = useState<'network' | 'family'>('network')
  const [from, setFrom] = useState(project.sheets[0]?.id ?? '')
  const [to, setTo] = useState(project.sheets[1]?.id ?? '')
  const [key, setKey] = useState('relationship')
  const [statement, setStatement] = useState('')
  const [targetFactId, setTargetFactId] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [parallax, setParallax] = useState({ x: 0, y: 0 })
  const stageRef = useRef<HTMLDivElement | null>(null)
  const geometry = useMemo(() => graphGeometry(), [])
  const graph = useMemo(() => projectGraph(project, kinds), [project, kinds])
  const family = useMemo(() => layoutFamilyTree(graph, {
    nodeWidth: geometry.familyNodeW,
    nodeHeight: geometry.familyNodeH,
    gapX: geometry.familyGapX,
    gapY: geometry.familyGapY,
    paddingX: geometry.familyPad,
    paddingY: geometry.familyPad,
  }), [geometry, graph])
<<<<<<< HEAD
  const networkPositions = useMemo(() => new Map(graph.nodes.map((node, index) => {
    const angle = graph.nodes.length <= 1 ? 0 : (Math.PI * 2 * index) / graph.nodes.length - Math.PI / 2
    return [node.id, {
      x: graph.nodes.length === 1 ? geometry.centerX : geometry.centerX + Math.cos(angle) * geometry.radius,
      y: graph.nodes.length === 1 ? geometry.centerY : geometry.centerY + Math.sin(angle) * geometry.radius,
    }]
  })), [geometry, graph.nodes])
=======
  const networkPositions = useMemo(() => new Map(graph.nodes.map((node, index) => [
    node.id,
    networkPosition(index, graph.nodes.length, geometry),
  ])), [geometry, graph.nodes])
>>>>>>> storylint/lab-slice
  const familyPositions = useMemo(
    () => new Map(family.positions.map((position) => [position.id, position])),
    [family.positions],
  )

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const reset = () => setParallax({ x: 0, y: 0 })
    const onChange = () => { if (media.matches) reset() }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

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

  function editFamilyLink(edgeId: string) {
    const edge = graph.edges.find((candidate) => candidate.id === edgeId)
    if (edge) editEdge(edge)
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

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (view !== 'family') return
    if (event.pointerType !== 'mouse') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const bounds = stageRef.current?.getBoundingClientRect()
    if (!bounds) return
    const nx = ((event.clientX - bounds.left) / bounds.width) * 2 - 1
    const ny = ((event.clientY - bounds.top) / bounds.height) * 2 - 1
    setParallax({
      x: Math.max(-1, Math.min(1, nx)) * geometry.parallax,
      y: Math.max(-1, Math.min(1, ny)) * geometry.parallax,
    })
  }

  function onPointerLeave() {
    setParallax({ x: 0, y: 0 })
  }

  const empty = view === 'family' ? family.nodes.length === 0 : graph.nodes.length === 0

  return (
<<<<<<< HEAD
    <main className="graph" aria-label="Relationship graph">
=======
    <main id="workspace" className="graph" aria-label="Relationship graph" tabIndex={-1}>
>>>>>>> storylint/lab-slice
      <header className="graph__header">
        <div>
          <h2>Relationships</h2>
          <p>Accepted bible facts only. Pending proposals never render as edges.</p>
        </div>
        <div className="graph__toolbar">
<<<<<<< HEAD
          <div className="graph__view" aria-label="Graph view">
            <Button aria-pressed={view === 'network'} onClick={() => setView('network')}>Network</Button>
            <Button aria-pressed={view === 'family'} onClick={() => setView('family')}>Family</Button>
          </div>
          <div className="graph__filters" aria-label="Filter by sheet kind">
=======
          <div className="graph__view" role="group" aria-label="Graph view">
            <Button aria-pressed={view === 'network'} onClick={() => setView('network')}>Network</Button>
            <Button aria-pressed={view === 'family'} onClick={() => setView('family')}>Family</Button>
          </div>
          <div className="graph__filters" role="group" aria-label="Filter by sheet kind">
>>>>>>> storylint/lab-slice
            {SHEET_KINDS.map((kind) => (
              <Button key={kind} aria-pressed={kinds.has(kind)} onClick={() => toggleKind(kind)}>{kind}</Button>
            ))}
          </div>
        </div>
      </header>

      {empty ? (
<<<<<<< HEAD
        <EmptyState
          title={view === 'family' ? 'No family tree yet' : 'No visible sheets'}
          hint={view === 'family'
            ? 'Add character sheets and accepted kinship facts such as parent_of, spouse_of, or sibling_of.'
            : 'Enable a sheet kind or create a bible sheet.'}
        />
=======
        <div className="graph__empty">
          <EmptyState
            title={view === 'family' ? 'No family tree yet' : 'No visible sheets'}
            hint={view === 'family'
              ? 'Add character sheets and accepted kinship facts such as parent_of, spouse_of, or sibling_of.'
              : 'Enable a sheet kind or create a bible sheet.'}
          />
        </div>
>>>>>>> storylint/lab-slice
      ) : view === 'network' ? (
        <svg className="graph__canvas" viewBox={`0 0 ${geometry.width} ${geometry.height}`} role="img" aria-label="Bible relationship network">
          <defs><marker id="graph-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" /></marker></defs>
          {graph.edges.map((edge) => {
            const start = networkPositions.get(edge.from)
            const end = networkPositions.get(edge.to)
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
            const position = networkPositions.get(node.id)
            if (!position) return null
            return (
              <g key={node.id} className="graph__node" role="button" tabIndex={0}
                aria-label={`Open ${node.label} ${node.kind} sheet`}
                transform={`translate(${position.x} ${position.y})`}
                onClick={() => onOpenSheet(node.id)} onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpenSheet(node.id) }
                }}>
<<<<<<< HEAD
                <circle r={geometry.nodeRadius} />
                <text className="graph__portrait" textAnchor="middle" y="-4">{node.portrait || node.label.slice(0, 2).toUpperCase()}</text>
                <text className="graph__label" textAnchor="middle" y={geometry.nodeRadius + 20}>{node.label}</text>
                <text className="graph__kind" textAnchor="middle" y={geometry.nodeRadius + 35}>{node.kind}</text>
=======
                <title>{node.label} · {node.kind}</title>
                <circle r={geometry.networkNodeRadius} />
                <text className="graph__portrait" textAnchor="middle" y="-4">{node.portrait || node.label.slice(0, 2).toUpperCase()}</text>
                <text className="graph__label" textAnchor="middle" y={geometry.networkLabelY}>{networkLabel(node.label, graph.nodes.length > 12)}</text>
                <text className="graph__kind" textAnchor="middle" y={geometry.networkKindY}>{node.kind}</text>
>>>>>>> storylint/lab-slice
              </g>
            )
          })}
        </svg>
      ) : (
        <div
          ref={stageRef}
          className="graph__family-stage"
          onPointerMove={onPointerMove}
          onPointerLeave={onPointerLeave}
        >
          <div
            className="graph__family-plane"
            style={{ transform: `translate3d(${parallax.x}px, ${parallax.y}px, 0)` }}
          >
            <svg
              className="graph__canvas graph__canvas--family"
              viewBox={`0 0 ${family.width} ${family.height}`}
              role="img"
              aria-label="Bible family tree"
            >
              {family.connectors.map((connector) => {
                const link = family.links.find((candidate) => candidate.id === connector.id)
                return (
                  <g key={connector.id} className={`graph__edge graph__edge--${link?.kind ?? 'parent'}`} role="button" tabIndex={0}
                    aria-label={link ? `${link.label}: ${link.from} to ${link.to}` : 'Family link'}
                    onClick={() => link && editFamilyLink(link.edgeId)}
                    onKeyDown={(event) => {
                      if (!link) return
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        editFamilyLink(link.edgeId)
                      }
                    }}
                  >
                    <path d={pointsPath(connector.points)} />
                  </g>
                )
              })}
              {family.nodes.map((node) => {
                const position = familyPositions.get(node.id)
                if (!position) return null
                const x = position.x - geometry.familyNodeW / 2
                const y = position.y - geometry.familyNodeH / 2
                return (
                  <g key={node.id} className="graph__node graph__node--family" role="button" tabIndex={0}
                    aria-label={`Open ${node.label} ${node.kind} sheet`}
                    transform={`translate(${x} ${y})`}
                    onClick={() => onOpenSheet(node.id)} onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpenSheet(node.id) }
                    }}>
                    <rect width={geometry.familyNodeW} height={geometry.familyNodeH} rx={geometry.radiusLg} ry={geometry.radiusLg} />
                    <text className="graph__portrait" textAnchor="middle" x={geometry.familyNodeW / 2} y={geometry.familyNodeH * 0.42}>
                      {node.portrait || node.label.slice(0, 2).toUpperCase()}
                    </text>
                    <text className="graph__label" textAnchor="middle" x={geometry.familyNodeW / 2} y={geometry.familyNodeH * 0.72}>
                      {node.label}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>
        </div>
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
