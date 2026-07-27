import type { ApplyTarget } from '../domain/apply.ts'

export type CowriteSkill = 'continue' | 'rewrite' | 'brainstorm'

export type CowriteRequest = {
  chapterId: string
  skill: CowriteSkill
  instruction: string
  start: number
  end: number
}

export type ApplyCard = {
  id: string
  chapterId: string
  skill: CowriteSkill
  text: string
  target: ApplyTarget
  expectedBody: string
  expectedText: string
}

export type CowriteResult = {
  mode: 'fixture' | 'live'
  card: ApplyCard
}
