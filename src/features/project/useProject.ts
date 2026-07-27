import { useCallback, useEffect, useRef, useState } from 'react'
import type { Chapter, Fact, Project, Sheet } from '../../domain/types.ts'
import type { ApplyCard } from '../../cowrite/types.ts'
import * as api from './api.ts'

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

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
  continuity: { running: boolean; mode: 'fixture' | 'live' | null; counts: { red: number; yellow: number; proposals: number } | null }
  runContinuity: (chapterId: string) => Promise<api.ContinuityResponse | null>
  acceptProposal: (id: string, edits?: api.ProposalEdits) => Promise<void>
  editProposal: (id: string, edits: api.ProposalEdits) => Promise<void>
  rejectProposal: (id: string) => Promise<void>
  applyServerProject: (project: Project) => void
  flushChapter: (chapterId: string) => Promise<void>
  applying: boolean
  applySuggestion: (card: ApplyCard) => Promise<Project>
}

/** API-backed project state. Chapter writes debounce; structured bible edits save explicitly. */
export function useProject(): ProjectController {
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [continuity, setContinuity] = useState<{ running: boolean; mode: 'fixture' | 'live' | null; counts: { red: number; yellow: number; proposals: number } | null }>({
    running: false,
    mode: null,
    counts: null,
  })
  const projectRef = useRef<Project | null>(null)
  const continuityRunningRef = useRef(false)
  const applyingRef = useRef(false)
  const [applying, setApplying] = useState(false)
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const inFlightSaves = useRef(new Map<string, Promise<void>>())
  const revisions = useRef(new Map<string, number>())
  const savedRevisions = useRef(new Map<string, number>())

  function setCurrent(next: Project): void {
    projectRef.current = next
    setProject(next)
  }

  /** Keep only dirty local chapters; otherwise trust server (avoids stale tabs wiping prose). */
  function mergeServerProject(next: Project): void {
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
      return dirty ? clientChapter : serverChapter
    })
    for (const clientChapter of current.chapters) {
      if (!serverIds.has(clientChapter.id)) chapters.push(clientChapter)
    }
    setCurrent({ ...next, chapters })
  }

  useEffect(() => {
    const controller = new AbortController()
    api
      .loadProject(controller.signal)
      .then((loaded) => {
        setCurrent(loaded)
        revisions.current.clear()
        savedRevisions.current.clear()
        for (const chapter of loaded.chapters) {
          revisions.current.set(chapter.id, 0)
          savedRevisions.current.set(chapter.id, 0)
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
  }, [])

  const persistChapter = useCallback((chapter: Chapter, revision: number): Promise<void> => {
    setSaveState('saving')
    const previous = inFlightSaves.current.get(chapter.id) ?? Promise.resolve()
    const operation = previous.then(async () => {
      try {
        const saved = await api.saveChapter(chapter)
        savedRevisions.current.set(chapter.id, Math.max(savedRevisions.current.get(chapter.id) ?? 0, revision))
        if (revisions.current.get(chapter.id) !== revision) return
        mergeServerProject(saved)
        setSaveState('saved')
        setError(null)
      } catch (caught) {
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

  const patchChapter = useCallback(
    (chapterId: string, patch: Partial<Pick<Chapter, 'title' | 'body' | 'craftTags'>>) => {
      if (applyingRef.current) return
      const current = projectRef.current
      const chapter = current?.chapters.find((candidate) => candidate.id === chapterId)
      if (!current || !chapter) return
      const nextChapter = { ...chapter, ...patch }
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
          void persistChapter(nextChapter, revision).catch(() => undefined)
        }, 500),
      )
    },
    [persistChapter],
  )

  const addChapter = useCallback(() => {
    const current = projectRef.current
    if (!current) return
    const chapter: Chapter = {
      id: `chapter-${Date.now()}`,
      title: `Chapter ${current.chapters.length + 1}`,
      body: '',
      craftTags: [],
    }
    setSaveState('saving')
    void api
      .saveChapter(chapter)
      .then((saved) => {
        setCurrent(saved)
        setSaveState('saved')
        setError(null)
      })
      .catch((caught: unknown) => {
        setSaveState('error')
        setError(caught instanceof Error ? caught.message : 'Failed to add chapter')
      })
  }, [])

  const saveSheet = useCallback(async (sheet: Sheet) => {
    try {
      mergeServerProject(await api.upsertSheet(sheet))
      setError(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to save sheet')
      throw caught
    }
  }, [])

  const saveFact = useCallback(async (sheetId: string, fact: Fact) => {
    try {
      mergeServerProject(await api.upsertFact(sheetId, fact))
      setError(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to save fact')
      throw caught
    }
  }, [])

  const deleteFact = useCallback(async (sheetId: string, factId: string) => {
    try {
      mergeServerProject(await api.removeFact(sheetId, factId))
      setError(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to delete fact')
      throw caught
    }
  }, [])

  const flushChapter = useCallback(async (chapterId: string) => {
    while (true) {
      const timer = timers.current.get(chapterId)
      if (timer) {
        clearTimeout(timer)
        timers.current.delete(chapterId)
        const chapter = projectRef.current?.chapters.find((candidate) => candidate.id === chapterId)
        if (chapter) await persistChapter(chapter, revisions.current.get(chapterId) ?? 0)
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
        await persistChapter(chapter, revision)
        continue
      }
      return
    }
  }, [persistChapter])

  const applySuggestion = useCallback(async (card: ApplyCard): Promise<Project> => {
    if (applyingRef.current) throw new Error('An Apply is already running')
    applyingRef.current = true
    setApplying(true)
    try {
      await flushChapter(card.chapterId)
      const committed = await api.applySuggestion(card.chapterId, card)
      const timer = timers.current.get(card.chapterId)
      if (timer) clearTimeout(timer)
      timers.current.delete(card.chapterId)
      const revision = (revisions.current.get(card.chapterId) ?? 0) + 1
      revisions.current.set(card.chapterId, revision)
      savedRevisions.current.set(card.chapterId, revision)
      setCurrent(committed)
      return committed
    } finally {
      applyingRef.current = false
      setApplying(false)
    }
  }, [flushChapter])

  const runContinuity = useCallback(async (chapterId: string) => {
    if (continuityRunningRef.current) return null
    continuityRunningRef.current = true
    setContinuity((current) => ({ ...current, running: true }))
    try {
      await flushChapter(chapterId)
      const result = await api.runContinuity(chapterId)
      mergeServerProject(result.project)
      setContinuity({ running: false, mode: result.mode, counts: result.counts })
      setError(null)
      return result
    } catch (caught) {
      setContinuity((current) => ({ ...current, running: false }))
      setError(caught instanceof Error ? caught.message : 'Continuity failed')
      throw caught
    } finally {
      continuityRunningRef.current = false
    }
  }, [flushChapter])

  const acceptProposal = useCallback(async (id: string, edits: api.ProposalEdits = {}) => {
    try {
      mergeServerProject(await api.acceptProposal(id, edits))
      setError(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to accept proposal')
      throw caught
    }
  }, [])

  const editProposal = useCallback(async (id: string, edits: api.ProposalEdits) => {
    try {
      mergeServerProject(await api.editProposal(id, edits))
      setError(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to edit proposal')
      throw caught
    }
  }, [])

  const rejectProposal = useCallback(async (id: string) => {
    try {
      mergeServerProject(await api.rejectProposal(id))
      setError(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to reject proposal')
      throw caught
    }
  }, [])

  return {
    project, loading, error, saveState, patchChapter, addChapter, saveSheet, saveFact,
    deleteFact, continuity, runContinuity, acceptProposal, editProposal, rejectProposal,
    applyServerProject: mergeServerProject,
    flushChapter,
    applying,
    applySuggestion,
  }
}
