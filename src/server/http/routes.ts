import fs from 'fs'
import type http from 'http'
import os from 'os'
import path from 'path'
import { CONFIG_FILE } from '../../shared/config'
import { messageOf } from '../../shared/errors'
import { API, claudeLink } from '../../shared/routes'
import { draftConfig, draftText } from '../config/draft'
import { analyzeEngine } from '../engine'
import { drizzleConfigs, migrationsDirOf } from '../engine/database'
import { findDoc } from '../engine/docs'
import {
  buildMigrationGraph,
  migrationsInfo,
  readMigrationSql,
} from '../engine/database/migrations'
import { analyzeProject, projectContext } from '../project'
import type { Overrides } from '../project'
import { browseDirectories, expandHome, isProject, places } from '../project/discover'
import type { Scans } from '../strix/scan'
import { strixTools } from '../strix/tooling'
import { json, readJson } from './api'
import type { ApiCall, ProjectCall } from './api'
import { claudeStatus } from './claudeStatus'
import { openUrl } from './open'
import { runRoutes } from './runs'
import type { Runs } from './runs'
import { securityRoutes } from './security'

const MAX_FILE_BYTES = 2_000_000
const isForeign = (request: http.IncomingMessage) => {
  const site = request.headers['sec-fetch-site']
  return typeof site === 'string' && site !== 'same-origin' && site !== 'none'
}

const GUARDED_ROUTES: string[] = [
  API.analysis,
  API.createConfig,
  API.claudeOpen,
  API.file,
  API.doc,
  API.runs,
  API.run,
  API.runCancel,
  API.security,
  API.securityScan,
  API.securityCancel,
  API.migrations,
  API.migrationSql,
]
const FOREIGN = 'this route only answers the page it belongs to'

/** What the routes need from the server that answers them. */
export type RouteContext = {
  overrides: Overrides
  cwd: string
  version: string
  /** The project named on the command line, if any: the one a call without `root` is about. */
  startupRoot: string | null
  runs: Runs
  scans: Scans
}

type Target = { root: string } | { status: number; error: string }

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

const createConfig =
  (overrides: Overrides) =>
  ({ request, response, root }: ProjectCall) => {
    if (request.method !== 'POST')
      return json(response, { error: 'creating the config takes a POST' }, 405)
    const file = path.join(root, CONFIG_FILE)
    if (fs.existsSync(file))
      return json(response, { error: `${CONFIG_FILE} already exists in this project` }, 409)
    const { config } = projectContext(root, overrides)
    const draft = draftConfig(root, analyzeEngine(root, config), config)
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

/** The v1 migrations folder of the project's Drizzle config — the only folder the routes read. */
const migrationsDir = (root: string, overrides: Overrides) => {
  const { config } = projectContext(root, overrides)
  const chosen = drizzleConfigs(root, config.database).configs.find((info) => info.chosen)
  const dir = chosen ? migrationsDirOf(chosen) : null
  return dir && migrationsInfo(dir)?.layout === 'v1' ? dir : null
}

/** The routes that need no project: the places to pick one from, and the tools on this machine. */
const globalRoutes = ({ cwd, version, startupRoot }: RouteContext) =>
  new Map<string, (call: ApiCall) => void>([
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

/** The routes about one project, the one their call names. */
const projectRoutes = ({ overrides, runs, scans }: RouteContext) =>
  new Map<string, (call: ProjectCall) => void>([
    [
      API.analysis,
      ({ response, root }) => json(response, analyzeProject(root, overrides, { record: true })),
    ],
    [
      API.draft,
      ({ response, root }) => {
        const { config } = projectContext(root, overrides)
        const draft = draftConfig(root, analyzeEngine(root, config), config)
        json(response, { config: draft, text: draftText(draft) })
      },
    ],
    [API.createConfig, createConfig(overrides)],
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
      API.doc,
      ({ response, url, root }) => {
        const id = url.searchParams.get('feature') ?? ''
        const found = findDoc(root, id, projectContext(root, overrides).config.docs)
        if (!found) json(response, { error: `no doc for ${id}` }, 404)
        else json(response, { id, ...found })
      },
    ],
    ...runRoutes(overrides, runs),
    ...securityRoutes(overrides, scans),
    [
      API.migrations,
      ({ response, root }) => {
        const dir = migrationsDir(root, overrides)
        if (!dir) return json(response, { error: 'no Drizzle Kit v1 migrations folder' }, 404)
        json(response, { dir, graph: buildMigrationGraph(dir) })
      },
    ],
    [
      API.migrationSql,
      ({ response, url, root }) => {
        const dir = migrationsDir(root, overrides)
        const folder = url.searchParams.get('folder') ?? ''
        const sql = dir ? readMigrationSql(dir, folder) : null
        if (sql === null) return json(response, { error: `no migration ${folder}` }, 404)
        json(response, { folder, sql })
      },
    ],
  ])

/** The project a call is about: the one its `root` names, else the one the server started on. */
const targetFor = ({ cwd, startupRoot }: RouteContext, url: URL): Target => {
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

/** Answers the `/api/` requests: a global route, or a project route once its project is found. */
export const apiHandler = (context: RouteContext) => {
  const globals = globalRoutes(context)
  const projects = projectRoutes(context)
  return (call: ApiCall) => {
    const { request, response, url } = call
    const global = globals.get(url.pathname)
    if (global) return global(call)
    const route = projects.get(url.pathname)
    if (!route) return json(response, { error: `no such API route: ${url.pathname}` }, 404)
    if (GUARDED_ROUTES.includes(url.pathname) && isForeign(request))
      return json(response, { error: FOREIGN }, 403)
    const target = targetFor(context, url)
    if (!('root' in target)) return json(response, { error: target.error }, target.status)
    route({ ...call, root: target.root })
  }
}
