import { useCallback, useEffect, useRef, useState } from 'react'
import type { Chapter, Fact, Project, Sheet } from '../../domain/types.ts'
import * as api from './api.ts'

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export type ProjectController = {
  project: Project | null
  loading: boolean
  error: string | null
  saveState: SaveState
  patchChapter: (chapterId: string, patch: Partial<Pick<Chapter, 'title' | 'body'>>) => void
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
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const revisions = useRef(new Map<string, number>())

  function setCurrent(next: Project): void {
    projectRef.current = next
    setProject(next)
  }

  function mergeServerProject(next: Project): void {
    const current = projectRef.current
    setCurrent(current ? { ...next, chapters: current.chapters } : next)
  }

  useEffect(() => {
    const controller = new AbortController()
    api
      .loadProject(controller.signal)
      .then((loaded) => {
        setCurrent(loaded)
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

  const persistChapter = useCallback(async (chapter: Chapter, revision: number) => {
    setSaveState('saving')
    try {
      const saved = await api.saveChapter(chapter)
      if (revisions.current.get(chapter.id) !== revision) return
      mergeServerProject(saved)
      setSaveState('saved')
      setError(null)
    } catch (caught) {
      setSaveState('error')
      setError(caught instanceof Error ? caught.message : 'Failed to save chapter')
    }
  }, [])

  const patchChapter = useCallback(
    (chapterId: string, patch: Partial<Pick<Chapter, 'title' | 'body'>>) => {
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
          void persistChapter(nextChapter, revision)
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
    const pending = timers.current.get(chapterId)
    if (!pending) return
    clearTimeout(pending)
    timers.current.delete(chapterId)
    const chapter = projectRef.current?.chapters.find((candidate) => candidate.id === chapterId)
    if (chapter) await persistChapter(chapter, revisions.current.get(chapterId) ?? 0)
  }, [persistChapter])

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
  }
}
