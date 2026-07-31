import { useCallback, useEffect, useRef, useState } from 'react'
import type { Chapter, Fact, LabCardKind, Project, Sheet, SheetKind } from '../../domain/types.ts'
import type { ApplyCard } from '../../cowrite/types.ts'
import * as api from './api.ts'

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const DRAFT_PREFIX = 'storylint:chapter-draft:'

function draftKey(projectId: string, chapterId: string): string {
  return `${DRAFT_PREFIX}${projectId}:${chapterId}`
}

function storeDraft(projectId: string, chapter: Chapter): void {
  try {
    localStorage.setItem(draftKey(projectId, chapter.id), JSON.stringify(chapter))
  } catch {
    // Persistence continues through the server path when browser storage is unavailable.
  }
}

function removeDraft(projectId: string, chapterId: string): void {
  try {
    localStorage.removeItem(draftKey(projectId, chapterId))
  } catch {
    // A stale recovery copy is safer than turning a successful server save into an error.
  }
}

function readDraft(projectId: string, chapter: Chapter): Chapter | null {
  try {
    const value = localStorage.getItem(draftKey(projectId, chapter.id))
    if (!value) return null
    const draft = JSON.parse(value) as unknown
    if (typeof draft !== 'object' || draft === null) return null
    const candidate = draft as Record<string, unknown>
    return candidate.id === chapter.id && candidate.revision === chapter.revision &&
      typeof candidate.title === 'string' && typeof candidate.body === 'string' &&
      Array.isArray(candidate.craftTags)
      ? candidate as Chapter
      : null
  } catch {
    return null
  }
}

export type ProjectController = {
  project: Project | null
  loading: boolean
  error: string | null
  saveState: SaveState
  patchChapter: (chapterId: string, patch: Partial<Pick<Chapter, 'title' | 'body' | 'craftTags'>>) => void
  addChapter: () => void
  saveSheet: (sheet: Sheet) => Promise<void>
  saveFact: (sheetId: string, fact: Fact) => Promise<void>
  deleteFact: (sheetId: string, factId: string) => Promise<void>
  continuity: {
    running: boolean
    mode: 'fixture' | 'live' | null
    counts: { red: number; yellow: number; proposals: number } | null
    error: string | null
  }
  runContinuity: (chapterId: string) => Promise<api.ContinuityResponse | null>
  acceptProposal: (id: string, edits?: api.ProposalEdits) => Promise<void>
  editProposal: (id: string, edits: api.ProposalEdits) => Promise<void>
  rejectProposal: (id: string) => Promise<void>
  applyServerProject: (project: Project, generation?: number) => void
  projectGeneration: () => number
  trackMutation: <T>(operation: Promise<T>) => Promise<T>
  beginMutation: () => number | null
  flushChapter: (chapterId: string) => Promise<void>
  applying: boolean
  applySuggestion: (card: ApplyCard) => Promise<Project>
  projects: api.ProjectSummary[]
  activeProjectId: string
  switchProject: (id: string) => Promise<void>
  createProject: (id: string, title: string) => Promise<void>
    exportProject: () => Promise<void>
  createLabCard: (input: { boardId?: string; kind: LabCardKind; title: string; body?: string }) => Promise<Project>
  patchLabCard: (cardId: string, patch: { title?: string; body?: string; kind?: LabCardKind }) => Promise<Project>
  archiveLabCard: (cardId: string) => Promise<void>
  pinLabCard: (cardId: string, pinned?: boolean) => Promise<void>
  promoteLabCard: (cardId: string, input?: { sheetKind?: SheetKind; chapterTitle?: string }) => Promise<api.PromoteLabResponse>
}

/** API-backed project state. Chapter writes debounce; structured Canon edits save explicitly. */
export function useProject(): ProjectController {
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [projects, setProjects] = useState<api.ProjectSummary[]>([])
  const [activeProjectId, setActiveProjectId] = useState('default')
  const [continuity, setContinuity] = useState<{
    running: boolean
    mode: 'fixture' | 'live' | null
    counts: { red: number; yellow: number; proposals: number } | null
    error: string | null
  }>({
    running: false,
    mode: null,
    counts: null,
    error: null,
  })
  const projectRef = useRef<Project | null>(null)
  const activeProjectIdRef = useRef('default')
  const continuityRunningRef = useRef(false)
  const applyingRef = useRef(false)
  const editLockRef = useRef(false)
  const projectGenerationRef = useRef(0)
  const [applying, setApplying] = useState(false)
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const inFlightSaves = useRef(new Map<string, Promise<void>>())
  const inFlightMutations = useRef(new Set<Promise<unknown>>())
  const revisions = useRef(new Map<string, number>())
  const savedRevisions = useRef(new Map<string, number>())
  const serverRevisions = useRef(new Map<string, number>())

  function setCurrent(next: Project): void {
    projectRef.current = next
    setProject(next)
  }

  function setActiveId(id: string): void {
    activeProjectIdRef.current = id
    setActiveProjectId(id)
  }

  /** Keep only dirty local chapters; otherwise trust server (avoids stale tabs wiping prose). */
  function mergeServerProject(next: Project, generation = projectGenerationRef.current): void {
    if (generation !== projectGenerationRef.current) return
    const current = projectRef.current
    if (!current) {
      setCurrent(next)
      return
    }
    const serverIds = new Set(next.chapters.map((chapter) => chapter.id))
    const chapters = next.chapters.map((serverChapter) => {
      const clientChapter = current.chapters.find((chapter) => chapter.id === serverChapter.id)
      if (!clientChapter) return serverChapter
      const revision = revisions.current.get(serverChapter.id) ?? 0
      const savedRevision = savedRevisions.current.get(serverChapter.id) ?? 0
      const dirty = timers.current.has(serverChapter.id) || revision > savedRevision
      return dirty ? { ...clientChapter, revision: serverChapter.revision } : serverChapter
    })
    for (const clientChapter of current.chapters) {
      if (!serverIds.has(clientChapter.id)) chapters.push(clientChapter)
    }
    setCurrent({ ...next, chapters })
  }

  function beginMutation(): number | null {
    if (editLockRef.current) return null
    return projectGenerationRef.current
  }

  function applyIfCurrent(generation: number, next: Project): boolean {
    if (generation !== projectGenerationRef.current) return false
    mergeServerProject(next, generation)
    return true
  }

  function trackMutation<T>(operation: Promise<T>): Promise<T> {
    inFlightMutations.current.add(operation)
    void operation.finally(() => inFlightMutations.current.delete(operation))
    return operation
  }

  async function awaitPendingMutations(): Promise<void> {
    await Promise.allSettled([
      ...inFlightSaves.current.values(),
      ...inFlightMutations.current,
    ])
  }

  const persistChapter = useCallback((projectId: string, chapter: Chapter, revision: number, generation: number): Promise<void> => {
    setSaveState('saving')
    const previous = inFlightSaves.current.get(chapter.id) ?? Promise.resolve()
    const operation = previous.then(async () => {
      if (generation !== projectGenerationRef.current || activeProjectIdRef.current !== projectId) return
      try {
        const expectedRevision = serverRevisions.current.get(chapter.id) ?? chapter.revision
        const saved = await api.saveChapter({ ...chapter, revision: expectedRevision })
        if (generation !== projectGenerationRef.current || activeProjectIdRef.current !== projectId) return
        const savedChapter = saved.chapters.find((candidate) => candidate.id === chapter.id)
        if (savedChapter) serverRevisions.current.set(chapter.id, savedChapter.revision)
        savedRevisions.current.set(chapter.id, Math.max(savedRevisions.current.get(chapter.id) ?? 0, revision))
        if (revisions.current.get(chapter.id) !== revision) return
        removeDraft(projectId, chapter.id)
        mergeServerProject(saved, generation)
        setSaveState('saved')
        setError(null)
      } catch (caught) {
        if (generation !== projectGenerationRef.current || activeProjectIdRef.current !== projectId) return
        setSaveState('error')
        setError(caught instanceof Error ? caught.message : 'Failed to save chapter')
        throw caught
      }
    })
    inFlightSaves.current.set(chapter.id, operation)
    void operation.finally(() => {
      if (inFlightSaves.current.get(chapter.id) === operation) inFlightSaves.current.delete(chapter.id)
    }).catch(() => undefined)
    return operation
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      api.loadProject(controller.signal),
      api.listProjects(),
    ])
      .then(([loaded, listed]) => {
        const projectId = listed.activeProjectId
        setActiveId(projectId)
        setProjects(listed.projects)
        const drafts = new Map(loaded.chapters.map((chapter) => [chapter.id, readDraft(projectId, chapter)]))
        const restored = {
          ...loaded,
          chapters: loaded.chapters.map((chapter) => drafts.get(chapter.id) ?? chapter),
        }
        setCurrent(restored)
        revisions.current.clear()
        savedRevisions.current.clear()
        serverRevisions.current.clear()
        for (const chapter of loaded.chapters) {
          serverRevisions.current.set(chapter.id, chapter.revision)
          const dirty = drafts.get(chapter.id) !== null
          revisions.current.set(chapter.id, dirty ? 1 : 0)
          savedRevisions.current.set(chapter.id, 0)
          if (dirty) {
            const generation = projectGenerationRef.current
            timers.current.set(chapter.id, setTimeout(() => {
              timers.current.delete(chapter.id)
              const draft = projectRef.current?.chapters.find((candidate) => candidate.id === chapter.id)
              if (draft) void persistChapter(projectId, draft, 1, generation).catch(() => undefined)
            }, 0))
          }
        }
        setError(null)
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') return
        setError(caught instanceof Error ? caught.message : 'Failed to load project')
      })
      .finally(() => setLoading(false))

    const scheduled = timers.current
    return () => {
      controller.abort()
      for (const timer of scheduled.values()) clearTimeout(timer)
    }
  }, [persistChapter])

  const patchChapter = useCallback(
    (chapterId: string, patch: Partial<Pick<Chapter, 'title' | 'body' | 'craftTags'>>) => {
      if (applyingRef.current || editLockRef.current) return
      const current = projectRef.current
      const chapter = current?.chapters.find((candidate) => candidate.id === chapterId)
      if (!current || !chapter) return
      const projectId = activeProjectIdRef.current
      const generation = projectGenerationRef.current
      const nextChapter = { ...chapter, ...patch }
      storeDraft(projectId, nextChapter)
      setCurrent({
        ...current,
        chapters: current.chapters.map((candidate) =>
          candidate.id === chapterId ? nextChapter : candidate,
        ),
      })
      setSaveState('saving')
      const revision = (revisions.current.get(chapterId) ?? 0) + 1
      revisions.current.set(chapterId, revision)
      const pending = timers.current.get(chapterId)
      if (pending) clearTimeout(pending)
      timers.current.set(
        chapterId,
        setTimeout(() => {
          timers.current.delete(chapterId)
          void persistChapter(projectId, nextChapter, revision, generation).catch(() => undefined)
        }, 500),
      )
    },
    [persistChapter],
  )

  const addChapter = useCallback(() => {
    const generation = beginMutation()
    if (generation === null) return
    const current = projectRef.current
    if (!current) return
    const chapter: Chapter = {
      id: `chapter-${Date.now()}`,
      title: '', // BM: never store factory chapter title (ox chapter-create-title)
      body: '',
      craftTags: [],
      revision: 0,
    }
    setSaveState('saving')
    void trackMutation(api.saveChapter(chapter))
      .then((saved) => {
        if (generation !== projectGenerationRef.current) return
        const savedChapter = saved.chapters.find((candidate) => candidate.id === chapter.id)
        if (savedChapter) serverRevisions.current.set(chapter.id, savedChapter.revision)
        setCurrent(saved)
        setSaveState('saved')
        setError(null)
      })
      .catch((caught: unknown) => {
        if (generation !== projectGenerationRef.current) return
        setSaveState('error')
        setError(caught instanceof Error ? caught.message : 'Failed to add chapter')
      })
  }, [])

  const saveSheet = useCallback(async (sheet: Sheet) => {
    const generation = beginMutation()
    if (generation === null) throw new Error('Project switch in progress')
    try {
      const saved = await trackMutation(api.upsertSheet(sheet))
      if (!applyIfCurrent(generation, saved)) return
      setError(null)
    } catch (caught) {
      if (generation === projectGenerationRef.current) {
        setError(caught instanceof Error ? caught.message : 'Failed to save sheet')
      }
      throw caught
    }
  }, [])

  const saveFact = useCallback(async (sheetId: string, fact: Fact) => {
    const generation = beginMutation()
    if (generation === null) throw new Error('Project switch in progress')
    try {
      const saved = await trackMutation(api.upsertFact(sheetId, fact))
      if (!applyIfCurrent(generation, saved)) return
      setError(null)
    } catch (caught) {
      if (generation === projectGenerationRef.current) {
        setError(caught instanceof Error ? caught.message : 'Failed to save fact')
      }
      throw caught
    }
  }, [])

  const deleteFact = useCallback(async (sheetId: string, factId: string) => {
    const generation = beginMutation()
    if (generation === null) throw new Error('Project switch in progress')
    try {
      const saved = await trackMutation(api.removeFact(sheetId, factId))
      if (!applyIfCurrent(generation, saved)) return
      setError(null)
    } catch (caught) {
      if (generation === projectGenerationRef.current) {
        setError(caught instanceof Error ? caught.message : 'Failed to delete fact')
      }
      throw caught
    }
  }, [])

  const flushChapter = useCallback(async (chapterId: string) => {
    const projectId = activeProjectIdRef.current
    const generation = projectGenerationRef.current
    while (true) {
      if (generation !== projectGenerationRef.current || activeProjectIdRef.current !== projectId) return
      const timer = timers.current.get(chapterId)
      if (timer) {
        clearTimeout(timer)
        timers.current.delete(chapterId)
        const chapter = projectRef.current?.chapters.find((candidate) => candidate.id === chapterId)
        if (chapter) await persistChapter(projectId, chapter, revisions.current.get(chapterId) ?? 0, generation)
        continue
      }
      const inFlight = inFlightSaves.current.get(chapterId)
      if (inFlight) {
        await inFlight
        continue
      }
      const revision = revisions.current.get(chapterId) ?? 0
      if ((savedRevisions.current.get(chapterId) ?? 0) < revision) {
        const chapter = projectRef.current?.chapters.find((candidate) => candidate.id === chapterId)
        if (!chapter) throw new Error(`Chapter not found: ${chapterId}`)
        await persistChapter(projectId, chapter, revision, generation)
        continue
      }
      return
    }
  }, [persistChapter])

  const applySuggestion = useCallback(async (card: ApplyCard): Promise<Project> => {
    if (applyingRef.current) throw new Error('An Apply is already running')
    const generation = beginMutation()
    if (generation === null) throw new Error('Project switch in progress')
    applyingRef.current = true
    setApplying(true)
    try {
      const committed = await trackMutation((async () => {
        await flushChapter(card.chapterId)
        if (generation !== projectGenerationRef.current) throw new Error('Project switched during Apply')
        return api.applySuggestion(card.chapterId, card)
      })())
      if (generation !== projectGenerationRef.current) throw new Error('Project switched during Apply')
      const committedChapter = committed.chapters.find((candidate) => candidate.id === card.chapterId)
      if (committedChapter) serverRevisions.current.set(card.chapterId, committedChapter.revision)
      const timer = timers.current.get(card.chapterId)
      if (timer) clearTimeout(timer)
      timers.current.delete(card.chapterId)
      const revision = (revisions.current.get(card.chapterId) ?? 0) + 1
      revisions.current.set(card.chapterId, revision)
      savedRevisions.current.set(card.chapterId, revision)
      removeDraft(activeProjectIdRef.current, card.chapterId)
      mergeServerProject(committed, generation)
      return committed
    } finally {
      applyingRef.current = false
      setApplying(false)
    }
  }, [flushChapter])

  const runContinuity = useCallback(async (chapterId: string) => {
    if (continuityRunningRef.current) return null
    const generation = beginMutation()
    if (generation === null) return null
    continuityRunningRef.current = true
    setContinuity((current) => ({ ...current, running: true, error: null }))
    try {
      const result = await trackMutation((async () => {
        await flushChapter(chapterId)
        if (generation !== projectGenerationRef.current) throw new Error('Project switched during Continuity')
        return api.runContinuity(chapterId)
      })())
      if (generation !== projectGenerationRef.current) return null
      if (!applyIfCurrent(generation, result.project)) return null
      setContinuity({ running: false, mode: result.mode, counts: result.counts, error: null })
      setError(null)
      return result
    } catch (caught) {
      if (generation === projectGenerationRef.current) {
        const message = caught instanceof Error ? caught.message : 'Continuity failed'
        // Stale success after fail is a lie: drop last ready result; face owns this-run outcome.
        setContinuity({ running: false, mode: null, counts: null, error: message })
        setError(message)
      }
      throw caught
    } finally {
      continuityRunningRef.current = false
      if (generation === projectGenerationRef.current) {
        setContinuity((current) => (current.running ? { ...current, running: false } : current))
      }
    }
  }, [flushChapter])

  const acceptProposal = useCallback(async (id: string, edits: api.ProposalEdits = {}) => {
    const generation = beginMutation()
    if (generation === null) throw new Error('Project switch in progress')
    try {
      const saved = await trackMutation(api.acceptProposal(id, edits))
      if (!applyIfCurrent(generation, saved)) return
      setError(null)
    } catch (caught) {
      if (generation === projectGenerationRef.current) {
        setError(caught instanceof Error ? caught.message : 'Failed to accept proposal')
      }
      throw caught
    }
  }, [])

  const editProposal = useCallback(async (id: string, edits: api.ProposalEdits) => {
    const generation = beginMutation()
    if (generation === null) throw new Error('Project switch in progress')
    try {
      const saved = await trackMutation(api.editProposal(id, edits))
      if (!applyIfCurrent(generation, saved)) return
      setError(null)
    } catch (caught) {
      if (generation === projectGenerationRef.current) {
        setError(caught instanceof Error ? caught.message : 'Failed to edit proposal')
      }
      throw caught
    }
  }, [])

  const rejectProposal = useCallback(async (id: string) => {
    const generation = beginMutation()
    if (generation === null) throw new Error('Project switch in progress')
    try {
      const saved = await trackMutation(api.rejectProposal(id))
      if (!applyIfCurrent(generation, saved)) return
      setError(null)
    } catch (caught) {
      if (generation === projectGenerationRef.current) {
        setError(caught instanceof Error ? caught.message : 'Failed to reject proposal')
      }
      throw caught
    }
  }, [])

  async function flushAllChapters(): Promise<void> {
    const current = projectRef.current
    if (!current) return
    for (const chapter of current.chapters) await flushChapter(chapter.id)
  }

  async function installProject(projectId: string, next: Project): Promise<void> {
    editLockRef.current = true
    projectGenerationRef.current += 1
    try {
      for (const timer of timers.current.values()) clearTimeout(timer)
      timers.current.clear()
      await awaitPendingMutations()
      inFlightSaves.current.clear()
      revisions.current.clear()
      savedRevisions.current.clear()
      serverRevisions.current.clear()
      const drafts = new Map(next.chapters.map((chapter) => [chapter.id, readDraft(projectId, chapter)]))
      const restored = {
        ...next,
        chapters: next.chapters.map((chapter) => drafts.get(chapter.id) ?? chapter),
      }
      for (const chapter of next.chapters) {
        serverRevisions.current.set(chapter.id, chapter.revision)
        const dirty = drafts.get(chapter.id) !== null
        revisions.current.set(chapter.id, dirty ? 1 : 0)
        savedRevisions.current.set(chapter.id, 0)
        if (dirty) {
          const generation = projectGenerationRef.current
          timers.current.set(chapter.id, setTimeout(() => {
            timers.current.delete(chapter.id)
            const draft = projectRef.current?.chapters.find((candidate) => candidate.id === chapter.id)
            if (draft) void persistChapter(projectId, draft, 1, generation).catch(() => undefined)
          }, 0))
        }
      }
      setActiveId(projectId)
      setCurrent(restored)
      setSaveState(restored.chapters.some((chapter) => drafts.get(chapter.id)) ? 'saving' : 'idle')
      setContinuity({ running: false, mode: null, counts: null, error: null })
    } finally {
      editLockRef.current = false
    }
  }

  async function switchProject(id: string) {
    if (editLockRef.current || id === activeProjectIdRef.current) return
    editLockRef.current = true
    try {
      await flushAllChapters()
      await awaitPendingMutations()
      const next = await api.activateProject(id)
      await installProject(id, next)
    } catch (caught) {
      editLockRef.current = false
      throw caught
    }
  }

  async function createProject(id: string, title: string) {
    if (editLockRef.current) return
    editLockRef.current = true
    try {
      await flushAllChapters()
      await awaitPendingMutations()
      const created = await api.createProject(id, title)
      await installProject(id, created)
      const listed = await api.listProjects()
      setProjects(listed.projects)
      setActiveId(listed.activeProjectId)
    } catch (caught) {
      editLockRef.current = false
      throw caught
    }
  }

  async function exportProject() {
    const generation = beginMutation()
    if (generation === null) throw new Error('Project switch in progress')
    const projectId = activeProjectIdRef.current
    await trackMutation((async () => {
      await flushAllChapters()
      if (generation !== projectGenerationRef.current || activeProjectIdRef.current !== projectId) {
        throw new Error('Project switched during export')
      }
      await api.downloadMarkdownExport()
    })())
  }

  return {
    project, loading, error, saveState, patchChapter, addChapter, saveSheet, saveFact,
    deleteFact, continuity, runContinuity, acceptProposal, editProposal, rejectProposal,
    applyServerProject: (next, generation) => mergeServerProject(next, generation),
    projectGeneration: () => projectGenerationRef.current,
    trackMutation,
    beginMutation,
    flushChapter,
    applying,
    applySuggestion,
    projects,
    activeProjectId,
    switchProject,
    createProject,
    exportProject,
    createLabCard: async (input) => {
      const generation = beginMutation()
      if (generation === null) throw new Error('Project switch in progress')
      try {
        const saved = await trackMutation(api.createLabCard(input))
        if (!applyIfCurrent(generation, saved)) return saved
        setError(null)
        return saved
      } catch (caught) {
        if (generation === projectGenerationRef.current) {
          setError(caught instanceof Error ? caught.message : 'Failed to create lab card')
        }
        throw caught
      }
    },
    patchLabCard: async (cardId, patch) => {
      const generation = beginMutation()
      if (generation === null) throw new Error('Project switch in progress')
      try {
        const saved = await trackMutation(api.patchLabCard(cardId, patch))
        if (!applyIfCurrent(generation, saved)) return saved
        setError(null)
        return saved
      } catch (caught) {
        if (generation === projectGenerationRef.current) {
          setError(caught instanceof Error ? caught.message : 'Failed to update lab card')
        }
        throw caught
      }
    },
    archiveLabCard: async (cardId) => {
      const generation = beginMutation()
      if (generation === null) throw new Error('Project switch in progress')
      try {
        const saved = await trackMutation(api.archiveLabCard(cardId))
        if (!applyIfCurrent(generation, saved)) return
        setError(null)
      } catch (caught) {
        if (generation === projectGenerationRef.current) {
          setError(caught instanceof Error ? caught.message : 'Failed to archive lab card')
        }
        throw caught
      }
    },
    pinLabCard: async (cardId, pinned = true) => {
      const generation = beginMutation()
      if (generation === null) throw new Error('Project switch in progress')
      try {
        const saved = await trackMutation(api.pinLabCard(cardId, pinned))
        if (!applyIfCurrent(generation, saved)) return
        setError(null)
      } catch (caught) {
        if (generation === projectGenerationRef.current) {
          setError(caught instanceof Error ? caught.message : 'Failed to pin lab card')
        }
        throw caught
      }
    },
    promoteLabCard: async (cardId, input = {}) => {
      const generation = beginMutation()
      if (generation === null) throw new Error('Project switch in progress')
      try {
        const result = await trackMutation(api.promoteLabCard(cardId, input))
        if (generation === projectGenerationRef.current) {
          applyIfCurrent(generation, result.project)
          setError(null)
        }
        return result
      } catch (caught) {
        if (generation === projectGenerationRef.current) {
          setError(caught instanceof Error ? caught.message : 'Failed to promote lab card')
        }
        throw caught
      }
    },
  }
}
