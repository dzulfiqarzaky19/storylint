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
import { LabBench } from '../../features/lab/LabBench.tsx'
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
  const [selection, setSelection] = useState<EditorSelection>({ start: 0, end: 0, text: '' })

  const chapters = project.project?.chapters ?? EMPTY_CHAPTERS
  const activeChapter =
    chapters.find((chapter) => chapter.id === activeChapterId) ?? chapters[0] ?? null
  const lab = project.project?.lab ?? null

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

  function selectChapter(id: string) {
    setActiveChapterId(id)
    setWorkspaceMode('manuscript')
  }

  const binder = (onClose?: () => void) =>
    project.project && activeChapter ? (
      <Binder
        chapters={project.project.chapters}
        sheets={project.project.sheets}
        lab={project.project.lab}
        activeChapterId={activeChapter.id}
        activeBoardId={activeBoardId}
        labMode={workspaceMode === 'lab'}
        onSelectChapter={selectChapter}
        onSelectLabBoard={(boardId) => openLab(boardId)}
        onOpenLab={() => openLab()}
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
      companionContext={companionContext}
      contextLabel={
        companionContext === 'lab'
          ? `@${lab?.boards.find((board) => board.id === activeBoardId)?.title ?? 'lab'}`
          : companionContext === 'graph'
            ? '@graph'
            : undefined
      }
      proposals={(project.project?.proposals ?? []).filter((proposal) => proposal.status === 'pending')}
      continuityRunning={project.continuity.running}
      continuityMode={project.continuity.mode}
      onRunContinuity={runContinuity}
      onAcceptProposal={project.acceptProposal}
      onEditProposal={project.editProposal}
      onRejectProposal={project.rejectProposal}
      sending={agentState.sending}
      llmMode={agentState.llmMode}
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
      onClose={onClose}
    />
  )

  return (
    <div className="shell" data-focus={shell.focus}>
      <a className="sr-only" href="#workspace">
        Skip to workspace
      </a>
      <header className="shell__topbar">
        <IconButton
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
                ? 'Graph'
                : activeChapter?.title ?? 'No chapters'}
        </span>
        <span className="project-status" aria-live="polite">
          {project.saveState === 'saving' ? 'Saving…' : project.saveState === 'saved' ? 'Saved' : ''}
        </span>
        <div className="shell__topbar-spacer" />
        <div className="shell__topbar-actions">
          <Button
            className="shell__action-graph"
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
          </Button>
          <Button
            className="shell__action-continuity"
            variant="primary"
            disabled={!activeChapter || project.continuity.running || workspaceMode === 'lab'}
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
        {shell.railVisible('binder') ? (
          <aside className="shell__rail shell__rail--binder">{binder()}</aside>
        ) : null}

        {project.loading ? (
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
      <Drawer open={shell.drawerOpen('agent')} onClose={shell.closeDrawer} side="right" label="Companion">
        {agent(shell.closeDrawer)}
      </Drawer>
    </div>
  )
}
