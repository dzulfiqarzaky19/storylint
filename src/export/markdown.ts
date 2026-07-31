import type { Project } from '../domain/types.ts'

export type MarkdownFile = { path: string; content: string }

function slug(value: string): string {
  return value
    .normalize('NFKD')
    .toLocaleLowerCase('en-US')
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-+|-+$/g, '') || 'untitled'
}

export function projectMarkdownFiles(project: Project): MarkdownFile[] {
  const files: MarkdownFile[] = [{
    path: 'README.md',
    content: `# ${project.title}\n\nExported from Storylint schema v${project.schemaVersion}.\n`,
  }]
  project.chapters.forEach((chapter, index) => {
    const number = String(index + 1).padStart(2, '0')
    const tags = chapter.craftTags.length > 0 ? `\nTags: ${chapter.craftTags.join(', ')}\n` : ''
    files.push({
      path: `chapters/${number}-${slug(chapter.title)}.md`,
      content: `# ${chapter.title}\n${tags}\n${chapter.body}\n`,
    })
  })
  for (const sheet of project.sheets) {
    const aliases = sheet.aliases.length > 0 ? `\nAliases: ${sheet.aliases.join(', ')}\n` : ''
    const portrait = sheet.portrait ? `\nPortrait/icon: ${sheet.portrait}\n` : ''
    const facts = sheet.facts.length === 0
      ? '_No facts._'
      : sheet.facts.map((fact) =>
          `- **${fact.key}**: ${fact.value}\n  - ${fact.statement}`,
        ).join('\n')
    files.push({
      path: `bible/${sheet.kind}/${slug(sheet.name)}.md`,
      content: `# ${sheet.name}\n\nKind: ${sheet.kind}${aliases}${portrait}\n${sheet.summary}\n\n## Facts\n\n${facts}\n\n## Notes\n\n${sheet.notes}\n`,
    })
  }
  return files
}
