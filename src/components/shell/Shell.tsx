import { useEffect, useState } from 'react'
import {
  applyReading,
  applyTheme,
  nextReading,
  type ReadingProfile,
  type Theme,
} from '../../design'
import { useProject } from '../../features/project/useProject.ts'
import { ProjectSwitcher } from '../../features/project/ProjectSwitcher.tsx'
import { useAgent } from '../../features/agent/useAgent.ts'
<<<<<<< HEAD
import { Button, Drawer, EmptyState, IconButton } from '../ui'
import { AgentIcon, BinderIcon, FocusIcon, ThemeIcon } from './icons'
import { AgentPanel } from './AgentPanel'
=======
import { LabBench } from '../../features/lab/LabBench.tsx'
import { Button, Drawer, EmptyState, IconButton } from '../ui'
import { AgentIcon, BinderIcon, FocusIcon, ThemeIcon } from './icons'
import { AgentPanel, type CompanionContext } from './AgentPanel'
>>>>>>> storylint/lab-slice
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
<<<<<<< HEAD
  const [workspaceMode, setWorkspaceMode] = useState<'manuscript' | 'graph'>('manuscript')
=======
  const [workspaceMode, setWorkspaceMode] = useState<'manuscript' | 'graph' | 'lab'>('manuscript')
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null)
>>>>>>> storylint/lab-slice
  const [requestedSheetId, setRequestedSheetId] = useState<string | null>(null)
  const [selection, setSelection] = useState<EditorSelection>({ start: 0, end: 0, text: '' })

  const chapters = project.project?.chapters ?? EMPTY_CHAPTERS
  const activeChapter =
    chapters.find((chapter) => chapter.id === activeChapterId) ?? chapters[0] ?? null
<<<<<<< HEAD
=======
  const lab = project.project?.lab ?? null

  const companionContext: CompanionContext =
    workspaceMode === 'lab'
      ? 'lab'
      : workspaceMode === 'graph'
        ? 'graph'
        : 'writing'
>>>>>>> storylint/lab-slice

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
<<<<<<< HEAD
    setWorkspaceMode('manuscript')
  }, [project.activeProjectId])

=======
    setActiveBoardId(null)
    setWorkspaceMode('manuscript')
  }, [project.activeProjectId])

  useEffect(() => {
    if (!activeBoardId && lab?.boards[0]) setActiveBoardId(lab.boards[0].id)
  }, [activeBoardId, lab])

>>>>>>> storylint/lab-slice
  async function switchProject(id: string) {
    await project.switchProject(id)
    agentState.reset()
  }

  async function createProject(id: string, title: string) {
    await project.createProject(id, title)
    agentState.reset()
  }

  async function runContinuity() {
    if (!activeChapter) return
    const session = agentState.session()
    const result = await project.runContinuity(activeChapter.id)
    if (result) agentState.addContinuityCard(result.mode, result.counts, session)
  }

  function toggleTheme() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    applyTheme(next)
<<<<<<< HEAD
    // Keep paper in sync with shell when flipping day/night chrome
=======
>>>>>>> storylint/lab-slice
    const paper: ReadingProfile = next === 'light' ? 'day' : 'night'
    setReading(paper)
  }

  function cycleReading() {
    setReading((current) => nextReading(current))
  }

<<<<<<< HEAD
=======
  function openLab(boardId?: string) {
    if (boardId) setActiveBoardId(boardId)
    setWorkspaceMode('lab')
  }

  function selectChapter(id: string) {
    setActiveChapterId(id)
    setWorkspaceMode('manuscript')
  }

>>>>>>> storylint/lab-slice
  const binder = (onClose?: () => void) =>
    project.project && activeChapter ? (
      <Binder
        chapters={project.project.chapters}
        sheets={project.project.sheets}
<<<<<<< HEAD
        activeChapterId={activeChapter.id}
        onSelectChapter={setActiveChapterId}
=======
        lab={project.project.lab}
        activeChapterId={activeChapter.id}
        activeBoardId={activeBoardId}
        labMode={workspaceMode === 'lab'}
        onSelectChapter={selectChapter}
        onSelectLabBoard={(boardId) => openLab(boardId)}
        onOpenLab={() => openLab()}
>>>>>>> storylint/lab-slice
        onAddChapter={project.addChapter}
        onSaveSheet={project.saveSheet}
        onSaveFact={project.saveFact}
        onDeleteFact={project.deleteFact}
        requestedSheetId={requestedSheetId}
        onRequestedSheetHandled={() => setRequestedSheetId(null)}
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
<<<<<<< HEAD
=======
      companionContext={companionContext}
      contextLabel={
        companionContext === 'lab'
          ? `@${lab?.boards.find((board) => board.id === activeBoardId)?.title ?? 'lab'}`
          : companionContext === 'graph'
            ? '@graph'
            : undefined
      }
>>>>>>> storylint/lab-slice
      proposals={(project.project?.proposals ?? []).filter((proposal) => proposal.status === 'pending')}
      continuityRunning={project.continuity.running}
      continuityMode={project.continuity.mode}
      onRunContinuity={runContinuity}
      onAcceptProposal={project.acceptProposal}
      onEditProposal={project.editProposal}
      onRejectProposal={project.rejectProposal}
      sending={agentState.sending}
<<<<<<< HEAD
=======
      llmMode={agentState.llmMode}
>>>>>>> storylint/lab-slice
      tipsDismissed={agentState.tipsDismissed}
      onDismissTips={agentState.dismissTips}
      selection={selection}
      onGenerateCowrite={async (skill, instruction) => {
        if (!activeChapter) return
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
        const appliedChapterId = await agentState.applyCard(id)
        if (appliedChapterId === activeChapter?.id) {
          setSelection({ start: 0, end: 0, text: '' })
        }
      }}
      onDismissCard={agentState.dismissCard}
      onRunReview={async (kind) => {
        if (!activeChapter) return
        const chapterId = activeChapter.id
        await agentState.runReview(chapterId, kind, () => project.flushChapter(chapterId))
      }}
      onAddCraftTags={(tags) => {
        if (!activeChapter) return
        project.patchChapter(activeChapter.id, {
          craftTags: [...new Set([...activeChapter.craftTags, ...tags])],
        })
      }}
      onSend={(text) => {
        if (!activeChapter) return
        const chapterId = activeChapter.id
        void agentState.send(chapterId, text, () => project.flushChapter(chapterId))
      }}
<<<<<<< HEAD
=======
      onSparkPreset={(kind) => {
        if (!activeChapter) return
        const chapterId = activeChapter.id
        const prompts: Record<typeof kind, string> = {
          place: 'Brainstorm 3 places for the Lab bench',
          'character-spark': 'Spark a character for the Lab',
          beat: 'Suggest 3 plot beats for the Lab',
          'what-if': 'Fork a what-if for the Lab',
        }
        if (!shell.isOpen('agent')) shell.toggle('agent')
        void agentState.send(chapterId, prompts[kind], () => project.flushChapter(chapterId))
      }}
>>>>>>> storylint/lab-slice
      onClose={onClose}
    />
  )

  return (
    <div className="shell" data-focus={shell.focus}>
<<<<<<< HEAD
=======
      <a className="sr-only" href="#workspace">
        Skip to workspace
      </a>
>>>>>>> storylint/lab-slice
      <header className="shell__topbar">
        <IconButton
          label={shell.isOpen('binder') ? 'Hide binder' : 'Show binder'}
          aria-pressed={shell.isOpen('binder')}
          onClick={() => shell.toggle('binder')}
        >
          <BinderIcon />
        </IconButton>
        <h1 className="shell__project">{project.project?.title ?? 'Storylint'}</h1>
        <ProjectSwitcher
          projects={project.projects}
          activeProjectId={project.activeProjectId}
          onSwitch={switchProject}
          onCreate={createProject}
          onExport={project.exportProject}
        />
<<<<<<< HEAD
        <span className="shell__breadcrumb">{activeChapter?.title ?? 'Loading…'}</span>
=======
        <span className="shell__breadcrumb">
          {project.loading
            ? 'Loading project…'
            : workspaceMode === 'lab'
              ? lab?.boards.find((board) => board.id === activeBoardId)?.title ?? 'Lab'
              : workspaceMode === 'graph'
                ? 'Graph'
                : activeChapter?.title ?? 'No chapters'}
        </span>
>>>>>>> storylint/lab-slice
        <span className="project-status" aria-live="polite">
          {project.saveState === 'saving' ? 'Saving…' : project.saveState === 'saved' ? 'Saved' : ''}
        </span>
        <div className="shell__topbar-spacer" />
        <div className="shell__topbar-actions">
          <Button
            className="shell__action-graph"
<<<<<<< HEAD
            aria-pressed={workspaceMode === 'graph'}
            onClick={() => setWorkspaceMode((current) => current === 'graph' ? 'manuscript' : 'graph')}
          >
            {workspaceMode === 'graph' ? 'Editor' : 'Graph'}
=======
            aria-pressed={workspaceMode === 'manuscript'}
            onClick={() => setWorkspaceMode('manuscript')}
          >
            Editor
          </Button>
          <Button
            className="shell__action-graph"
            aria-pressed={workspaceMode === 'graph'}
            onClick={() => setWorkspaceMode('graph')}
          >
            Graph
          </Button>
          <Button
            className="shell__action-graph"
            aria-pressed={workspaceMode === 'lab'}
            onClick={() => openLab()}
          >
            Lab
>>>>>>> storylint/lab-slice
          </Button>
          <Button
            className="shell__action-continuity"
            variant="primary"
<<<<<<< HEAD
            disabled={!activeChapter || project.continuity.running}
=======
            disabled={!activeChapter || project.continuity.running || workspaceMode === 'lab'}
>>>>>>> storylint/lab-slice
            onClick={() => void runContinuity().catch(() => undefined)}
          >
            {project.continuity.running ? 'Running…' : 'Continuity'}
          </Button>
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
            className="shell__action-agent"
<<<<<<< HEAD
            label={shell.isOpen('agent') ? 'Hide agent panel' : 'Show agent panel'}
=======
            label={shell.isOpen('agent') ? 'Hide companion' : 'Show companion'}
>>>>>>> storylint/lab-slice
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
        {shell.railVisible('binder') ? (
          <aside className="shell__rail shell__rail--binder">{binder()}</aside>
        ) : null}

        {project.loading ? (
<<<<<<< HEAD
          <main className="manuscript" aria-label="Manuscript">
            <div className="manuscript__sheet"><EmptyState title="Loading project…" /></div>
          </main>
=======
          <main id="workspace" className="manuscript" aria-label="Manuscript" tabIndex={-1}>
            <div className="manuscript__sheet">
              <EmptyState title="Loading project…" hint="Opening your binder and latest chapter." />
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
            onPinCard={project.pinLabCard}
            onPromoteCard={project.promoteLabCard}
            onOpenAgent={() => {
              if (!shell.isOpen('agent')) shell.toggle('agent')
            }}
          />
>>>>>>> storylint/lab-slice
        ) : workspaceMode === 'graph' && project.project ? (
          <RelationshipGraph
            project={project.project}
            onProject={project.applyServerProject}
            projectGeneration={project.projectGeneration}
            trackMutation={project.trackMutation}
            beginMutation={project.beginMutation}
            onOpenSheet={(sheetId) => {
              setRequestedSheetId(sheetId)
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
<<<<<<< HEAD
          <main className="manuscript" aria-label="Manuscript">
            <div className="manuscript__sheet"><EmptyState title="No chapters" /></div>
=======
          <main id="workspace" className="manuscript" aria-label="Manuscript" tabIndex={-1}>
            <div className="manuscript__sheet">
              <EmptyState
                title="No chapters"
                hint="Start the manuscript with one chapter. You can rename it anytime."
                action={
                  <Button variant="primary" onClick={project.addChapter} disabled={!project.project}>
                    New chapter
                  </Button>
                }
              />
            </div>
>>>>>>> storylint/lab-slice
          </main>
        )}

        {shell.railVisible('agent') ? (
          <aside className="shell__rail shell__rail--agent">{agent()}</aside>
        ) : null}
      </div>

      {project.error ? <div className="project-error" role="alert">{project.error}</div> : null}

      <Drawer open={shell.drawerOpen('binder')} onClose={shell.closeDrawer} side="left" label="Binder">
        {binder(shell.closeDrawer)}
      </Drawer>
<<<<<<< HEAD
      <Drawer open={shell.drawerOpen('agent')} onClose={shell.closeDrawer} side="right" label="Agent panel">
=======
      <Drawer open={shell.drawerOpen('agent')} onClose={shell.closeDrawer} side="right" label="Companion">
>>>>>>> storylint/lab-slice
        {agent(shell.closeDrawer)}
      </Drawer>
    </div>
  )
}
