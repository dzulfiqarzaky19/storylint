import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { SHEET_KINDS, type Project, type SheetKind } from '../../domain/types.ts'
import { layoutFamilyTree } from '../../graph/familyTree.ts'
import { projectGraph, type GraphEdge } from '../../graph/projectGraph.ts'
import { proposeGraphEdge } from '../project/api.ts'
import { SHEET_KIND_LABEL } from '../../components/shell/workspace.ts'
import { Button, EmptyState, Input } from '../../components/ui'
import './graph.css'

/** Dense network: hide non-active labels to stop collisions. */
const NETWORK_DENSE_NODE_THRESHOLD = 8
/** Always truncate network labels; full name stays on title/aria. */
const NETWORK_LABEL_MAX = 10
const NETWORK_EDGE_LABEL_MAX = 14

function readTokenPx(name: string, fallback: number): number {
  if (typeof document === 'undefined') return fallback
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  const value = Number.parseFloat(raw)
  return Number.isFinite(value) ? value : fallback
}

function graphGeometry(phone: boolean) {
  const width = readTokenPx('--size-graph-view-w', 800)
  const height = readTokenPx('--size-graph-view-h', 520)
  const networkNodeRadius = readTokenPx('--size-graph-network-node', 56) / 2
  const networkLabelY = networkNodeRadius + readTokenPx('--space-5', 20)
  const touch = readTokenPx('--size-touch-min', 44)
  const familyBase = readTokenPx('--size-graph-node', 76)
  // Phone family: larger cards, more vertical gap, labels sit below portrait.
  const familyNodeW = phone
    ? Math.max(touch * 2.5, familyBase + readTokenPx('--space-8', 32))
    : familyBase + readTokenPx('--space-8', 32)
  const familyNodeH = phone
    ? Math.max(touch * 2.25, familyBase + readTokenPx('--space-8', 32))
    : familyBase + readTokenPx('--space-3', 12)
  return {
    width,
    height,
    centerX: width / 2,
    centerY: height / 2,
    radius: readTokenPx('--size-graph-radius', 180),
    innerRadius: readTokenPx('--size-graph-radius-inner', 100),
    networkNodeRadius,
    networkLabelY,
    networkKindY: networkLabelY + readTokenPx('--space-4', 16),
    familyNodeW,
    familyNodeH,
    familyGapX: phone
      ? readTokenPx('--space-6', 24)
      : readTokenPx('--space-8', 32) + readTokenPx('--space-4', 16),
    familyGapY: phone
      ? readTokenPx('--space-12', 48) + readTokenPx('--space-6', 24)
      : readTokenPx('--space-12', 48) + readTokenPx('--space-8', 32),
    familyPad: phone
      ? readTokenPx('--space-6', 24)
      : readTokenPx('--space-8', 32) + readTokenPx('--space-4', 16),
    parallax: readTokenPx('--space-3', 12),
    radiusLg: readTokenPx('--radius-lg', 8),
    touch,
  }
}

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

function truncateLabel(label: string, max: number): string {
  const trimmed = label.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, Math.max(1, max - 1)).trimEnd()}…`
}

function pointsPath(points: Array<{ x: number; y: number }>): string {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`).join(' ')
}

export function RelationshipGraph({
  project,
  onProject,
  onOpenSheet,
  onNewSheet,
  projectGeneration,
  trackMutation,
  beginMutation,
}: {
  project: Project
  onProject: (project: Project, generation?: number) => void
  onOpenSheet: (sheetId: string) => void
  onNewSheet?: () => void
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
  const [phone, setPhone] = useState(false)
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null)
  // D4: Propose is a job tool at every width — collapsed by default so the map owns the fold.
  const [editorOpen, setEditorOpen] = useState(false)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const editorRef = useRef<HTMLDetailsElement | null>(null)
  const fromFieldRef = useRef<HTMLSelectElement | null>(null)
  const focusFromFieldRef = useRef(false)
  const geometry = useMemo(() => graphGeometry(phone), [phone])
  const graph = useMemo(() => projectGraph(project, kinds), [project, kinds])
  const family = useMemo(() => layoutFamilyTree(graph, {
    nodeWidth: geometry.familyNodeW,
    nodeHeight: geometry.familyNodeH,
    gapX: geometry.familyGapX,
    gapY: geometry.familyGapY,
    paddingX: geometry.familyPad,
    paddingY: geometry.familyPad,
  }), [geometry, graph])
  const networkPositions = useMemo(() => new Map(graph.nodes.map((node, index) => [
    node.id,
    networkPosition(index, graph.nodes.length, geometry),
  ])), [geometry, graph.nodes])
  const familyPositions = useMemo(
    () => new Map(family.positions.map((position) => [position.id, position])),
    [family.positions],
  )
  const denseNetwork = graph.nodes.length >= NETWORK_DENSE_NODE_THRESHOLD

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const reset = () => setParallax({ x: 0, y: 0 })
    const onChange = () => { if (media.matches) reset() }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    // bp.sm — phone / narrow. Tokens doc: 640.
    const media = window.matchMedia('(max-width: 640px)')
    const sync = () => setPhone(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    // Edge edit opens the disclosure; move focus to the first field so the edit is findable.
    if (!editorOpen || !focusFromFieldRef.current) return
    focusFromFieldRef.current = false
    fromFieldRef.current?.focus()
  }, [editorOpen])

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
    focusFromFieldRef.current = true
    openEditor()
  }

  /**
   * Open the disclosure through the DOM, not through state alone.
   * `toggle` fires asynchronously, so a collapse still in flight can land after this call and
   * clobber the state update, leaving the fields filled inside a form that reads as closed.
   * Setting `open` directly keeps element and state in agreement within the same task.
   */
  function openEditor() {
    if (editorRef.current) editorRef.current.open = true
    setEditorOpen(true)
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
      setNotice('Relationship proposal is pending in the Companion Inbox. Accept is required for Canon.')
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
  /**
   * A Canon with no sheets at all is a true-empty world, not a filtered view.
   * It gets the map's own explanation and one way forward; hiding kinds gets a different hint,
   * because telling an author to "create a sheet" when their sheets are merely filtered out
   * would imply their work vanished.
   */
  const noSheets = project.sheets.length === 0
  /**
   * Edge propose needs two endpoints. On true-empty / single-sheet Canon the job cannot
   * succeed — omit the solid Send (ox empty-canon-send-proposal-weight). Keep the
   * disclosure (D4); never leave a disabled primary as costume on empty selects.
   */
  const canProposeEdge = project.sheets.length >= 2
  const editorTitle = targetFactId ? 'Propose edge edit' : 'Propose new edge'

  const editorFields = (
    <>
      <label><span>From</span><select ref={fromFieldRef} value={from} onChange={(event) => setFrom(event.target.value)}>{project.sheets.map((sheet) => <option key={sheet.id} value={sheet.id}>{sheet.name}</option>)}</select></label>
      <label><span>To</span><select value={to} onChange={(event) => setTo(event.target.value)}>{project.sheets.map((sheet) => <option key={sheet.id} value={sheet.id}>{sheet.name}</option>)}</select></label>
      <label><span>Relationship</span><Input value={key} onChange={(event) => setKey(event.target.value)} placeholder="father_of, member_of, rival…" /></label>
      <label><span>Statement</span><Input value={statement} onChange={(event) => setStatement(event.target.value)} placeholder="Aria is a member of the Ember Order" /></label>
      {canProposeEdge ? (
        <Button variant="primary" disabled={busy || from === to || !statement.trim()} onClick={() => void propose()}>{busy ? 'Proposing…' : 'Send proposal'}</Button>
      ) : (
        <p className="graph__editor-hint" role="status">Add at least two sheets before proposing a link.</p>
      )}
      {notice ? <p role="status">{notice}</p> : null}
    </>
  )

  return (
    <main
      id="workspace"
      className="graph"
      data-graph-view={view}
      data-graph-dense={denseNetwork ? 'true' : 'false'}
      data-graph-phone={phone ? 'true' : 'false'}
      data-canon-empty={noSheets ? 'true' : 'false'}
      aria-label="Relationship graph"
      tabIndex={-1}
    >
      <header className="graph__header">
        <div>
          <h2>Relationships</h2>
          <p className="graph__lede" title="Accepted Canon facts only. Pending proposals never render as edges.">Accepted links only</p>
        </div>
        <div className="graph__toolbar">
          <div className="graph__view" role="group" aria-label="Graph view">
            <Button aria-pressed={view === 'network'} onClick={() => setView('network')}>Network</Button>
            <Button aria-pressed={view === 'family'} onClick={() => setView('family')}>Family</Button>
          </div>
          <div className="graph__filters" role="group" aria-label="Filter by sheet kind">
            {SHEET_KINDS.map((kind) => (
              <Button key={kind} aria-pressed={kinds.has(kind)} onClick={() => toggleKind(kind)}>{SHEET_KIND_LABEL[kind]}</Button>
            ))}
          </div>
        </div>
      </header>

      {empty ? (
        <div className="graph__empty" data-graph-empty={noSheets ? 'canon' : 'filtered'}>
          <EmptyState
            title={noSheets
              ? 'Your settled world lives here'
              : view === 'family' ? 'No family tree yet' : 'No sheets match these filters'}
            hint={noSheets
              ? 'Canon holds what is true: the characters, places, and groups your story treats as settled. Start with one sheet.'
              : view === 'family'
                ? 'Add character sheets and accepted kinship facts such as parent_of, spouse_of, or sibling_of.'
                : 'Turn a sheet kind back on to see it.'}
            action={noSheets && onNewSheet ? (
              <Button variant="primary" className="graph__empty-cta" onClick={onNewSheet}>New sheet</Button>
            ) : undefined}
          />
        </div>
      ) : view === 'network' ? (
        <svg
          className="graph__canvas"
          data-dense={denseNetwork ? 'true' : 'false'}
          viewBox={`0 0 ${geometry.width} ${geometry.height}`}
          role="img"
          aria-label="Canon relationship network"
        >
          <defs><marker id="graph-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" /></marker></defs>
          {graph.edges.map((edge) => {
            const start = networkPositions.get(edge.from)
            const end = networkPositions.get(edge.to)
            if (!start || !end) return null
            const fromLabel = graph.nodes.find((node) => node.id === edge.from)?.label ?? edge.from
            const toLabel = graph.nodes.find((node) => node.id === edge.to)?.label ?? edge.to
            return (
              <g key={edge.id} className="graph__edge" role="button" tabIndex={0}
                aria-label={`${edge.label}: ${fromLabel} to ${toLabel}`}
                onClick={() => editEdge(edge)} onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); editEdge(edge) }
                }}>
                <title>{edge.label}: {fromLabel} → {toLabel}</title>
                <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} markerEnd="url(#graph-arrow)" />
                {/* Dense: edge labels collide; keep full label on title/aria only. */}
                {!denseNetwork ? (
                  <text x={(start.x + end.x) / 2} y={(start.y + end.y) / 2}>
                    {truncateLabel(edge.label, NETWORK_EDGE_LABEL_MAX)}
                  </text>
                ) : null}
              </g>
            )
          })}
          {graph.nodes.map((node) => {
            const position = networkPositions.get(node.id)
            if (!position) return null
            const active = activeNodeId === node.id
            const showText = !denseNetwork || active
            return (
              <g
                key={node.id}
                className="graph__node"
                data-active={active ? 'true' : 'false'}
                role="button"
                tabIndex={0}
                aria-label={`Open ${node.label} ${SHEET_KIND_LABEL[node.kind]} sheet`}
                transform={`translate(${position.x} ${position.y})`}
                onPointerEnter={() => setActiveNodeId(node.id)}
                onPointerLeave={() => setActiveNodeId((current) => current === node.id ? null : current)}
                onFocus={() => setActiveNodeId(node.id)}
                onBlur={() => setActiveNodeId((current) => current === node.id ? null : current)}
                onClick={() => onOpenSheet(node.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpenSheet(node.id) }
                }}
              >
                <title>{node.label} · {SHEET_KIND_LABEL[node.kind]}</title>
                <circle r={geometry.networkNodeRadius} />
                <text className="graph__portrait" textAnchor="middle" y="-4">{node.portrait || node.label.slice(0, 2).toUpperCase()}</text>
                {showText ? (
                  <>
                    <text className="graph__label" textAnchor="middle" y={geometry.networkLabelY}>
                      {truncateLabel(node.label, NETWORK_LABEL_MAX)}
                    </text>
                    <text className="graph__kind" textAnchor="middle" y={geometry.networkKindY}>{SHEET_KIND_LABEL[node.kind]}</text>
                  </>
                ) : null}
              </g>
            )
          })}
        </svg>
      ) : (
        <>
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
                width={family.width}
                height={family.height}
                role="img"
                aria-label="Canon family tree"
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
                  const portraitY = phone ? geometry.familyNodeH * 0.36 : geometry.familyNodeH * 0.42
                  const labelY = phone ? geometry.familyNodeH * 0.78 : geometry.familyNodeH * 0.72
                  return (
                    <g key={node.id} className="graph__node graph__node--family" role="button" tabIndex={0}
                      aria-label={`Open ${node.label} ${SHEET_KIND_LABEL[node.kind]} sheet`}
                      transform={`translate(${x} ${y})`}
                      onClick={() => onOpenSheet(node.id)} onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpenSheet(node.id) }
                      }}>
                      <title>{node.label}</title>
                      <rect width={geometry.familyNodeW} height={geometry.familyNodeH} rx={geometry.radiusLg} ry={geometry.radiusLg} />
                      <text className="graph__portrait" textAnchor="middle" x={geometry.familyNodeW / 2} y={portraitY}>
                        {node.portrait || node.label.slice(0, 2).toUpperCase()}
                      </text>
                      <text className="graph__label" textAnchor="middle" x={geometry.familyNodeW / 2} y={labelY}>
                        {truncateLabel(node.label, phone ? 14 : 18)}
                      </text>
                    </g>
                  )
                })}
              </svg>
            </div>
          </div>
          {/* Phone a11y / legibility fallback: binder-style list of family members. */}
          {phone && family.nodes.length > 0 ? (
            <nav className="graph__family-list" aria-label="Family members">
              <h3 className="graph__family-list-title">Family members</h3>
              <ul>
                {family.nodes.map((node) => (
                  <li key={node.id}>
                    <button type="button" className="graph__family-list-item" onClick={() => onOpenSheet(node.id)}>
                      <span className="graph__family-list-portrait" aria-hidden="true">
                        {node.portrait || node.label.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="graph__family-list-label">{node.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
        </>
      )}

      {/* D4: one collapsed summary row at every width; map keeps the fold until summoned. */}
      <details
        ref={editorRef}
        className="graph__editor graph__editor--disclosure"
        open={editorOpen}
        onToggle={(event) => setEditorOpen((event.currentTarget as HTMLDetailsElement).open)}
      >
        <summary className="graph__editor-summary">{editorTitle}</summary>
        <div className="graph__editor-body">{editorFields}</div>
      </details>
    </main>
  )
}
