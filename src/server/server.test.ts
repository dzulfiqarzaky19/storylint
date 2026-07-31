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
    chapters: [{ id: 'chapter-1', title: 'Chapter One', body: '', craftTags: [] }],
    sheets: [],
    proposals: [],
    rejectedFingerprints: [],
    marks: [],
    researchNotes: [],
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

test('co-write generation returns an Apply card without changing manuscript or bible', async () => {
  await withServer(async (baseUrl, store) => {
    const before = await store.load()
    const result = await requestJson<{ card: { text: string; target: { mode: string } } }>(`${baseUrl}/api/cowrite`, {
      method: 'POST',
      body: JSON.stringify({
        chapterId: 'chapter-1', skill: 'continue', instruction: 'Continue', start: 0, end: 0,
      }),
    })
    assert.equal(result.card.target.mode, 'insert')
    assert.ok(result.card.text.length > 0)
    assert.deepEqual(await store.load(), before)
  })
})

test('manuscript changes only after explicit Apply insert/replace', async () => {
  await withServer(async (baseUrl, store) => {
    const before = await store.load()
    const inserted = await requestJson<Project>(`${baseUrl}/api/chapters/chapter-1/apply`, {
      method: 'POST',
      body: JSON.stringify({
        text: 'New opening. ', target: { mode: 'insert', start: 0, end: 0 },
        expectedBody: before.chapters[0].body, expectedText: '',
      }),
    })
    assert.equal(inserted.chapters[0].body.startsWith('New opening. '), true)
    assert.deepEqual(inserted.sheets, before.sheets)

    const replaced = await requestJson<Project>(`${baseUrl}/api/chapters/chapter-1/apply`, {
      method: 'POST',
      body: JSON.stringify({
        text: 'Replaced', target: { mode: 'replace', start: 0, end: 12 },
        expectedBody: inserted.chapters[0].body,
        expectedText: inserted.chapters[0].body.slice(0, 12),
      }),
    })
    assert.equal(replaced.chapters[0].body.startsWith('Replaced'), true)
    assert.deepEqual(replaced.sheets, before.sheets)
  })
})

test('Apply rejects stale manuscript cards without writing', async () => {
  await withServer(async (baseUrl, store) => {
    const response = await fetch(`${baseUrl}/api/chapters/chapter-1/apply`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        text: 'x', target: { mode: 'insert', start: 0, end: 0 },
        expectedBody: 'stale body', expectedText: '',
      }),
    })
    assert.equal(response.status, 409)
    assert.equal((await store.load()).chapters[0].body, '')
  })
})

test('portrait and manual craft tags persist through existing project APIs', async () => {
  await withServer(async (baseUrl, store) => {
    const sheet: Sheet = {
      id: 'aria', kind: 'character', name: 'Aria', aliases: [], summary: '', notes: '',
      portrait: '🗡️', facts: [],
    }
    await requestJson<Project>(`${baseUrl}/api/sheets/aria`, {
      method: 'PUT', body: JSON.stringify(sheet),
    })
    const tagged = await requestJson<Project>(`${baseUrl}/api/chapters/chapter-1`, {
      method: 'PATCH', body: JSON.stringify({ craftTags: ['char-dev', 'setup'] }),
    })
    assert.equal(tagged.sheets[0].portrait, '🗡️')
    assert.deepEqual(tagged.chapters[0].craftTags, ['char-dev', 'setup'])
    assert.deepEqual((await store.load()).chapters[0].craftTags, ['char-dev', 'setup'])
  })
})

test('invalid craft tags fail without modifying project', async () => {
  await withServer(async (baseUrl, store) => {
    const response = await fetch(`${baseUrl}/api/chapters/chapter-1`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ craftTags: ['ai-slop-score'] }),
    })
    assert.equal(response.status, 400)
    assert.deepEqual((await store.load()).chapters[0].craftTags, [])
  })
})

test('review and craft-check routes return neutral findings without project writes', async () => {
  await withServer(async (baseUrl, store) => {
    const before = await store.load()
    const review = await requestJson<{ findings: Array<{ lens: string }>; suggestedTags: string[] }>(
      `${baseUrl}/api/review/chapter-1`,
      { method: 'POST', body: JSON.stringify({ kind: 'review' }) },
    )
    const craft = await requestJson<{ findings: Array<{ lens: string }> }>(
      `${baseUrl}/api/review/chapter-1`,
      { method: 'POST', body: JSON.stringify({ kind: 'craft' }) },
    )
    assert.ok(review.findings.some((finding) => finding.lens === 'plot'))
    assert.equal(craft.findings.every((finding) => finding.lens === 'craft'), true)
    assert.deepEqual(await store.load(), before)
  })
})

test('research query is read-only; pin persists note; propose persists pending lore only', async () => {
  await withServer(async (baseUrl, store) => {
    const before = await store.load()
    const research = await requestJson<{ results: Array<{ id: string; title: string; summary: string; sources: Array<{ title: string; url: string }> }> }>(
      `${baseUrl}/api/research`,
      { method: 'POST', body: JSON.stringify({ query: 'archive customs' }) },
    )
    assert.deepEqual(await store.load(), before)
    const result = research.results[0]
    const pinned = await requestJson<Project>(`${baseUrl}/api/research/pin`, {
      method: 'POST', body: JSON.stringify(result),
    })
    assert.equal(pinned.researchNotes.length, 1)
    assert.equal(pinned.sheets.length, 0)

    const proposed = await requestJson<Project>(`${baseUrl}/api/research/propose`, {
      method: 'POST', body: JSON.stringify(result),
    })
    assert.equal(proposed.proposals.some((proposal) =>
      proposal.status === 'pending' && proposal.sheetKind === 'lore'), true)
    assert.equal(proposed.sheets.length, 0)
  })
})

test('uncited research notes cannot be pinned or proposed', async () => {
  await withServer(async (baseUrl, store) => {
    const response = await fetch(`${baseUrl}/api/research/pin`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'uncited', title: 'Uncited', summary: 'No source', sources: [] }),
    })
    assert.equal(response.status, 400)
    assert.equal((await store.load()).researchNotes.length, 0)
  })
})

test('research persistence rejects unsafe citations and colliding note IDs', async () => {
  await withServer(async (baseUrl, store) => {
    const unsafe = await fetch(`${baseUrl}/api/research/pin`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: 'note-1', title: 'Unsafe', summary: 'Unsafe source',
        sources: [{ title: 'Bad', url: 'javascript:alert(1)' }],
      }),
    })
    assert.equal(unsafe.status, 400)

    const first = {
      id: 'note-1', title: 'First', summary: 'First note',
      sources: [{ title: 'Safe', url: 'https://example.invalid/one' }],
    }
    await requestJson<Project>(`${baseUrl}/api/research/pin`, {
      method: 'POST', body: JSON.stringify(first),
    })
    const collision = await fetch(`${baseUrl}/api/research/pin`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...first, title: 'Overwrite' }),
    })
    assert.equal(collision.status, 409)
    assert.equal((await store.load()).researchNotes[0].title, 'First')
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
