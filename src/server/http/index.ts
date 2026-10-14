import http from 'http'
import path from 'path'
import { projectPath } from '../../shared/routes'
import { ConfigError } from '../config'
import { EngineError } from '../engine'
import type { Overrides } from '../project'
import { canonicalDir } from '../project/discover'
import { createScans } from '../strix/scan'
import { json } from './api'
import { openBrowser } from './open'
import { apiHandler } from './routes'
import { createRuns } from './runs'
import { DEV_CLIENT, MISSING_CLIENT, clientIsBuilt, devPage, serveClientFile } from './static'

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

/** Where the page comes from: the Vite dev server in development, the build otherwise. */
type PageSource = { built: boolean; devWeb: string | null }

const servePage = ({ built, devWeb }: PageSource, url: URL, response: http.ServerResponse) => {
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
}

/** On Ctrl-C or a kill, the runs and scans are cancelled before the server closes. */
const stopOnSignals = (server: http.Server, workers: { stopAll: () => void }[]) => {
  const shutdown = () => {
    for (const worker of workers) worker.stopAll()
    server.close(() => process.exit(0))
    server.closeAllConnections()
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
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
  const page: PageSource = {
    built: clientIsBuilt(),
    devWeb: process.env.CODE_ATLAS_DEV
      ? (process.env.CODE_ATLAS_WEB ?? 'http://localhost:4801')
      : null,
  }
  const startupRoot = overrides.root === null ? null : path.resolve(overrides.root)
  const runs = createRuns()
  const scans = createScans()
  const handleApi = apiHandler({ overrides, cwd, version, startupRoot, runs, scans })

  const server = http.createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost')
    if (isRebound(request, host)) {
      response.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' })
      response.end(`code-atlas only answers to localhost, not to ${request.headers.host}\n`)
      return
    }
    try {
      if (url.pathname.startsWith('/api/')) handleApi({ request, response, url })
      else servePage(page, url, response)
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
    if (!page.built) console.warn(process.env.CODE_ATLAS_DEV ? DEV_CLIENT : MISSING_CLIENT)
    const home = page.devWeb ?? `http://${host}:${port}`
    const link = startupRoot ? `${home}${projectPath(canonicalDir(cwd, startupRoot))}` : home
    console.log(`code-atlas → ${link}`)
    if (startupRoot) console.log(`Analysing ${startupRoot} on every request. Ctrl-C to stop.`)
    else console.log(`No project yet — open the page and pick one under ${path.resolve(cwd)}.`)
    if (open && !page.devWeb) openBrowser(link)
  })

  stopOnSignals(server, [scans, runs])
  return server
}
