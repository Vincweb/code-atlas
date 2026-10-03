import fs from 'fs'
import http from 'http'
import os from 'os'
import path from 'path'
import { CONFIG_FILE, RUN_KINDS } from '../shared/config'
import type { AiRuleConfig, CommandRuleConfig } from '../shared/config'
import { API, projectPath } from '../shared/routes'
import type { RunEvent } from '../shared/types'
import { ConfigError, draftConfig, draftText } from './config'
import { browseDirectories, canonicalDir, expandHome, isProject, places } from './discover'
import { analyzeEngine, EngineError } from './engine'
import { claudeStatus } from './claudeStatus'
import { gitState } from './git'
import { openBrowser } from './open'
import { analyzeProject, projectContext } from './project'
import type { Overrides } from './project'
import { runRule } from './rules'
import { DEV_CLIENT, MISSING_CLIENT, clientIsBuilt, devPage, serveClientFile } from './static'

const MAX_FILE_BYTES = 2_000_000

const json = (response: http.ServerResponse, payload: unknown, status = 200) => {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  response.end(JSON.stringify(payload))
}

const isForeign = (request: http.IncomingMessage) => {
  const site = request.headers['sec-fetch-site']
  return typeof site === 'string' && site !== 'same-origin' && site !== 'none'
}

const PROJECT_ROUTES: string[] = [API.analysis, API.draft, API.createConfig, API.file, API.run]
const GUARDED_ROUTES: string[] = [API.createConfig, API.file, API.run]

type Target = { root: string } | { status: number; error: string }

const errorPayload = (error: unknown) => {
  if (error instanceof ConfigError)
    return { status: 422, body: { error: error.message, issues: error.issues } }
  if (error instanceof EngineError)
    return { status: 422, body: { error: error.message, kind: error.kind } }
  return {
    status: 500,
    body: { error: error instanceof Error ? error.message : 'unexpected error' },
  }
}

const readProjectFile = (root: string, requested: string) => {
  const file = path.resolve(root, requested)
  if (!file.startsWith(root + path.sep)) return null
  const segments = path.relative(root, file).split(path.sep)
  if (segments.some((segment) => segment.startsWith('.') || segment === 'node_modules')) return null
  try {
    const stat = fs.statSync(file)
    if (!stat.isFile() || stat.size > MAX_FILE_BYTES) return null
    return fs.readFileSync(file, 'utf8')
  } catch {
    return null
  }
}

export const serveAtlas = ({
  overrides,
  port,
  host = '127.0.0.1',
  cwd = process.cwd(),
  version = '',
  open = false,
}: {
  overrides: Overrides
  port: number
  host?: string
  cwd?: string
  version?: string
  open?: boolean
}) => {
  const built = clientIsBuilt()
  const devWeb = process.env.CODE_ATLAS_DEV
    ? (process.env.CODE_ATLAS_WEB ?? 'http://localhost:4801')
    : null
  const startupRoot = overrides.root === null ? null : path.resolve(overrides.root)
  const running = new Set<string>()

  const targetFor = (url: URL): Target => {
    const asked = url.searchParams.get('root')
    if (asked) {
      const resolved = path.resolve(cwd, expandHome(asked))
      if (!isProject(resolved))
        return {
          status: 400,
          error: `no project at ${asked} — expected a folder with package.json and tsconfig.json`,
        }
      return { root: resolved }
    }
    if (startupRoot) return { root: startupRoot }
    return { status: 409, error: 'no project named — add ?root=<path> to the request' }
  }

  const streamRun = (response: http.ServerResponse, root: string, ruleId: string) => {
    response.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-store',
      connection: 'keep-alive',
    })
    const send = (event: RunEvent) => response.write(`data: ${JSON.stringify(event)}\n\n`)
    const fail = (message: string) => {
      send({ type: 'error', message })
      response.end()
    }

    const key = `${root}\0${ruleId}`
    if (running.has(key)) return fail(`${ruleId} is already running`)

    const { config, stateDir } = projectContext(root, overrides)
    const rule = config.rules.find((candidate) => candidate.id === ruleId)
    if (!rule) return fail(`no rule ${ruleId} in this project's config`)
    if (!RUN_KINDS.includes(rule.kind))
      return fail(`${ruleId} is computed by every analysis — there is nothing to run`)

    const controller = new AbortController()
    response.on('close', () => {
      if (!response.writableEnded) controller.abort()
    })
    running.add(key)
    void runRule({
      root,
      config,
      rule: rule as CommandRuleConfig | AiRuleConfig,
      stateDir,
      commit: gitState(root).commit,
      onEvent: send,
      signal: controller.signal,
    })
      .catch((error: unknown) => send({ type: 'error', message: errorPayload(error).body.error }))
      .finally(() => {
        running.delete(key)
        response.end()
      })
  }

  const handleApi = (request: http.IncomingMessage, response: http.ServerResponse, url: URL) => {
    if (url.pathname === API.projects) {
      json(response, {
        cwd: path.resolve(cwd),
        home: os.homedir(),
        default: startupRoot,
        places: places(cwd),
        version,
      })
      return
    }

    if (url.pathname === API.claude) {
      if (isForeign(request)) {
        json(response, { error: 'this route only answers the page it belongs to' }, 403)
        return
      }
      void claudeStatus().then((status) => json(response, status))
      return
    }

    if (url.pathname === API.browse) {
      const listing = browseDirectories(cwd, url.searchParams.get('path') ?? '')
      if (!listing) json(response, { error: 'no such directory' }, 400)
      else json(response, listing)
      return
    }

    if (!PROJECT_ROUTES.includes(url.pathname)) {
      json(response, { error: `no such API route: ${url.pathname}` }, 404)
      return
    }
    if (GUARDED_ROUTES.includes(url.pathname) && isForeign(request)) {
      json(response, { error: 'this route only answers the page it belongs to' }, 403)
      return
    }

    const target = targetFor(url)
    if (!('root' in target)) {
      json(response, { error: target.error }, target.status)
      return
    }
    const { root } = target

    if (url.pathname === API.analysis) {
      json(response, analyzeProject(root, overrides))
      return
    }
    if (url.pathname === API.draft) {
      const { config } = projectContext(root, overrides)
      const draft = draftConfig(root, analyzeEngine(root, config))
      json(response, { config: draft, text: draftText(draft) })
      return
    }
    if (url.pathname === API.createConfig) {
      if (request.method !== 'POST') {
        json(response, { error: 'creating the config takes a POST' }, 405)
        return
      }
      const file = path.join(root, CONFIG_FILE)
      if (fs.existsSync(file)) {
        json(response, { error: `${CONFIG_FILE} already exists in this project` }, 409)
        return
      }
      const { config } = projectContext(root, overrides)
      const draft = draftConfig(root, analyzeEngine(root, config))
      fs.writeFileSync(file, draftText(draft), { flag: 'wx' })
      json(response, { path: file }, 201)
      return
    }
    if (url.pathname === API.file) {
      const requested = url.searchParams.get('path') ?? ''
      const text = readProjectFile(root, requested)
      if (text === null) json(response, { error: `cannot show ${requested}` }, 404)
      else json(response, { path: requested, text })
      return
    }
    streamRun(response, root, url.searchParams.get('rule') ?? '')
  }

  const server = http.createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost')
    try {
      if (url.pathname.startsWith('/api/')) {
        handleApi(request, response, url)
        return
      }
      if (devWeb) {
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
        response.end(devPage(`${devWeb}${url.pathname}${url.search}`))
        return
      }
      if (!built) {
        response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
        response.end(MISSING_CLIENT)
        return
      }
      if (serveClientFile(url.pathname, response)) return
      if (path.extname(url.pathname)) {
        response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
        response.end(`${url.pathname} is not in this build — reload the page.\n`)
        return
      }
      serveClientFile('/', response)
    } catch (error) {
      console.error(error)
      const { status, body } = errorPayload(error)
      if (response.headersSent) response.end()
      else json(response, body, status)
    }
  })

  server.on('error', (error) => {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'EADDRINUSE') {
      console.error(`✗ port ${port} is already in use — pass --port <n> to pick another`)
      process.exit(1)
    }
    throw error
  })

  server.listen(port, host, () => {
    if (!built) console.warn(process.env.CODE_ATLAS_DEV ? DEV_CLIENT : MISSING_CLIENT)
    const page = devWeb ?? `http://${host}:${port}`
    const link = startupRoot ? `${page}${projectPath(canonicalDir(cwd, startupRoot))}` : page
    console.log(`code-atlas → ${link}`)
    if (startupRoot) console.log(`Analysing ${startupRoot} on every request. Ctrl-C to stop.`)
    else console.log(`No project yet — open the page and pick one under ${path.resolve(cwd)}.`)
    if (open && !devWeb) openBrowser(link)
  })

  const shutdown = () => {
    server.close(() => process.exit(0))
    server.closeAllConnections()
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  return server
}
