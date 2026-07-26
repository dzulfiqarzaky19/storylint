import { useState } from 'react'
import type { TranscriptEntry } from '../../agent/types.ts'
import type { Project } from '../../domain/types.ts'
import { sendChat } from '../project/api.ts'

export function useAgent(onProject: (project: Project) => void) {
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
    addContinuityCard,
  }
}
