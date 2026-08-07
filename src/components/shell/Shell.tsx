import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  applyReading,
  applyTheme,
  nextReading,
  type ReadingProfile,
  type Theme,
} from '../../design'
import { useProject } from '../../features/project/useProject.ts'
import { saveChipLabel } from '../../features/project/saveChipLabel.ts'
import { ProjectSwitcher } from '../../features/project/ProjectSwitcher.tsx'
import type { ProposalEdits } from '../../features/project/api.ts'
import { useAgent } from '../../features/agent/useAgent.ts'
import { LabBench } from '../../features/lab/LabBench.tsx'
import { BenchQuickAdd } from '../../features/lab/BenchQuickAdd.tsx'
import { Button, Drawer, EmptyState, IconButton } from '../ui'
import { AgentIcon, BinderIcon, FocusIcon, ThemeIcon } from './icons'
import { AgentPanel, type CompanionContext } from './AgentPanel'
import { Binder } from './Binder'
import { Manuscript, type EditorSelection } from './Manuscript'
import { RelationshipGraph } from '../../features/graph/RelationshipGraph.tsx'
import { useShellState } from './useShellState'
import './shell.css'

const EMPTY_CHAPTERS: never[] = []

export function Shell() {
  const shell = useShellState()
  const project = useProject()
  const agentState = useAgent(
    project.applyServerProject,
    project.applySuggestion,
    project.projectGeneration,
    project.trackMutation,
    project.beginMutation,
  )
  const [theme, setTheme] = useState<Theme>('dark')
  const [reading, setReading] = useState<ReadingProfile>('night')
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null)
  const [workspaceMode, setWorkspaceMode] = useState<'manuscript' | 'graph' | 'lab'>('manuscript')
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null)
  const [requestedSheetId, setRequestedSheetId] = useState<string | null>(null)
  const [activeCanonSheetId, setActiveCanonSheetId] = useState<string | null>(null)
  const [researchRunning, setResearchRunning] = useState(false)
  const [selection, setSelection] = useState<EditorSelection>({ start: 0, end: 0, text: '' })
  const [benchDrawerOpen, setBenchDrawerOpen] = useState(false)
  /** Transient Binder row highlight after Accept — the receipt for where the write landed. */
  const [recentAcceptSheetId, setRecentAcceptSheetId] = useState<string | null>(null)
  const recentAcceptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Active Canon sheet leave guard from Binder (dirty identity). */
  const requestSheetLeaveRef = useRef<((proceed: () => void) => void) | null>(null)
  const binderToggleRef = useRef<HTMLButtonElement | null>(null)
  const agentToggleRef = useRef<HTMLButtonElement | null>(null)
  const binderRailRef = useRef<HTMLElement | null>(null)
  const agentRailRef = useRef<HTMLElement | null>(null)
  const wasBinderRailRef = useRef(false)
  const wasAgentRailRef = useRef(false)
  const registerSheetLeaveGuard = useCallback(
    (requestLeave: ((proceed: () => void) => void) | null) => {
      requestSheetLeaveRef.current = requestLeave
    },
    [],
  )

  function withSheetLeaveGuard(proceed: () => void) {
    const guard = requestSheetLeaveRef.current
    if (guard) {
      guard(proceed)
      return
    }
    proceed()
  }

  const binderRailOpen = shell.railVisible('binder')
  const agentRailOpen = shell.railVisible('agent')

  function focusFirstIn(root: HTMLElement | null) {
    if (!root) return
    const el = root.querySelector<HTMLElement>(
      'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
    )
    el?.focus()
  }

  // Wide-layout rail open/close focus: enter first control, leave restore toggle.
  // Drawer path already owns its own trap + restore (Drawer.tsx).
  useLayoutEffect(() => {
    const was = wasBinderRailRef.current
    wasBinderRailRef.current = binderRailOpen
    if (!was && binderRailOpen) {
      queueMicrotask(() => focusFirstIn(binderRailRef.current))
      return
    }
    if (was && !binderRailOpen) binderToggleRef.current?.focus()
  }, [binderRailOpen])

  useLayoutEffect(() => {
    const was = wasAgentRailRef.current
    wasAgentRailRef.current = agentRailOpen
    if (!was && agentRailOpen) {
      queueMicrotask(() => focusFirstIn(agentRailRef.current))
      return
    }
    if (was && !agentRailOpen) agentToggleRef.current?.focus()
  }, [agentRailOpen])

  const chapters = project.project?.chapters ?? EMPTY_CHAPTERS
  const activeChapter =
    chapters.find((chapter) => chapter.id === activeChapterId) ?? chapters[0] ?? null
  const lab = project.project?.lab ?? null
  const activeCanonSheetName =
    activeCanonSheetId === 'new'
      ? 'New sheet'
      : activeCanonSheetId
        ? project.project?.sheets.find((sheet) => sheet.id === activeCanonSheetId)?.name ?? null
        : null

  const companionContext: CompanionContext =
    workspaceMode === 'lab'
      ? 'lab'
      : workspaceMode === 'graph'
        ? 'graph'
        : 'writing'

  useEffect(() => {
    if (!activeChapterId && chapters[0]) setActiveChapterId(chapters[0].id)
  }, [activeChapterId, chapters])

  useEffect(() => {
    setSelection({ start: 0, end: 0, text: '' })
  }, [activeChapterId])

  useEffect(() => {
    applyReading(reading)
  }, [reading])

  useEffect(() => {
    if (shell.focus) setWorkspaceMode('manuscript')
  }, [shell.focus])

  useEffect(() => {
    setActiveChapterId(null)
    setRequestedSheetId(null)
    setActiveCanonSheetId(null)
    setActiveBoardId(null)
    setWorkspaceMode('manuscript')
  }, [project.activeProjectId])

  useEffect(() => {
    if (!activeBoardId && lab?.boards[0]) setActiveBoardId(lab.boards[0].id)
  }, [activeBoardId, lab])

  async function switchProject(id: string) {
    await project.switchProject(id)
    agentState.reset()
  }

  async function createProject(id: string, title: string) {
    await project.createProject(id, title)
    agentState.reset()
    setResearchRunning(false)
  }

  useEffect(() => {
    return () => {
      if (recentAcceptTimerRef.current) clearTimeout(recentAcceptTimerRef.current)
    }
  }, [])

  async function acceptProposalWithReceipt(id: string, edits?: ProposalEdits) {
    // New-entity proposals have no existing sheet row to flash yet — accept still commits normally.
    const targetSheetId = project.project?.proposals.find((proposal) => proposal.id === id)?.targetSheetId
    await project.acceptProposal(id, edits)
    if (!targetSheetId) return
    if (recentAcceptTimerRef.current) clearTimeout(recentAcceptTimerRef.current)
    setRecentAcceptSheetId(targetSheetId)
    recentAcceptTimerRef.current = setTimeout(() => setRecentAcceptSheetId(null), 2500)
  }

  async function runContinuity() {
    if (!activeChapter) return
    // One assistant, one job: do not start Continuity while agent/Research is in flight.
    if (agentState.sending || researchRunning) return
    const session = agentState.session()
    const result = await project.runContinuity(activeChapter.id)
    if (result) agentState.addContinuityCard(result.mode, result.counts, session)
  }

  function toggleTheme() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    applyTheme(next)
    const paper: ReadingProfile = next === 'light' ? 'day' : 'night'
    setReading(paper)
  }

  function cycleReading() {
    setReading((current) => nextReading(current))
  }

  function openLab(boardId?: string) {
    if (boardId) setActiveBoardId(boardId)
    setWorkspaceMode('lab')
  }

  /** Canon entry: first visit → map; later → last-opened Canon thing (sheet or map). */
  function openCanon(options?: { sheetId?: string }) {
    const projectId = project.activeProjectId
    let sheetId = options?.sheetId ?? null

    if (!sheetId) {
      const last = shell.getCanonLastOpened(projectId)
      if (last?.kind === 'sheet') {
        const exists = project.project?.sheets.some((sheet) => sheet.id === last.sheetId)
        if (exists) sheetId = last.sheetId
      }
    }

    setWorkspaceMode('graph')
    if (sheetId) {
      setActiveCanonSheetId(sheetId)
      setRequestedSheetId(sheetId)
      if (!shell.isOpen('binder')) shell.toggle('binder')
      shell.setCanonLastOpened(projectId, { kind: 'sheet', sheetId })
    } else {
      setActiveCanonSheetId(null)
      shell.setCanonLastOpened(projectId, { kind: 'map' })
    }
  }

  function openCanonSheet(sheetId: string) {
    setActiveCanonSheetId(sheetId)
    setRequestedSheetId(sheetId)
    setWorkspaceMode('graph')
    if (!shell.isOpen('binder')) shell.toggle('binder')
    shell.setCanonLastOpened(project.activeProjectId, { kind: 'sheet', sheetId })
  }

  function selectChapter(id: string) {
    setActiveChapterId(id)
    setWorkspaceMode('manuscript')
  }

  // The binder is the navigator, not a chapter detail view: a project with no
  // chapters yet still needs its structure and its first move (D1 resting state).
  // Gating this on activeChapter left an empty project staring at a blank rail.
  const binder = (onClose?: () => void) =>
    project.project ? (
      <Binder
        projectId={project.activeProjectId}
        chapters={project.project.chapters}
        sheets={project.project.sheets}
        lab={project.project.lab}
        activeChapterId={activeChapter?.id ?? ''}
        activeBoardId={activeBoardId}
        recentSheetId={recentAcceptSheetId}
        labMode={workspaceMode === 'lab'}
        canonMode={workspaceMode === 'graph'}
        onSelectChapter={(id) => {
          selectChapter(id)
          // Phone binder is navigation: choosing a chapter returns to the paper (BL).
          onClose?.()
        }}
        onSelectLabBoard={(boardId) => {
          openLab(boardId)
          onClose?.()
        }}
        onOpenLab={() => {
          openLab()
          onClose?.()
        }}
        onAddChapter={() => {
          project.addChapter()
          onClose?.()
        }}
        onSaveSheet={project.saveSheet}
        onSaveFact={project.saveFact}
        onDeleteFact={project.deleteFact}
        requestedSheetId={requestedSheetId}
        onRequestedSheetHandled={() => setRequestedSheetId(null)}
        onEditSheet={(sheetId) => {
          if (!sheetId || sheetId === 'new') {
            // 'new' still counts as sheet-open for F2 quiet chrome; no real id yet.
            if (!sheetId) {
              setActiveCanonSheetId(null)
              if (workspaceMode === 'graph') {
                shell.setCanonLastOpened(project.activeProjectId, { kind: 'map' })
              }
            } else {
              setActiveCanonSheetId('new')
            }
            return
          }
          // Sheet detail is a Canon Level-3 thing for landing memory.
          setActiveCanonSheetId(sheetId)
          shell.setCanonLastOpened(project.activeProjectId, { kind: 'sheet', sheetId })
        }}
        onOpenCanonSheet={(sheetId) => {
          if (sheetId) {
            openCanonSheet(sheetId)
            return
          }
          // New sheet from Draft/Lab: enter Canon map, do not restore last sheet.
          setWorkspaceMode('graph')
          setActiveCanonSheetId(null)
          setRequestedSheetId(null)
          shell.setCanonLastOpened(project.activeProjectId, { kind: 'map' })
          if (!shell.isOpen('binder')) shell.toggle('binder')
        }}
        onRequestLeaveGuard={registerSheetLeaveGuard}
        onClose={onClose}
      />
    ) : null

  const agent = (onClose?: () => void) => (
    <AgentPanel
      transcript={agentState.transcript}
      project={project.project}
      onProject={project.applyServerProject}
      beginMutation={project.beginMutation}
      trackMutation={project.trackMutation}
      chapterTitle={activeChapter?.title ?? 'chapter'}
      chapterBody={activeChapter?.body ?? ''}
      companionContext={companionContext}
      contextLabel={
        companionContext === 'lab'
          ? `@${lab?.boards.find((board) => board.id === activeBoardId)?.title ?? 'lab'}`
          : companionContext === 'graph'
            ? '@canon'
            : undefined
      }
      proposals={(project.project?.proposals ?? []).filter((proposal) => proposal.status === 'pending')}
      benchCount={lab?.cards.filter((card) => card.status === 'active' || card.status === 'pinned').length ?? 0}
      canonCount={project.project?.sheets.length ?? 0}
      onOpenBench={() => setBenchDrawerOpen(true)}
      continuityRunning={project.continuity.running}
      continuityMode={project.continuity.mode}
      continuityCounts={project.continuity.counts}
      continuityError={project.continuity.error}
      onRunContinuity={runContinuity}
      onAcceptProposal={acceptProposalWithReceipt}
      onEditProposal={project.editProposal}
      onRejectProposal={project.rejectProposal}
      sending={agentState.sending}
      busyOp={agentState.busyOp}
      researchRunning={researchRunning}
      onResearchRunningChange={setResearchRunning}
      llmMode={agentState.llmMode}
      selection={selection}
      onGenerateCowrite={async (skill, instruction) => {
        if (!activeChapter || project.continuity.running || researchRunning) return
        const chapterId = activeChapter.id
        await agentState.generateCowrite({
          chapterId,
          skill,
          instruction,
          start: selection.start,
          end: selection.end,
        }, () => project.flushChapter(chapterId))
      }}
      onApplyCard={async (id) => {
        if (project.continuity.running || researchRunning || agentState.sending) return
        const appliedChapterId = await agentState.applyCard(id)
        if (appliedChapterId === activeChapter?.id) {
          setSelection({ start: 0, end: 0, text: '' })
        }
      }}
      onDismissCard={agentState.dismissCard}
      onRunReview={async (kind) => {
        if (!activeChapter || project.continuity.running || researchRunning) return
        const chapterId = activeChapter.id
        await agentState.runReview(chapterId, kind, () => project.flushChapter(chapterId))
      }}
      onAddCraftTags={(tags) => {
        if (!activeChapter) return
        project.patchChapter(activeChapter.id, {
          craftTags: [...new Set([...activeChapter.craftTags, ...tags])],
        })
      }}
      onSend={(text, op = 'send') => {
        if (!activeChapter || project.continuity.running || researchRunning) return
        const chapterId = activeChapter.id
        void agentState.send(chapterId, text, () => project.flushChapter(chapterId), op)
      }}
      onSparkPreset={(kind) => {
        if (!activeChapter || project.continuity.running || agentState.sending || researchRunning) return
        const chapterId = activeChapter.id
        const prompts: Record<typeof kind, string> = {
          place: 'Brainstorm 3 places for the Lab bench',
          'character-spark': 'Spark a character for the Lab',
          beat: 'Suggest 3 plot beats for the Lab',
          'what-if': 'Fork a what-if for the Lab',
        }
        if (!shell.isOpen('agent')) shell.toggle('agent')
        void agentState.send(chapterId, prompts[kind], () => project.flushChapter(chapterId), kind)
      }}
      onAddChapter={project.addChapter}
      onClose={onClose}
    />
  )

  return (
    <div className="shell" data-focus={shell.focus} data-sheet-open={workspaceMode === 'graph' && activeCanonSheetId ? 'true' : 'false'}>
      <a className="sr-only" href="#workspace">
        Skip to workspace
      </a>
      <header className="shell__topbar">
        <IconButton
          ref={binderToggleRef}
          label={shell.isOpen('binder') ? 'Hide binder' : 'Show binder'}
          aria-pressed={shell.isOpen('binder')}
          onClick={() => shell.toggle('binder')}
        >
          <BinderIcon />
        </IconButton>
        <ProjectSwitcher
          projects={project.projects}
          activeProjectId={project.activeProjectId}
          onSwitch={switchProject}
          onCreate={createProject}
          onExport={project.exportProject}
        />
        <span className="shell__breadcrumb">
          {project.loading
            ? 'Loading project…'
            : workspaceMode === 'lab'
              ? lab?.boards.find((board) => board.id === activeBoardId)?.title ?? 'Lab'
              : workspaceMode === 'graph'
                ? activeCanonSheetName ?? 'Canon'
                : activeChapter?.title ?? 'No chapters'}
        </span>
        <span className="project-status" aria-live="polite">
          {saveChipLabel(project.saveState)}
        </span>
        <div className="shell__topbar-spacer" />
        <div className="shell__topbar-actions">
          <div className="shell__ecosystem" role="group" aria-label="Workspace">
            <Button
              className="shell__action-ecosystem"
              aria-pressed={workspaceMode === 'manuscript'}
              onClick={() => withSheetLeaveGuard(() => setWorkspaceMode('manuscript'))}
            >
              Draft
            </Button>
            <Button
              className="shell__action-ecosystem"
              aria-pressed={workspaceMode === 'lab'}
              onClick={() => withSheetLeaveGuard(() => openLab())}
            >
              Lab
            </Button>
            <Button
              className="shell__action-ecosystem"
              aria-pressed={workspaceMode === 'graph'}
              onClick={() => withSheetLeaveGuard(() => openCanon())}
            >
              Canon
            </Button>
          </div>
          <IconButton
            className="shell__action-focus"
            label={shell.focus ? 'Exit focus mode' : 'Focus mode'}
            aria-pressed={shell.focus}
            onClick={shell.toggleFocus}
          ><FocusIcon /></IconButton>
          <IconButton
            className="shell__action-theme"
            label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} chrome`}
            onClick={toggleTheme}
          ><ThemeIcon /></IconButton>
          <IconButton
            ref={agentToggleRef}
            className="shell__action-agent"
            label={shell.isOpen('agent') ? 'Hide companion' : 'Show companion'}
            aria-pressed={shell.isOpen('agent')}
            onClick={() => shell.toggle('agent')}
          ><AgentIcon /></IconButton>
        </div>
      </header>

      <div
        className="shell__body"
        data-binder={shell.railVisible('binder') ? 'rail' : 'hidden'}
        data-agent={shell.railVisible('agent') ? 'rail' : 'hidden'}
      >
        {binderRailOpen ? (
          <aside ref={binderRailRef} className="shell__rail shell__rail--binder">{binder()}</aside>
        ) : null}

        {project.loading ? (
          <main id="workspace" className="manuscript" aria-label="Draft" tabIndex={-1}>
            <div className="manuscript__sheet">
              <EmptyState title="Loading project…" hint="Opening your binder and latest draft." />
            </div>
          </main>
        ) : workspaceMode === 'lab' && lab ? (
          <LabBench
            lab={lab}
            activeBoardId={activeBoardId}
            onBoardChange={setActiveBoardId}
            onCreateCard={project.createLabCard}
            onPatchCard={project.patchLabCard}
            onArchiveCard={project.archiveLabCard}
            onRestoreCard={project.restoreLabCard}
            onPinCard={project.pinLabCard}
            onPromoteCard={async (cardId, input) => {
              const result = await project.promoteLabCard(cardId, input)
              if (result.as === 'chapter-stub' && result.chapterId) {
                setActiveChapterId(result.chapterId)
                setWorkspaceMode('manuscript')
              }
              return result
            }}
            onDismissPromotedCard={project.dismissPromotedLabCard}
            onDismissAllPromoted={project.dismissAllPromotedLabCards}
            onOpenAgent={() => {
              if (!shell.isOpen('agent')) shell.toggle('agent')
            }}
          />
        ) : workspaceMode === 'graph' && project.project ? (
          <RelationshipGraph
            project={project.project}
            projectId={project.activeProjectId}
            onProject={project.applyServerProject}
            projectGeneration={project.projectGeneration}
            trackMutation={project.trackMutation}
            beginMutation={project.beginMutation}
            onOpenSheet={(sheetId) => {
              openCanonSheet(sheetId)
            }}
            onNewSheet={() => {
              // Same door as the binder's New sheet button, not a second one: Binder owns the
              // form, so route through its 'new' request rather than inventing a map-local form.
              setWorkspaceMode('graph')
              setRequestedSheetId('new')
              if (!shell.isOpen('binder')) shell.toggle('binder')
            }}
          />
        ) : activeChapter ? (
          <Manuscript
            chapter={activeChapter}
            marks={(project.project?.marks ?? []).filter((mark) => mark.span.chapterId === activeChapter.id)}
            onChange={(patch) => project.patchChapter(activeChapter.id, patch)}
            onSelectionChange={setSelection}
            readOnly={project.applying}
            reading={reading}
            onCycleReading={cycleReading}
            onToggleCraftTag={(tag) => {
              const active = activeChapter.craftTags.includes(tag)
              project.patchChapter(activeChapter.id, {
                craftTags: active
                  ? activeChapter.craftTags.filter((candidate) => candidate !== tag)
                  : [...activeChapter.craftTags, tag],
              })
            }}
          />
        ) : (
          <main id="workspace" className="manuscript" aria-label="Draft" tabIndex={-1}>
            <div className="manuscript__sheet">
              <EmptyState
                title="Start this project"
                hint="Write a first draft chapter, or open Lab to try ideas first."
                action={
                  <div className="shell__empty-doors">
                    {/* One primary per job (ox): binder New chapter owns create when rail open. */}
                    <Button
                      variant={binderRailOpen ? 'ghost' : 'primary'}
                      onClick={project.addChapter}
                      disabled={!project.project}
                    >
                      Write
                    </Button>
                    <Button onClick={() => openLab()} disabled={!project.project}>
                      Start in Lab
                    </Button>
                  </div>
                }
              />
            </div>
          </main>
        )}

        {agentRailOpen ? (
          <aside ref={agentRailRef} className="shell__rail shell__rail--agent">{agent()}</aside>
        ) : null}
      </div>

      {project.error ? <div className="project-error" role="alert">{project.error}</div> : null}

      <Drawer open={shell.drawerOpen('binder')} onClose={shell.closeDrawer} side="left" label="Binder">
        {binder(shell.closeDrawer)}
      </Drawer>
      <Drawer open={shell.drawerOpen('agent')} onClose={shell.closeDrawer} side="right" label="Companion">
        {agent(shell.closeDrawer)}
      </Drawer>
      <Drawer open={benchDrawerOpen} onClose={() => setBenchDrawerOpen(false)} side="right" label="Bench this">
        <BenchQuickAdd
          boardId={activeBoardId}
          initialTitle={selection.text.slice(0, 80)}
          onCreateCard={project.createLabCard}
          onClose={() => setBenchDrawerOpen(false)}
        />
      </Drawer>
    </div>
  )
}
