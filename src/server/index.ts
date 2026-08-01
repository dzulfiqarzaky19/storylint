import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from './http.ts'
import { ProjectFileRoot } from './store.ts'

const root = resolve(fileURLToPath(new URL('../../', import.meta.url)))
const store = new ProjectFileRoot(resolve(root, 'data/project.json')).openDefault({
  schemaVersion: 2,
  title: 'Storylint',
  chapters: [{ id: 'chapter-1', title: '', body: '', craftTags: [], revision: 0 }],
  sheets: [],
  proposals: [],
  rejectedFingerprints: [],
  marks: [],
  researchNotes: [], lab: { boards: [{ id: 'lab-board-bench', title: 'Bench', cardIds: [] }], cards: [] },
})
const port = Number.parseInt(process.env.STORYLINT_PORT ?? '4174', 10)

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('STORYLINT_PORT must be an integer from 1 to 65535')
}

createServer(store).listen(port, '127.0.0.1', () => {
  console.log(`Storylint API listening at http://127.0.0.1:${port}`)
})
