import fs from 'fs'
import http from 'http'
import os from 'os'
import path from 'path'
import { CONFIG_FILE, RUN_KINDS } from '../shared/config'
import type { AiRuleConfig, CommandRuleConfig } from '../shared/config'
import { API, claudeLink, projectPath } from '../shared/routes'
import type { RunEvent } from '../shared/types'
import { ConfigError, draftConfig, draftText } from './config'
import { browseDirectories, canonicalDir, expandHome, isProject, places } from './discover'
import { analyzeEngine, EngineError } from './engine'
import { claudeStatus } from './claudeStatus'
import { gitState } from './git'
import { openBrowser, openUrl } from './open'
import { analyzeProject, projectContext } from './project'
import type { Overrides } from './project'
import { json, messageOf, readJson } from './http'
import type { ApiCall, ProjectCall } from './http'
import { runRule } from './rules'
import { securityRoutes } from './security'
import { createScans } from './strixScan'
import { strixTools } from './strixTooling'
import { DEV_CLIENT, MISSING_CLIENT, clientIsBuilt, devPage, serveClientFile } from './static'

const MAX_FILE_BYTES = 2_000_000
const isForeign = (request: http.IncomingMessage) => {
  const site = request.headers['sec-fetch-site']
  return typeof site === 'string' && site !== 'same-origin' && site !== 'none'
}

const GUARDED_ROUTES: string[] = [
  API.createConfig,
  API.claudeOpen,
  API.file,
  API.run,
  API.security,
  API.securityScan,
  API.securityCancel,
]
const FOREIGN = 'this route only answers the page it belongs to'

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

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]'])

/**
 * Whether a request names a host other than this machine. A page whose domain was rebound to
 * 127.0.0.1 reaches the server as same-origin, so only the Host header gives it away. A server
 * bound beyond loopback was exposed on purpose and answers any name.
 */
export const isRebound = (request: http.IncomingMessage, boundHost: string) => {
  if (!LOOPBACK.has(boundHost) && boundHost !== '::1') return false
  try {
    const { hostname } = new URL(`http://${request.headers.host ?? ''}`)
    return !LOOPBACK.has(hostname) && !hostname.endsWith('.localhost')
  } catch {
    return true
  }
}

const isInside = (root: string, file: string) => file.startsWith(root + path.sep)

export const readProjectFile = (root: string, requested: string) => {
  const file = path.resolve(root, requested)
  if (!isInside(root, file)) return null
  const segments = path.relative(root, file).split(path.sep)
  if (segments.some((segment) => segment.startsWith('.') || segment === 'node_modules')) return null
  try {
    if (!isInside(fs.realpathSync(root), fs.realpathSync(file))) return null
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
  const scans = createScans()

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

  const createConfig = ({ request, response, root }: ProjectCall) => {
    if (request.method !== 'POST')
      return json(response, { error: 'creating the config takes a POST' }, 405)
    const file = path.join(root, CONFIG_FILE)
    if (fs.existsSync(file))
      return json(response, { error: `${CONFIG_FILE} already exists in this project` }, 409)
    const { config } = projectContext(root, overrides)
    const draft = draftConfig(root, analyzeEngine(root, config))
    fs.writeFileSync(file, draftText(draft), { flag: 'wx' })
    json(response, { path: file }, 201)
  }

  const openClaude = ({ request, response, root }: ProjectCall) => {
    if (request.method !== 'POST')
      return json(response, { error: 'opening Claude takes a POST' }, 405)
    readJson(request).then(
      (body) => {
        const prompt =
          typeof body === 'object' && body !== null && 'prompt' in body ? body.prompt : null
        if (typeof prompt !== 'string')
          return json(response, { error: 'the body needs a "prompt" string' }, 400)
        openUrl(claudeLink(prompt, root)).then(
          () => json(response, { opened: true }),
          (error: unknown) => json(response, { error: messageOf(error) }, 502),
        )
      },
      (error: unknown) => json(response, { error: messageOf(error) }, 400),
    )
  }

  const globalRoutes = new Map<string, (call: ApiCall) => void>([
    [
      API.projects,
      ({ response }) =>
        json(response, {
          cwd: path.resolve(cwd),
          home: os.homedir(),
          default: startupRoot,
          places: places(cwd),
          version,
        }),
    ],
    [
      API.claude,
      ({ request, response }) => {
        if (isForeign(request)) return json(response, { error: FOREIGN }, 403)
        void claudeStatus().then((status) => json(response, status))
      },
    ],
    [
      API.securityTools,
      ({ request, response, url }) => {
        if (isForeign(request)) return json(response, { error: FOREIGN }, 403)
        void strixTools(url.searchParams.has('fresh')).then((tools) => json(response, tools))
      },
    ],
    [
      API.browse,
      ({ response, url }) => {
        const listing = browseDirectories(cwd, url.searchParams.get('path') ?? '')
        if (!listing) json(response, { error: 'no such directory' }, 400)
        else json(response, listing)
      },
    ],
  ])

  const projectRoutes = new Map<string, (call: ProjectCall) => void>([
    [API.analysis, ({ response, root }) => json(response, analyzeProject(root, overrides))],
    [
      API.draft,
      ({ response, root }) => {
        const { config } = projectContext(root, overrides)
        const draft = draftConfig(root, analyzeEngine(root, config))
        json(response, { config: draft, text: draftText(draft) })
      },
    ],
    [API.createConfig, createConfig],
    [API.claudeOpen, openClaude],
    [
      API.file,
      ({ response, url, root }) => {
        const requested = url.searchParams.get('path') ?? ''
        const text = readProjectFile(root, requested)
        if (text === null) json(response, { error: `cannot show ${requested}` }, 404)
        else json(response, { path: requested, text })
      },
    ],
    [
      API.run,
      ({ response, url, root }) => streamRun(response, root, url.searchParams.get('rule') ?? ''),
    ],
    ...securityRoutes(overrides, scans),
  ])

  const handleApi = (call: ApiCall) => {
    const { request, response, url } = call
    const global = globalRoutes.get(url.pathname)
    if (global) return global(call)
    const route = projectRoutes.get(url.pathname)
    if (!route) return json(response, { error: `no such API route: ${url.pathname}` }, 404)
    if (GUARDED_ROUTES.includes(url.pathname) && isForeign(request))
      return json(response, { error: FOREIGN }, 403)
    const target = targetFor(url)
    if (!('root' in target)) return json(response, { error: target.error }, target.status)
    route({ ...call, root: target.root })
  }

  const server = http.createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost')
    if (isRebound(request, host)) {
      response.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' })
      response.end(`code-atlas only answers to localhost, not to ${request.headers.host}\n`)
      return
    }
    try {
      if (url.pathname.startsWith('/api/')) {
        handleApi({ request, response, url })
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
    scans.stopAll()
    server.close(() => process.exit(0))
    server.closeAllConnections()
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  return server
}
