import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from './http.ts'
import { ProjectStore } from './store.ts'

const root = resolve(fileURLToPath(new URL('../../', import.meta.url)))
const store = new ProjectStore(resolve(root, 'data/project.json'), {
  schemaVersion: 1,
  title: 'Storylint',
  chapters: [{ id: 'chapter-1', title: 'Chapter One', body: '' }],
  sheets: [],
  proposals: [],
  rejectedFingerprints: [],
  marks: [],
})
const port = Number.parseInt(process.env.STORYLINT_PORT ?? '4174', 10)

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('STORYLINT_PORT must be an integer from 1 to 65535')
}

createServer(store).listen(port, '127.0.0.1', () => {
  console.log(`Storylint API listening at http://127.0.0.1:${port}`)
})
