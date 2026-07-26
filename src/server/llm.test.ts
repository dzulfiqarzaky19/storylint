import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { test } from 'node:test'
import { completeJson } from './llm.ts'

async function withMock(
  body: string,
  run: (baseUrl: string) => Promise<void>,
  status = 200,
): Promise<void> {
  const server = createServer((_request, response) => {
    response.writeHead(status, { 'content-type': 'application/json' })
    response.end(body)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  try {
    await run(`http://127.0.0.1:${address.port}/v1`)
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    )
  }
}

const config = (baseUrl: string) => ({
  provider: 'test',
  model: 'router-model',
  baseUrl,
  apiKey: 'router-key',
  maxTokens: 20000,
  fixture: false,
})

test('neutral adapter calls OpenAI-compatible chat completions', async () => {
  let requestBody = ''
  let authorization: string | undefined
  const server = createServer((request, response) => {
    authorization = request.headers.authorization
    request.on('data', (chunk: Buffer) => {
      requestBody += chunk.toString('utf8')
    })
    request.on('end', () => {
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ choices: [{ message: { content: '```json\n{"ok":true}\n```' } }] }))
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  try {
    const result = await completeJson(config(`http://127.0.0.1:${address.port}/v1`), 'system', 'user')
    assert.deepEqual(result, { ok: true })
    assert.equal(authorization, 'Bearer router-key')
    const body = JSON.parse(requestBody) as { model: string; max_tokens: number }
    assert.equal(body.model, 'router-model')
    assert.equal(body.max_tokens, 20000)
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    )
  }
})

test('accepts model content with trailing prose after the JSON object', async () => {
  await withMock(
    JSON.stringify({
      choices: [{ message: { content: '{"message":"hi","sheetPack":null}\nHope that helps!' } }],
    }),
    async (baseUrl) => {
      const result = await completeJson(config(baseUrl), 'system', 'user')
      assert.deepEqual(result, { message: 'hi', sheetPack: null })
    },
  )
})

test('accepts HTTP body with a second JSON object trailer', async () => {
  const envelope = JSON.stringify({
    choices: [{ message: { content: '{"message":"ok","sheetPack":null}' } }],
  })
  await withMock(`${envelope}\n{"usage":1}`, async (baseUrl) => {
    const result = await completeJson(config(baseUrl), 'system', 'user')
    assert.deepEqual(result, { message: 'ok', sheetPack: null })
  })
})

test('accepts nested braces inside string values', async () => {
  await withMock(
    JSON.stringify({
      choices: [{ message: { content: '{"message":"use {braces} carefully","sheetPack":null}' } }],
    }),
    async (baseUrl) => {
      const result = await completeJson(config(baseUrl), 'system', 'user')
      assert.deepEqual(result, { message: 'use {braces} carefully', sheetPack: null })
    },
  )
})
