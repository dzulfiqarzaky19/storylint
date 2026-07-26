import type { Chapter, Fact, Project, Sheet } from './types.ts'

function replaceById<T extends { id: string }>(items: readonly T[], item: T): T[] {
  const index = items.findIndex((candidate) => candidate.id === item.id)
  if (index < 0) return [...items, item]
  return items.map((candidate) => (candidate.id === item.id ? item : candidate))
}

export function patchChapter(
  project: Project,
  chapterId: string,
  patch: Partial<Pick<Chapter, 'title' | 'body'>>,
): Project {
  if (!project.chapters.some((chapter) => chapter.id === chapterId)) {
    throw new Error(`Chapter not found: ${chapterId}`)
  }
  const bodyChanged = patch.body !== undefined
  return {
    ...project,
    chapters: project.chapters.map((chapter) =>
      chapter.id === chapterId ? { ...chapter, ...patch } : chapter,
    ),
    marks: bodyChanged
      ? project.marks.filter((mark) => mark.span.chapterId !== chapterId)
      : project.marks,
  }
}

export function upsertChapter(project: Project, chapter: Chapter): Project {
  const previous = project.chapters.find((candidate) => candidate.id === chapter.id)
  return {
    ...project,
    chapters: replaceById(project.chapters, chapter),
    marks: previous && previous.body !== chapter.body
      ? project.marks.filter((mark) => mark.span.chapterId !== chapter.id)
      : project.marks,
  }
}

export function upsertSheet(project: Project, sheet: Sheet): Project {
  return { ...project, sheets: replaceById(project.sheets, sheet) }
}

export function upsertFact(project: Project, sheetId: string, fact: Fact): Project {
  if (!project.sheets.some((sheet) => sheet.id === sheetId)) {
    throw new Error(`Sheet not found: ${sheetId}`)
  }
  return {
    ...project,
    sheets: project.sheets.map((sheet) => {
      if (sheet.id !== sheetId) return sheet
      const sameKey = sheet.facts.find((candidate) =>
        candidate.key.toLocaleLowerCase('en-US') === fact.key.toLocaleLowerCase('en-US'),
      )
      return {
        ...sheet,
        facts: sameKey
          ? sheet.facts.map((candidate) => candidate.id === sameKey.id ? { ...fact, id: sameKey.id } : candidate)
          : replaceById(sheet.facts, fact),
      }
    }),
  }
}

export function deleteFact(project: Project, sheetId: string, factId: string): Project {
  const sheet = project.sheets.find((candidate) => candidate.id === sheetId)
  if (!sheet) throw new Error(`Sheet not found: ${sheetId}`)
  if (!sheet.facts.some((fact) => fact.id === factId)) {
    throw new Error(`Fact not found: ${factId}`)
  }
  return {
    ...project,
    sheets: project.sheets.map((candidate) =>
      candidate.id === sheetId
        ? { ...candidate, facts: candidate.facts.filter((fact) => fact.id !== factId) }
        : candidate,
    ),
  }
}
