import { useState } from 'react'
import type { TranscriptEntry } from '../../agent/types.ts'
import type { Project } from '../../domain/types.ts'
import { requestCowrite, requestReview, sendChat } from '../project/api.ts'
import type { ReviewKind } from '../../review/types.ts'
import type { ApplyCard, CowriteRequest } from '../../cowrite/types.ts'

export function useAgent(
  onProject: (project: Project) => void,
  applySuggestion: (card: ApplyCard) => Promise<Project>,
) {
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [sending, setSending] = useState(false)
  const [tipsDismissed, setTipsDismissed] = useState(false)

  async function send(chapterId: string, text: string) {
    if (sending) return
    const id = Date.now()
    setTranscript((current) => [...current, { id: `user-${id}`, role: 'user', text }])
    setSending(true)
    try {
      const result = await sendChat(chapterId, text)
      onProject(result.project)
      setTranscript((current) => [
        ...current,
        { id: `assistant-${id}`, role: 'assistant', text: result.message },
      ])
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Agent request failed'
      setTranscript((current) => [
        ...current,
        { id: `assistant-error-${id}`, role: 'assistant', text: `Could not complete that request: ${message}` },
      ])
    } finally {
      setSending(false)
    }
  }

  async function runReview(chapterId: string, kind: ReviewKind) {
    if (sending) return
    setSending(true)
    try {
      const result = await requestReview(chapterId, kind)
      setTranscript((current) => [
        ...current,
        { id: `review-${kind}-${Date.now()}`, role: 'review', result },
      ])
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Review failed'
      setTranscript((current) => [
        ...current,
        { id: `review-error-${Date.now()}`, role: 'assistant', text: `Could not run review: ${message}` },
      ])
    } finally {
      setSending(false)
    }
  }

  async function generateCowrite(request: CowriteRequest) {
    if (sending) return
    setSending(true)
    try {
      const result = await requestCowrite(request)
      setTranscript((current) => [
        ...current,
        { id: `apply-entry-${result.card.id}`, role: 'apply', card: result.card },
      ])
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Co-write request failed'
      setTranscript((current) => [
        ...current,
        { id: `cowrite-error-${Date.now()}`, role: 'assistant', text: `Could not draft that: ${message}` },
      ])
    } finally {
      setSending(false)
    }
  }

  async function applyCard(cardId: string): Promise<string | null> {
    const entry = transcript.find((candidate) => candidate.role === 'apply' && candidate.card.id === cardId)
    if (!entry || entry.role !== 'apply') return null
    try {
      await applySuggestion(entry.card)
      setTranscript((current) => current.filter((candidate) => candidate.id !== entry.id))
      return entry.card.chapterId
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Apply failed'
      setTranscript((current) => [
        ...current,
        { id: `apply-error-${Date.now()}`, role: 'assistant', text: `Could not apply that draft: ${message}` },
      ])
      return null
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
  ) {
    setTranscript((current) => [
      ...current,
      { id: `continuity-${Date.now()}`, role: 'tool', tool: 'continuity', mode, ...counts },
    ])
  }

  return {
    transcript,
    sending,
    tipsDismissed,
    dismissTips: () => setTipsDismissed(true),
    send,
    generateCowrite,
    runReview,
    applyCard,
    dismissCard,
    addContinuityCard,
  }
}
