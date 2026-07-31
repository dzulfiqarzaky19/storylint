import { useCallback, useRef, useState } from 'react'
import type { TranscriptEntry } from '../../agent/types.ts'
import type { Project } from '../../domain/types.ts'
import { requestCowrite, requestReview, sendChat } from '../project/api.ts'
import type { ReviewKind } from '../../review/types.ts'
import type { ApplyCard, CowriteRequest } from '../../cowrite/types.ts'

export function useAgent(
  onProject: (project: Project, generation?: number) => void,
  applySuggestion: (card: ApplyCard) => Promise<Project>,
  projectGeneration: () => number,
  trackMutation: <T>(operation: Promise<T>) => Promise<T>,
  beginMutation: () => number | null,
) {
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [sending, setSending] = useState(false)
  const [tipsDismissed, setTipsDismissed] = useState(false)
  const [llmMode, setLlmMode] = useState<'fixture' | 'live' | null>(null)
  const sessionRef = useRef(0)

  async function send(chapterId: string, text: string, prepare?: () => Promise<void>) {
    if (sending) {
      setTranscript((current) => [
        ...current,
        { id: `assistant-busy-${Date.now()}`, role: 'assistant', text: 'Still working on the previous request…' },
      ])
      return
    }
    const generation = beginMutation()
    if (generation === null) {
      setTranscript((current) => [
        ...current,
        {
          id: `assistant-lock-${Date.now()}`,
          role: 'assistant',
          text: 'Could not send — project is switching or locked. Wait a moment and try again.',
        },
      ])
      return
    }
    const session = sessionRef.current
    const id = Date.now()
    setTranscript((current) => [...current, { id: `user-${id}`, role: 'user', text }])
    setSending(true)
    try {
      const result = await trackMutation((async () => {
        if (prepare) await prepare()
        if (session !== sessionRef.current || generation !== projectGeneration()) {
          throw new Error('Project switched during agent request')
        }
        return sendChat(chapterId, text)
      })())
      if (session !== sessionRef.current || generation !== projectGeneration()) return
      onProject(result.project, generation)
      setLlmMode(result.mode)
      setTranscript((current) => [
        ...current,
        { id: `assistant-${id}`, role: 'assistant', text: result.message },
      ])
    } catch (caught) {
      if (session !== sessionRef.current || generation !== projectGeneration()) return
      const message = caught instanceof Error ? caught.message : 'Agent request failed'
      setTranscript((current) => [
        ...current,
        { id: `assistant-error-${id}`, role: 'assistant', text: `Could not complete that request: ${message}` },
      ])
    } finally {
      if (session === sessionRef.current && generation === projectGeneration()) setSending(false)
    }
  }

  async function runReview(chapterId: string, kind: ReviewKind, prepare?: () => Promise<void>) {
    if (sending) return
    const generation = beginMutation()
    if (generation === null) return
    const session = sessionRef.current
    setSending(true)
    try {
      const result = await trackMutation((async () => {
        if (prepare) await prepare()
        if (session !== sessionRef.current || generation !== projectGeneration()) {
          throw new Error('Project switched during review')
        }
        return requestReview(chapterId, kind)
      })())
      if (session !== sessionRef.current || generation !== projectGeneration()) return
      setTranscript((current) => [
        ...current,
        { id: `review-${kind}-${Date.now()}`, role: 'review', result },
      ])
    } catch (caught) {
      if (session !== sessionRef.current || generation !== projectGeneration()) return
      const message = caught instanceof Error ? caught.message : 'Review failed'
      setTranscript((current) => [
        ...current,
        { id: `review-error-${Date.now()}`, role: 'assistant', text: `Could not run review: ${message}` },
      ])
    } finally {
      if (session === sessionRef.current && generation === projectGeneration()) setSending(false)
    }
  }

  async function generateCowrite(request: CowriteRequest, prepare?: () => Promise<void>) {
    if (sending) return
    const generation = beginMutation()
    if (generation === null) return
    const session = sessionRef.current
    setSending(true)
    try {
      const result = await trackMutation((async () => {
        if (prepare) await prepare()
        if (session !== sessionRef.current || generation !== projectGeneration()) {
          throw new Error('Project switched during co-write')
        }
        return requestCowrite(request)
      })())
      if (session !== sessionRef.current || generation !== projectGeneration()) return
      setTranscript((current) => [
        ...current,
        { id: `apply-entry-${result.card.id}`, role: 'apply', card: result.card },
      ])
    } catch (caught) {
      if (session !== sessionRef.current || generation !== projectGeneration()) return
      const message = caught instanceof Error ? caught.message : 'Co-write request failed'
      setTranscript((current) => [
        ...current,
        { id: `cowrite-error-${Date.now()}`, role: 'assistant', text: `Could not draft that: ${message}` },
      ])
    } finally {
      if (session === sessionRef.current && generation === projectGeneration()) setSending(false)
    }
  }

  async function applyCard(cardId: string): Promise<string | null> {
    const entry = transcript.find((candidate) => candidate.role === 'apply' && candidate.card.id === cardId)
    if (!entry || entry.role !== 'apply') return null
    if (beginMutation() === null) return null
    const session = sessionRef.current
    const generation = projectGeneration()
    try {
      await applySuggestion(entry.card)
      if (session !== sessionRef.current || generation !== projectGeneration()) return null
      setTranscript((current) => current.filter((candidate) => candidate.id !== entry.id))
      return entry.card.chapterId
    } catch (caught) {
      if (session !== sessionRef.current || generation !== projectGeneration()) throw caught
      const message = caught instanceof Error ? caught.message : 'Apply failed'
      setTranscript((current) => [
        ...current,
        { id: `apply-error-${Date.now()}`, role: 'assistant', text: `Could not apply that draft: ${message}` },
      ])
      throw caught
    }
  }

  function dismissCard(cardId: string) {
    setTranscript((current) => current.filter((entry) =>
      entry.role !== 'apply' || entry.card.id !== cardId,
    ))
  }

  function addContinuityCard(
    mode: 'fixture' | 'live',
    counts: { red: number; yellow: number; proposals: number },
    session = sessionRef.current,
  ) {
    if (session !== sessionRef.current) return
    setTranscript((current) => [
      ...current,
      { id: `continuity-${Date.now()}`, role: 'tool', tool: 'continuity', mode, ...counts },
    ])
  }

  const reset = useCallback(() => {
    sessionRef.current += 1
    setTranscript([])
    setSending(false)
    setLlmMode(null)
  }, [])

  return {
    transcript,
    sending,
    llmMode,
    tipsDismissed,
    dismissTips: () => setTipsDismissed(true),
    send,
    generateCowrite,
    runReview,
    applyCard,
    dismissCard,
    addContinuityCard,
    session: () => sessionRef.current,
    reset,
  }
}
