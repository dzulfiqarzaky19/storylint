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
    schemaVersion: 2,
    title: 'Storylint',
    // BD P1: factory seed uses empty title + Manuscript placeholder (not 'Chapter One').
    chapters: [{ id: 'chapter-1', title: '', body: '', craftTags: [], revision: 0 }],
    sheets: [],
    proposals: [],
    rejectedFingerprints: [],
    marks: [],
    researchNotes: [], lab: { boards: [{ id: 'lab-board-bench', title: 'Bench', cardIds: [] }], cards: [] },
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

test('store saves schemaVersion 2 atomically without leaving a temp file', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'storylint-store-'))
  const file = join(dir, 'project.json')
  const store = new ProjectStore(file, seedProject())
  await store.save(seedProject())

  const saved = JSON.parse(await readFile(file, 'utf8')) as Project
  assert.equal(saved.schemaVersion, 2)
  assert.deepEqual(await readdir(dir), ['project.json'])
})

test('switchFile serializes with concurrent updates so writes stay on the intended path', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'storylint-switch-'))
  const first = join(dir, 'first.json')
  const second = join(dir, 'second.json')
  const store = new ProjectStore(first, seedProject())
  await store.save(seedProject())
  await new ProjectStore(second).save({ ...seedProject(), title: 'Second' })

  let releaseUpdate: (() => void) | undefined
  const hold = new Promise<void>((resolve) => { releaseUpdate = resolve })
  const update = store.updateAsync(async (project) => {
    await hold
    return { ...project, title: 'First mutated' }
  })
  const switchPromise = store.switchFile(second)
  await Promise.resolve()
  releaseUpdate?.()
  await Promise.all([update, switchPromise])

  assert.equal(JSON.parse(await readFile(first, 'utf8')).title, 'First mutated')
  assert.equal(JSON.parse(await readFile(second, 'utf8')).title, 'Second')
  assert.equal((await store.load()).title, 'Second')
})

test('two ProjectStore instances on one path serialize load and save without EPERM', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'storylint-path-lock-'))
  const file = join(dir, 'shared.json')
  const seed = seedProject()
  await new ProjectStore(file).save(seed)

  const writers = Array.from({ length: 40 }, (_, index) => new ProjectStore(file))
  const readers = Array.from({ length: 40 }, () => new ProjectStore(file))
  const errors: unknown[] = []
  await Promise.all([
    ...writers.map((store, index) =>
      store.save({ ...seed, title: `w-${index}` }).catch((error: unknown) => errors.push(error)),
    ),
    ...readers.map((store) =>
      store.load().catch((error: unknown) => errors.push(error)),
    ),
  ])
  assert.equal(errors.length, 0, `path lock failed: ${errors.map(String).join(' | ')}`)
  const final = JSON.parse(await readFile(file, 'utf8')) as Project
  assert.match(final.title, /^w-\d+$/)
  assert.deepEqual(await readdir(dir), ['shared.json'])
})

test('GET /api/projects concurrent with chapter PUTs never returns EPERM', async () => {
  await withServer(async (baseUrl) => {
    await requestJson<Project>(`${baseUrl}/api/projects`, {
      method: 'POST',
      body: JSON.stringify({ id: 'race-story', title: 'Race Story' }),
    })
    const chapter = {
      id: 'chapter-race',
      title: 'One',
      body: 'start',
      craftTags: [] as string[],
      revision: 0,
    }
    await requestJson<Project>(`${baseUrl}/api/chapters/${chapter.id}`, {
      method: 'PUT',
      body: JSON.stringify(chapter),
    })

    const errors: string[] = []
    const jobs: Promise<void>[] = []
    for (let index = 0; index < 30; index += 1) {
      jobs.push(
        (async () => {
          const response = await fetch(`${baseUrl}/api/projects`)
          if (!response.ok) errors.push(`list ${response.status} ${await response.text()}`)
        })(),
      )
      jobs.push(
        (async () => {
          const loaded = await requestJson<Project>(`${baseUrl}/api/project`)
          const current = loaded.chapters.find((candidate) => candidate.id === chapter.id) ?? loaded.chapters[0]
          const response = await fetch(`${baseUrl}/api/chapters/${current.id}`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              ...current,
              body: `body-${index}`,
              revision: current.revision,
            }),
          })
          if (!response.ok) {
            const text = await response.text()
            // 409 stale revision is fine under thrash; EPERM is not.
            if (response.status !== 409) errors.push(`put ${response.status} ${text}`)
          }
        })(),
      )
    }
    await Promise.all(jobs)
    assert.equal(errors.some((entry) => /EPERM/i.test(entry)), false, errors.join(' | '))
    assert.equal(errors.length, 0, errors.join(' | '))
  })
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

test('GET and PUT project persist schemaVersion 2', async () => {
  await withServer(async (baseUrl, store) => {
    const loaded = await requestJson<Project>(`${baseUrl}/api/project`)
    assert.equal(loaded.chapters[0].title, '') // BD P1: empty seed title

    const renamed = await requestJson<Project>(`${baseUrl}/api/project`, {
      method: 'PUT',
      body: JSON.stringify({ ...loaded, title: 'Renamed Project' }),
    })
    assert.equal(renamed.title, 'Renamed Project')
    assert.equal((await store.load()).schemaVersion, 2)
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

test('stale chapter PUT and stale sheet metadata cannot overwrite newer content', async () => {
  await withServer(async (baseUrl, store) => {
    const initial = await store.load()
    const chapter = initial.chapters[0]
    const first = await requestJson<Project>(`${baseUrl}/api/chapters/${chapter.id}`, {
      method: 'PUT', body: JSON.stringify({ ...chapter, body: 'new prose' }),
    })
    assert.equal(first.chapters[0].revision, chapter.revision + 1)
    const stale = await fetch(`${baseUrl}/api/chapters/${chapter.id}`, {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...chapter, body: 'stale prose' }),
    })
    assert.equal(stale.status, 409)
    assert.equal((await store.load()).chapters[0].body, 'new prose')

    const sheet: Sheet = {
      id: 'aria', kind: 'character', name: 'Aria', aliases: [], summary: '', notes: '', facts: [],
    }
    await requestJson<Project>(`${baseUrl}/api/sheets/aria`, {
      method: 'PUT', body: JSON.stringify(sheet),
    })
    const fact: Fact = {
      id: 'fact-1', key: 'oath', value: 'guard', statement: 'Aria swore to guard', claimKind: 'attribute',
    }
    await requestJson<Project>(`${baseUrl}/api/sheets/aria/facts/fact-1`, {
      method: 'PUT', body: JSON.stringify(fact),
    })
    const metadata = await requestJson<Project>(`${baseUrl}/api/sheets/aria`, {
      method: 'PUT', body: JSON.stringify({ ...sheet, summary: 'Updated metadata', facts: [] }),
    })
    assert.equal(metadata.sheets[0].facts.length, 1)
    assert.equal(metadata.sheets[0].summary, 'Updated metadata')
  })
})

test('graph edge create/edit stays pending until Accept and preserves fact identity', async () => {
  await withServer(async (baseUrl, store) => {
    const project = seedProject()
    project.sheets = [
      { id: 'aria', kind: 'character', name: 'Aria', aliases: [], summary: '', notes: '', facts: [] },
      { id: 'order', kind: 'organization', name: 'Ember Order', aliases: [], summary: '', notes: '', facts: [] },
    ]
    await store.save(project)
    const pending = await requestJson<Project>(`${baseUrl}/api/graph/proposals`, {
      method: 'POST',
      body: JSON.stringify({
        fromSheetId: 'aria', toSheetId: 'order', key: 'member_of',
        statement: 'Aria is a member of the Ember Order',
      }),
    })
    assert.equal(pending.sheets[0].facts.length, 0)
    const proposal = pending.proposals.find((candidate) => candidate.status === 'pending')
    assert.ok(proposal)
    const accepted = await requestJson<Project>(`${baseUrl}/api/proposals/${proposal.id}/accept`, {
      method: 'POST', body: '{}',
    })
    const fact = accepted.sheets[0].facts[0]
    assert.equal(fact.claimKind, 'relationship')
    assert.equal(fact.toSheetId, 'order')

    const editedPending = await requestJson<Project>(`${baseUrl}/api/graph/proposals`, {
      method: 'POST',
      body: JSON.stringify({
        fromSheetId: 'aria', toSheetId: 'order', key: 'rival',
        statement: 'Aria now rivals the Ember Order', targetFactId: fact.id,
      }),
    })
    assert.equal(editedPending.sheets[0].facts[0].key, 'member_of')
    const edit = editedPending.proposals.find((candidate) =>
      candidate.status === 'pending' && candidate.targetFactId === fact.id)
    assert.ok(edit)
    const updated = await requestJson<Project>(`${baseUrl}/api/proposals/${edit.id}/accept`, {
      method: 'POST', body: '{}',
    })
    assert.equal(updated.sheets[0].facts.length, 1)
    assert.equal(updated.sheets[0].facts[0].id, fact.id)
    assert.equal(updated.sheets[0].facts[0].key, 'rival')
  })
})

test('invalid graph endpoints fail without canon mutation', async () => {
  await withServer(async (baseUrl, store) => {
    const response = await fetch(`${baseUrl}/api/graph/proposals`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        fromSheetId: 'missing', toSheetId: 'also-missing', key: 'rival', statement: 'Missing rivals missing',
      }),
    })
    assert.equal(response.status, 404)
    assert.equal((await store.load()).sheets.flatMap((sheet) => sheet.facts).length, 0)
  })
})

test('markdown ZIP export contains readable chapter and bible paths', async () => {
  await withServer(async (baseUrl, store) => {
    const project = await store.load()
    project.sheets = [{
      id: 'aria', kind: 'character', name: 'Aria', aliases: [], summary: 'A fighter', notes: '',
      facts: [{ id: 'fact-1', key: 'oath', value: 'guard', statement: 'Aria guards', claimKind: 'attribute' }],
    }]
    await store.save(project)
    const response = await fetch(`${baseUrl}/api/export`)
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('content-type'), 'application/zip')
    const bytes = Buffer.from(await response.arrayBuffer())
    assert.equal(bytes.readUInt32LE(0), 0x04034b50)
    const text = bytes.toString('utf8')
    assert.match(text, /chapters\/01-untitled\.md/) // BD P1: empty seed title slugs to untitled
    assert.match(text, /bible\/character\/aria\.md/)
    assert.match(text, /Aria guards/)
  })
})

test('local projects can be created listed and switched with Lab schema v2', async () => {
  await withServer(async (baseUrl) => {
    const created = await requestJson<Project>(`${baseUrl}/api/projects`, {
      method: 'POST', body: JSON.stringify({ id: 'second-story', title: 'Second Story' }),
    })
    assert.equal(created.schemaVersion, 2)
    assert.equal(created.title, 'Second Story')
    assert.equal(created.chapters.length, 0)
    const listed = await requestJson<{ activeProjectId: string; projects: Array<{ id: string; title: string }> }>(
      `${baseUrl}/api/projects`,
    )
    assert.equal(listed.activeProjectId, 'second-story')
    assert.equal(listed.projects.some((project) => project.id === 'default'), true)
    assert.equal(listed.projects.some((project) => project.id === 'second-story'), true)

    const active = await requestJson<Project>(`${baseUrl}/api/projects/default/activate`, {
      method: 'POST', body: '{}',
    })
    assert.equal(active.title, 'Storylint')
  })
})

test('invalid project IDs and duplicate creation are rejected', async () => {
  await withServer(async (baseUrl) => {
    const invalid = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: '../escape', title: 'Escape' }),
    })
    assert.equal(invalid.status, 400)
    await requestJson<Project>(`${baseUrl}/api/projects`, {
      method: 'POST', body: JSON.stringify({ id: 'story-two', title: 'Story Two' }),
    })
    const duplicate = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'story-two', title: 'Duplicate' }),
    })
    assert.equal(duplicate.status, 409)
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

test('lab card create pin archive and promote stay pre-canon until Accept', async () => {
  await withServer(async (baseUrl, store) => {
    const created = await requestJson<Project>(`${baseUrl}/api/lab/cards`, {
      method: 'POST',
      body: JSON.stringify({ kind: 'character-spark', title: 'Riven', body: 'Glass knife' }),
    })
    assert.equal(created.lab.cards.length, 1)
    assert.equal(created.sheets.length, 0)
    const cardId = created.lab.cards[0].id

    const pinned = await requestJson<Project>(`${baseUrl}/api/lab/cards/${cardId}/pin`, {
      method: 'POST', body: JSON.stringify({ pinned: true }),
    })
    assert.equal(pinned.lab.cards[0].status, 'pinned')

    const promoted = await requestJson<{ project: Project; as: string; proposalIds: string[] }>(
      `${baseUrl}/api/lab/cards/${cardId}/promote`,
      { method: 'POST', body: '{}' },
    )
    assert.equal(promoted.as, 'sheet-proposal')
    assert.equal(promoted.project.sheets.length, 0)
    assert.ok(promoted.proposalIds.length >= 1)
    assert.equal(promoted.project.lab.cards[0].status, 'promoted')
    assert.equal((await store.load()).sheets.length, 0)

    const accepted = await requestJson<Project>(
      `${baseUrl}/api/proposals/${promoted.proposalIds[0]}/accept`,
      { method: 'POST', body: '{}' },
    )
    assert.equal(accepted.sheets[0].name, 'Riven')
  })
})

test('lab archive restore returns card to bench without Canon writes', async () => {
  await withServer(async (baseUrl) => {
    const created = await requestJson<Project>(`${baseUrl}/api/lab/cards`, {
      method: 'POST',
      body: JSON.stringify({ kind: 'character-spark', title: 'Restore me', body: 'bench' }),
    })
    const cardId = created.lab.cards[0].id
    const sheetsBefore = created.sheets.length
    const proposalsBefore = created.proposals.length
    const chaptersBefore = created.chapters.length

    const archived = await requestJson<Project>(`${baseUrl}/api/lab/cards/${cardId}/archive`, {
      method: 'POST',
      body: '{}',
    })
    assert.equal(archived.lab.cards.find((card) => card.id === cardId)?.status, 'archived')

    const restored = await requestJson<Project>(`${baseUrl}/api/lab/cards/${cardId}/restore`, {
      method: 'POST',
      body: '{}',
    })
    assert.equal(restored.lab.cards.find((card) => card.id === cardId)?.status, 'active')
    assert.equal(restored.lab.cards.find((card) => card.id === cardId)?.title, 'Restore me')
    assert.equal(restored.sheets.length, sheetsBefore)
    assert.equal(restored.proposals.length, proposalsBefore)
    assert.equal(restored.chapters.length, chaptersBefore)
  })
})

test('lab what-if promote is rejected without mutation', async () => {
  await withServer(async (baseUrl, store) => {
    const created = await requestJson<Project>(`${baseUrl}/api/lab/cards`, {
      method: 'POST',
      body: JSON.stringify({ kind: 'what-if', title: 'Treaty fails' }),
    })
    const cardId = created.lab.cards[0].id
    const response = await fetch(`${baseUrl}/api/lab/cards/${cardId}/promote`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
    })
    assert.equal(response.status, 400)
    assert.equal((await store.load()).proposals.length, 0)
    assert.equal((await store.load()).chapters.length, 1)
  })
})

test('lab source model via API and dismiss promoted leaves Canon/Draft', async () => {
  await withServer(async (baseUrl) => {
    const modelCard = await requestJson<Project>(`${baseUrl}/api/lab/cards`, {
      method: 'POST',
      body: JSON.stringify({ kind: 'character-spark', title: 'Model Riven', body: 'from chat', source: 'model' }),
    })
    assert.equal(modelCard.lab.cards[0].source, 'model')
    const cardId = modelCard.lab.cards[0].id
    const promoted = await requestJson<{ project: Project; as: string; proposalIds: string[] }>(
      `${baseUrl}/api/lab/cards/${cardId}/promote`,
      { method: 'POST', body: '{}' },
    )
    assert.equal(promoted.project.lab.cards[0].status, 'promoted')
    const proposalCount = promoted.project.proposals.length
    assert.ok(proposalCount >= 1)

    const dismissed = await requestJson<Project>(`${baseUrl}/api/lab/cards/${cardId}/dismiss`, {
      method: 'POST',
      body: '{}',
    })
    assert.equal(dismissed.lab.cards.find((card) => card.id === cardId)?.status, 'archived')
    assert.equal(dismissed.proposals.length, proposalCount)

    const beat = await requestJson<Project>(`${baseUrl}/api/lab/cards`, {
      method: 'POST',
      body: JSON.stringify({ kind: 'beat', title: 'Night', source: 'model' }),
    })
    const beatId = beat.lab.cards.find((card) => card.title === 'Night')?.id
    assert.ok(beatId)
    const chap = await requestJson<{ project: Project; as: string; chapterId: string }>(
      `${baseUrl}/api/lab/cards/${beatId}/promote`,
      { method: 'POST', body: JSON.stringify({ chapterTitle: 'Confirmed night' }) },
    )
    assert.equal(chap.as, 'chapter-stub')
    const beforeChapters = chap.project.chapters.length
    const cleared = await requestJson<Project>(`${baseUrl}/api/lab/promoted/dismiss-all`, {
      method: 'POST',
      body: '{}',
    })
    assert.equal(cleared.lab.cards.find((card) => card.id === beatId)?.status, 'archived')
    assert.equal(cleared.chapters.length, beforeChapters)
    assert.equal(cleared.chapters.find((card) => card.id === chap.chapterId)?.title, 'Confirmed night')
  })
})
