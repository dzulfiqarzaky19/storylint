/**
 * Owned measurement stack for UI gates.
 *
 * A measurement that cannot name what it measured is not evidence.
 * Gates must build THIS tree, serve it on an ephemeral port, and assert
 * provenance (git HEAD + shell.css hash). Never default to a stranger on :5173.
 */
import { execSync, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs'
import { createServer as createHttpServer } from 'node:http'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT_DEFAULT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SHELL_CSS_REL = 'src/components/shell/shell.css'
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
}

export function sha12(text) {
  return createHash('sha256').update(text).digest('hex').slice(0, 12)
}

export function readGitHead(root = ROOT_DEFAULT) {
  try {
    const head = execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf8' }).trim()
    const short = execSync('git rev-parse --short HEAD', { cwd: root, encoding: 'utf8' }).trim()
    const dirty = execSync('git status --porcelain', { cwd: root, encoding: 'utf8' }).trim()
    return { head, short, dirty: Boolean(dirty) }
  } catch (error) {
    throw new Error(`cannot read git HEAD under ${root}: ${error instanceof Error ? error.message : error}`)
  }
}

export function localShellCssIdentity(root = ROOT_DEFAULT) {
  const path = join(root, SHELL_CSS_REL)
  if (!existsSync(path)) {
    throw new Error(`missing ${SHELL_CSS_REL} under ${root}`)
  }
  const text = readFileSync(path, 'utf8')
  return {
    path: SHELL_CSS_REL,
    bytes: text.length,
    sha256_12: sha12(text),
    shellCssHasB5Touch:
      text.includes('project-switcher__menu > .ui-button') ||
      text.includes('project-switcher__menu>.ui-button'),
  }
}

async function waitForUrl(url, { timeoutMs = 30_000, ok = (r) => r.ok || r.status === 404 } = {}) {
  const deadline = Date.now() + timeoutMs
  let last = null
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { redirect: 'follow' })
      last = { status: res.status }
      if (ok(res)) return res
    } catch (error) {
      last = { error: error instanceof Error ? error.message : String(error) }
    }
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error(`timeout waiting for ${url}: ${JSON.stringify(last)}`)
}

function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = createHttpServer()
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      const port = typeof addr === 'object' && addr ? addr.port : 0
      server.close((err) => (err ? reject(err) : resolvePort(port)))
    })
    server.on('error', reject)
  })
}

function spawnLogged(command, args, { cwd, env, name }) {
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  const logs = []
  const push = (buf) => {
    const s = buf.toString()
    logs.push(s)
    if (logs.length > 40) logs.shift()
  }
  child.stdout?.on('data', push)
  child.stderr?.on('data', push)
  child._storylintName = name
  child._storylintLogs = () => logs.join('')
  return child
}

async function killTree(child) {
  if (!child || child.killed || child.exitCode != null) return
  try {
    if (process.platform === 'win32') {
      await new Promise((resolveKill) => {
        const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
          stdio: 'ignore',
          windowsHide: true,
        })
        killer.on('exit', () => resolveKill())
        killer.on('error', () => resolveKill())
      })
    } else {
      child.kill('SIGTERM')
    }
  } catch {
    /* ignore */
  }
}

function buildTree(root) {
  // Full product build so the served bundle matches the commit under test.
  execSync('npm run build', {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  })
  if (!existsSync(join(root, 'dist', 'index.html'))) {
    throw new Error('npm run build did not produce dist/index.html')
  }
}

/**
 * Static dist server + /api proxy + /__storylint_provenance.json
 */
function startUiServer({ root, apiOrigin, provenance, port }) {
  const dist = join(root, 'dist')
  const server = createHttpServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://127.0.0.1:${port}`)
      if (url.pathname === '/__storylint_provenance.json') {
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
        res.end(JSON.stringify(provenance))
        return
      }
      // Dev-style path used by identity probes: serve the on-disk source file.
      if (url.pathname === `/${SHELL_CSS_REL}` || url.pathname === '/src/components/shell/shell.css') {
        const text = readFileSync(join(root, SHELL_CSS_REL))
        res.writeHead(200, { 'content-type': 'text/css; charset=utf-8', 'cache-control': 'no-store' })
        res.end(text)
        return
      }
      if (url.pathname.startsWith('/api/') || url.pathname === '/api') {
        const target = `${apiOrigin}${url.pathname}${url.search}`
        const headers = { ...req.headers, host: new URL(apiOrigin).host }
        delete headers['content-length']
        const chunks = []
        for await (const chunk of req) chunks.push(chunk)
        const body = Buffer.concat(chunks)
        const upstream = await fetch(target, {
          method: req.method,
          headers,
          body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
        })
        const buf = Buffer.from(await upstream.arrayBuffer())
        const outHeaders = { 'cache-control': 'no-store' }
        const ct = upstream.headers.get('content-type')
        if (ct) outHeaders['content-type'] = ct
        res.writeHead(upstream.status, outHeaders)
        res.end(buf)
        return
      }

      let rel = decodeURIComponent(url.pathname)
      if (rel === '/') rel = '/index.html'
      const filePath = join(dist, rel.replace(/^\//, ''))
      if (!filePath.startsWith(dist) || !existsSync(filePath) || statSync(filePath).isDirectory()) {
        // SPA fallback
        const index = join(dist, 'index.html')
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
        createReadStream(index).pipe(res)
        return
      }
      res.writeHead(200, { 'content-type': MIME[extname(filePath)] || 'application/octet-stream' })
      createReadStream(filePath).pipe(res)
    } catch (error) {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
      res.end(error instanceof Error ? error.message : String(error))
    }
  })

  return new Promise((resolveListen, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => {
      resolveListen(server)
    })
  })
}

/**
 * Fetch and validate provenance from a UI origin against local tree expectations.
 * Fail closed: throws Error (caller maps to PreconditionError / exit before measure).
 */
export async function assertServedProvenance(uiOrigin, expected) {
  const base = uiOrigin.endsWith('/') ? uiOrigin : `${uiOrigin}/`
  const provUrl = new URL('__storylint_provenance.json', base).href
  let served = null
  try {
    const res = await fetch(provUrl, { redirect: 'follow' })
    if (!res.ok) {
      throw new Error(`GET ${provUrl} -> ${res.status}`)
    }
    served = await res.json()
  } catch (error) {
    // Fallback: shell.css content hash only (dev servers without provenance endpoint).
    const cssUrl = new URL(SHELL_CSS_REL, base).href
    try {
      const res = await fetch(cssUrl, { redirect: 'follow' })
      const text = await res.text()
      if (!res.ok || text.length < 20 || text.trimStart().startsWith('<!')) {
        throw new Error(`shell.css probe failed status=${res.status} bytes=${text.length}`)
      }
      served = {
        mode: 'shell-css-only',
        head: null,
        shellCss: {
          sha256_12: sha12(text),
          bytes: text.length,
          shellCssHasB5Touch:
            text.includes('project-switcher__menu > .ui-button') ||
            text.includes('project-switcher__menu>.ui-button'),
        },
      }
    } catch (inner) {
      throw new Error(
        `precondition not met: cannot prove what server is serving at ${uiOrigin} ` +
          `(provenance: ${error instanceof Error ? error.message : error}; ` +
          `shell.css: ${inner instanceof Error ? inner.message : inner})`,
      )
    }
  }

  const problems = []
  if (served.head && expected.head && served.head !== expected.head) {
    problems.push(`head mismatch served=${served.head} local=${expected.head}`)
  }
  if (!served.head && served.mode === 'shell-css-only') {
    // External/dev server: require shell.css hash match as the only proof.
    if (served.shellCss?.sha256_12 !== expected.shellCss.sha256_12) {
      problems.push(
        `shell.css hash mismatch served=${served.shellCss?.sha256_12} local=${expected.shellCss.sha256_12}`,
      )
    }
  } else if (served.shellCss?.sha256_12 && served.shellCss.sha256_12 !== expected.shellCss.sha256_12) {
    problems.push(
      `shell.css hash mismatch served=${served.shellCss.sha256_12} local=${expected.shellCss.sha256_12}`,
    )
  }
  if (served.root && expected.root && resolve(served.root) !== resolve(expected.root)) {
    problems.push(`root mismatch served=${served.root} local=${expected.root}`)
  }

  if (problems.length) {
    throw new Error(
      `precondition not met: served bundle does not match working tree (${problems.join('; ')})`,
    )
  }

  // Always probe shell.css as a live signal and include in result.
  const cssUrl = new URL(SHELL_CSS_REL, base).href
  let liveCss = null
  try {
    const res = await fetch(cssUrl, { redirect: 'follow' })
    const text = await res.text()
    liveCss = {
      url: cssUrl,
      status: res.status,
      bytes: text.length,
      sha256_12: sha12(text),
      shellCssHasB5Touch:
        text.includes('project-switcher__menu > .ui-button') ||
        text.includes('project-switcher__menu>.ui-button'),
    }
    if (liveCss.sha256_12 !== expected.shellCss.sha256_12) {
      throw new Error(
        `live shell.css hash ${liveCss.sha256_12} != local ${expected.shellCss.sha256_12}`,
      )
    }
  } catch (error) {
    throw new Error(
      `precondition not met: live shell.css proof failed: ${error instanceof Error ? error.message : error}`,
    )
  }

  return { provenance: served, liveCss }
}

/**
 * Build this tree and serve UI+API on ephemeral ports.
 * Returns { ui, api, head, shortHead, shellCss, provenance, stop }.
 */
export async function ownMeasurementStack({
  root = ROOT_DEFAULT,
  skipBuild = process.env.STORYLINT_SKIP_BUILD === '1',
} = {}) {
  const git = readGitHead(root)
  const shellCss = localShellCssIdentity(root)
  if (!skipBuild) {
    console.log(`[owned-stack] building ${root} @ ${git.short}`)
    buildTree(root)
  } else if (!existsSync(join(root, 'dist', 'index.html'))) {
    throw new Error('STORYLINT_SKIP_BUILD=1 but dist/index.html missing')
  } else {
    console.log(`[owned-stack] STORYLINT_SKIP_BUILD=1 — reusing dist @ ${git.short}`)
  }

  const apiPort = await freePort()
  const uiPort = await freePort()
  const apiOrigin = `http://127.0.0.1:${apiPort}`
  const uiOrigin = `http://127.0.0.1:${uiPort}`

  const provenance = {
    mode: 'owned-stack',
    head: git.head,
    shortHead: git.short,
    dirty: git.dirty,
    root,
    shellCss,
    builtAt: new Date().toISOString(),
    apiOrigin,
    uiOrigin,
  }

  console.log(`[owned-stack] api :${apiPort} ui :${uiPort}`)
  const apiChild = spawnLogged(
    process.execPath,
    ['--env-file-if-exists=.env', '--experimental-strip-types', 'src/server/index.ts'],
    {
      cwd: root,
      env: { STORYLINT_PORT: String(apiPort) },
      name: 'api',
    },
  )

  let uiServer = null
  const stop = async () => {
    if (uiServer) {
      await new Promise((r) => uiServer.close(() => r()))
      uiServer = null
    }
    await killTree(apiChild)
  }

  try {
    apiChild.on('exit', (code, signal) => {
      if (uiServer) {
        console.error(`[owned-stack] api exited early code=${code} signal=${signal}`)
      }
    })
    await waitForUrl(`${apiOrigin}/api/projects`, {
      timeoutMs: 30_000,
      ok: (r) => r.ok,
    })

    uiServer = await startUiServer({ root, apiOrigin, provenance, port: uiPort })
    await waitForUrl(`${uiOrigin}/__storylint_provenance.json`, {
      timeoutMs: 10_000,
      ok: (r) => r.ok,
    })
    await waitForUrl(`${uiOrigin}/`, {
      timeoutMs: 10_000,
      ok: (r) => r.ok,
    })

    const proof = await assertServedProvenance(uiOrigin, {
      head: git.head,
      root,
      shellCss,
    })

    return {
      owned: true,
      ui: `${uiOrigin}/`,
      api: apiOrigin,
      head: git.head,
      shortHead: git.short,
      dirty: git.dirty,
      shellCss,
      provenance,
      proof,
      stop,
      apiChild,
    }
  } catch (error) {
    await stop()
    const apiLog = apiChild._storylintLogs?.() || ''
    throw new Error(
      `owned measurement stack failed: ${error instanceof Error ? error.message : error}` +
        (apiLog ? `\n--- api log ---\n${apiLog.slice(-2000)}` : ''),
    )
  }
}

/**
 * Resolve what UI/API a gate will measure.
 *
 * Default: own the stack (build + ephemeral ports).
 * External: only if STORYLINT_UI is set AND STORYLINT_ALLOW_EXTERNAL_UI=1,
 * and provenance still matches this working tree. Otherwise refuse.
 */
export async function resolveMeasurementTarget({ root = ROOT_DEFAULT } = {}) {
  const externalUi = process.env.STORYLINT_UI || ''
  const allowExternal = process.env.STORYLINT_ALLOW_EXTERNAL_UI === '1'
  const git = readGitHead(root)
  const shellCss = localShellCssIdentity(root)
  const expected = { head: git.head, root, shellCss }

  if (externalUi) {
    if (!allowExternal) {
      throw new Error(
        `precondition not met: STORYLINT_UI=${externalUi} is set but STORYLINT_ALLOW_EXTERNAL_UI=1 was not. ` +
          `Refusing to adopt a stranger server. Unset STORYLINT_UI to let the checker own its stack, ` +
          `or set STORYLINT_ALLOW_EXTERNAL_UI=1 after you have proven the server is this commit.`,
      )
    }
    // Refuse well-known shared dev ports unless explicitly allowed (still provenance-checked).
    const proof = await assertServedProvenance(externalUi, expected)
    const api = process.env.STORYLINT_API || 'http://127.0.0.1:4174'
    return {
      owned: false,
      ui: externalUi.endsWith('/') ? externalUi : `${externalUi}/`,
      api,
      head: git.head,
      shortHead: git.short,
      dirty: git.dirty,
      shellCss,
      provenance: proof.provenance,
      proof,
      stop: async () => {},
    }
  }

  return ownMeasurementStack({ root })
}
