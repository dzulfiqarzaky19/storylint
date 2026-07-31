import type { ResearchNote } from '../domain/types.ts'

export type ResearchResultItem = ResearchNote

export type ResearchResult = {
  mode: 'fixture' | 'live'
  query: string
  results: ResearchResultItem[]
}
