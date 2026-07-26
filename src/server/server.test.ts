import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import type { Fact, Project, Proposal, Sheet } from '../domain/types.ts'
import { createServer } from './http.ts'
import { ProjectStore } from './store.ts'

function seedProject(): Project {
  return {
    schemaVersion: 1,
    title: 'Storylint',
    chapters: [{ id: 'chapter-1', title: 'Chapter One', body: '' }],
    sheets: [],
    proposals: [],
    rejectedFingerprints: [],
    marks: [],
  }
}

async function withServer(
  run: (baseUrl: string, store: ProjectStore) => Promise<void>,
): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), 'storylint-'))
  const file = join(dir, 'project.json')
  const store = new ProjectStore(file, seedProject())
  await store.save(seedProject())
  const server = createServer(store)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  try {
    await run(`http://127.0.0.1:${address.port}`, store)
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    )
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  })
  if (!response.ok) {
    assert.fail(`${response.status}: ${await response.text()}`)
  }
  return response.json() as Promise<T>
}

test('store saves schemaVersion 1 atomically without leaving a temp file', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'storylint-store-'))
  const file = join(dir, 'project.json')
  const store = new ProjectStore(file, seedProject())
  await store.save(seedProject())

  const saved = JSON.parse(await readFile(file, 'utf8')) as Project
  assert.equal(saved.schemaVersion, 1)
  assert.deepEqual(await readdir(dir), ['project.json'])
})

test('failed async update leaves the saved project unchanged', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'storylint-failed-update-'))
  const store = new ProjectStore(join(dir, 'project.json'), seedProject())
  await store.save(seedProject())
  await assert.rejects(
    store.updateAsync(async () => { throw new Error('extract failed') }),
    /extract failed/,
  )
  assert.deepEqual(await store.load(), seedProject())
})

test('GET and PUT project persist schemaVersion 1', async () => {
  await withServer(async (baseUrl, store) => {
    const loaded = await requestJson<Project>(`${baseUrl}/api/project`)
    assert.equal(loaded.chapters[0].title, 'Chapter One')

    const renamed = await requestJson<Project>(`${baseUrl}/api/project`, {
      method: 'PUT',
      body: JSON.stringify({ ...loaded, title: 'Renamed Project' }),
    })
    assert.equal(renamed.title, 'Renamed Project')
    assert.equal((await store.load()).schemaVersion, 1)
  })
})

test('PATCH chapter persists', async () => {
  await withServer(async (baseUrl, store) => {
    const patched = await requestJson<Project>(`${baseUrl}/api/chapters/chapter-1`, {
      method: 'PATCH',
      body: JSON.stringify({ title: 'Opening', body: 'Aria looked up.' }),
    })
    assert.equal(patched.chapters[0].body, 'Aria looked up.')
    assert.equal((await store.load()).chapters[0].title, 'Opening')
  })
})

test('sheet upsert and manual fact CRUD persist', async () => {
  await withServer(async (baseUrl, store) => {
    const sheet: Sheet = {
      id: 'aria',
      kind: 'character',
      name: 'Aria',
      aliases: [],
      summary: '',
      notes: '',
      facts: [],
    }
    await requestJson<Project>(`${baseUrl}/api/sheets/aria`, {
      method: 'PUT',
      body: JSON.stringify(sheet),
    })

    const fact: Fact = {
      id: 'eye-color',
      key: 'eye_color',
      value: 'amber',
      statement: 'eye color: amber',
      claimKind: 'attribute',
    }
    await requestJson<Project>(`${baseUrl}/api/sheets/aria/facts/eye-color`, {
      method: 'PUT',
      body: JSON.stringify(fact),
    })
    assert.equal((await store.load()).sheets[0].facts[0].value, 'amber')

    await requestJson<Project>(`${baseUrl}/api/sheets/aria/facts/eye-color`, {
      method: 'DELETE',
    })
    assert.equal((await store.load()).sheets[0].facts.length, 0)
  })
})

test('proposal accept writes canon; reject never does', async () => {
  await withServer(async (baseUrl, store) => {
    const proposal = {
      id: 'proposal-kael',
      fingerprint: 'claim-kael',
      status: 'pending',
      entityName: 'Kael',
      sheetKind: 'character',
      key: 'wields',
      value: 'sword',
      statement: 'Kael wields a sword',
      claimKind: 'attribute',
      confidence: 0.9,
      source: { chapterId: 'chapter-1', start: 0, end: 4, text: 'Kael' },
    } satisfies Proposal
    await store.save({ ...seedProject(), proposals: [proposal] })

    const accepted = await requestJson<Project>(`${baseUrl}/api/proposals/proposal-kael/accept`, {
      method: 'POST',
      body: JSON.stringify({ value: 'sabre', statement: 'Kael wields a sabre' }),
    })
    assert.equal(accepted.sheets[0].facts[0].value, 'sabre')
    assert.equal(accepted.proposals[0].statement, 'Kael wields a sabre')

    const rejectProposal = { ...proposal, id: 'proposal-nox', fingerprint: 'claim-nox', entityName: 'Nox' }
    await store.save({ ...seedProject(), proposals: [rejectProposal] })
    const rejected = await requestJson<Project>(`${baseUrl}/api/proposals/proposal-nox/reject`, {
      method: 'POST',
      body: '{}',
    })
    assert.equal(rejected.sheets.length, 0)
    assert.equal(rejected.proposals[0].status, 'rejected')
  })
})

test('continuity fixture route persists marks and pending proposals', async () => {
  await withServer(async (baseUrl, store) => {
    const fixture = seedProject()
    fixture.chapters[0].body = 'Aria looked up, her blue eyes wide. Kael drew his sword beside her.'
    fixture.sheets = [{
      id: 'aria', kind: 'character', name: 'Aria', aliases: [], summary: '', notes: '',
      facts: [{ id: 'eye', key: 'eye_color', value: 'amber', statement: 'eye color: amber', claimKind: 'attribute' }],
    }]
    await store.save(fixture)
    const result = await requestJson<{ project: Project; mode: string }>(`${baseUrl}/api/continuity/chapter-1`, {
      method: 'POST', body: '{}',
    })
    assert.equal(result.mode, 'fixture')
    assert.equal(result.project.marks[0].severity, 'red')
    assert.equal(result.project.proposals.some((proposal) => proposal.entityName === 'Kael'), true)
    assert.equal((await store.load()).marks.length, 1)
  })
})

test('proposal edit updates pending content without writing canon', async () => {
  await withServer(async (baseUrl, store) => {
    const proposal = {
      id: 'proposal-kael', fingerprint: 'claim-kael', status: 'pending', entityName: 'Kael',
      sheetKind: 'character', key: 'wields', value: 'sword', statement: 'Kael wields a sword',
      claimKind: 'attribute', confidence: 0.9,
      source: { chapterId: 'chapter-1', start: 0, end: 4, text: 'Kael' },
    } satisfies Proposal
    await store.save({ ...seedProject(), proposals: [proposal] })
    const edited = await requestJson<Project>(`${baseUrl}/api/proposals/proposal-kael`, {
      method: 'PATCH', body: JSON.stringify({ value: 'sabre', statement: 'Kael wields a sabre' }),
    })
    assert.equal(edited.proposals[0].value, 'sabre')
    assert.equal(edited.sheets.length, 0)
  })
})

test('fixture chat creates proposal pack without writing canon', async () => {
  await withServer(async (baseUrl, store) => {
    const result = await requestJson<{ message: string; project: Project }>(`${baseUrl}/api/chat`, {
      method: 'POST',
      body: JSON.stringify({ chapterId: 'chapter-1', message: 'Draft a character sheet for Kael' }),
    })
    assert.match(result.message, /proposal/i)
    assert.ok(result.project.proposals.length >= 2)
    assert.equal(result.project.sheets.length, 0)
    assert.equal((await store.load()).sheets.length, 0)
  })
})

test('continuity after chat preserves one copy of each sheet-pack proposal', async () => {
  await withServer(async (baseUrl) => {
    const chat = await requestJson<{ project: Project }>(`${baseUrl}/api/chat`, {
      method: 'POST', body: JSON.stringify({ chapterId: 'chapter-1', message: 'Draft a character sheet for Kael' }),
    })
    const packIds = chat.project.proposals.map((proposal) => proposal.id)
    const continuity = await requestJson<{ project: Project }>(`${baseUrl}/api/continuity/chapter-1`, {
      method: 'POST', body: '{}',
    })
    for (const id of packIds) {
      assert.equal(continuity.project.proposals.filter((proposal) => proposal.id === id).length, 1)
    }
  })
})

test('invalid input returns 400 and does not modify the project', async () => {
  await withServer(async (baseUrl, store) => {
    const response = await fetch(`${baseUrl}/api/chapters/chapter-1`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body: 42 }),
    })
    assert.equal(response.status, 400)
    assert.equal((await store.load()).chapters[0].body, '')
  })
})
