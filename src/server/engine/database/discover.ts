import fs from 'node:fs'
import path from 'node:path'
import type { DrizzleConfigInfo } from '../../../shared/types'
import { matchGlob } from '../../../shared/glob'
import { entriesOf, isDirectory } from '../fs'

const SKIP = new Set([
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.next',
  '.turbo',
  '.git',
  'test',
  'tests',
  '__tests__',
  'fixtures',
])
const CONFIG_NAME = /^drizzle\.config(?:\..+)?\.(?:[cm]?[jt]s|json)$/
const MAX_DEPTH = 4
const SOURCE = /\.(?:[cm]?[jt]s|[jt]sx)$/
const WORKSPACE_MARKERS = ['pnpm-workspace.yaml', 'lerna.json', 'nx.json']
const PACKAGE_DEPTH = 3

const walk = (dir: string, depth: number, found: string[]) => {
  for (const entry of entriesOf(dir)) {
    if (entry.isFile() && CONFIG_NAME.test(entry.name)) found.push(path.join(dir, entry.name))
    else if (
      entry.isDirectory() &&
      !SKIP.has(entry.name) &&
      !entry.name.startsWith('.') &&
      depth < MAX_DEPTH
    )
      walk(path.join(dir, entry.name), depth + 1, found)
  }
}

const readManifest = (dir: string): Record<string, unknown> | null => {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'))
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

const hasWorkspaces = (dir: string) =>
  WORKSPACE_MARKERS.some((marker) => fs.existsSync(path.join(dir, marker))) ||
  readManifest(dir)?.workspaces !== undefined

/** The nearest ancestor declaring a workspace, so a package can see the siblings it depends on. */
const workspaceRoot = (root: string) => {
  for (let dir = path.dirname(root); ; dir = path.dirname(dir)) {
    if (hasWorkspaces(dir)) return dir
    if (path.dirname(dir) === dir) return null
  }
}

/** Every package of the workspace, by name. */
const workspacePackages = (workspace: string) => {
  const packages = new Map<string, string>()
  const visit = (dir: string, depth: number) => {
    for (const entry of entriesOf(dir)) {
      if (!entry.isDirectory() || SKIP.has(entry.name) || entry.name.startsWith('.')) continue
      const child = path.join(dir, entry.name)
      const name = readManifest(child)?.name
      if (typeof name === 'string') packages.set(name, child)
      if (depth < PACKAGE_DEPTH) visit(child, depth + 1)
    }
  }
  visit(workspace, 1)
  return packages
}

const DEPENDENCY_KEYS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
]

/** The folders of the workspace packages the project depends on — where its schema may live. */
const dependencyDirs = (root: string) => {
  const workspace = workspaceRoot(root)
  const manifest = readManifest(root)
  if (!workspace || !manifest) return []
  const packages = workspacePackages(workspace)
  const names = DEPENDENCY_KEYS.flatMap((key) => {
    const value = manifest[key]
    return typeof value === 'object' && value !== null ? Object.keys(value) : []
  })
  return [...new Set(names.flatMap((name) => packages.get(name) ?? []))]
}

/**
 * Every Drizzle config under the project and, when the project has none, under the workspace
 * packages it depends on — `apps/backend` reading `packages/db`. Sorted so `drizzle.config.ts`
 * comes before its variants.
 */
export const findDrizzleConfigs = (root: string): string[] => {
  const found: string[] = []
  walk(root, 1, found)
  if (found.length === 0) for (const dir of dependencyDirs(root)) walk(dir, 1, found)
  return found.sort(
    (a, b) => path.basename(a).length - path.basename(b).length || a.localeCompare(b),
  )
}

const stringsIn = (text: string) =>
  [...text.matchAll(/["'`]([^"'`]+)["'`]/g)].map((match) => match[1] ?? '')

const field = (text: string, key: string) =>
  new RegExp(`\\b${key}\\s*:\\s*["'\`]([^"'\`]+)["'\`]`).exec(text)?.[1] ?? null

/**
 * What a Drizzle config declares, read as text: the file is user code that pulls in `.env` and
 * database credentials, so it is never imported or executed.
 */
export const readDrizzleConfig = (file: string): Omit<DrizzleConfigInfo, 'chosen'> => {
  let text = ''
  try {
    text = fs.readFileSync(file, 'utf8')
  } catch {
    // An unreadable config declares nothing.
  }
  const schemaMatch = /\bschema\s*:\s*(\[[^\]]*\]|["'`][^"'`]+["'`])/.exec(text)
  return {
    path: file,
    schema: schemaMatch?.[1] ? stringsIn(schemaMatch[1]) : [],
    out: field(text, 'out'),
    dialect: field(text, 'dialect'),
    casing: field(text, 'casing'),
  }
}

const listSources = (dir: string, found: string[]) => {
  for (const entry of entriesOf(dir)) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory() && !SKIP.has(entry.name) && !entry.name.startsWith('.'))
      listSources(full, found)
    else if (entry.isFile() && SOURCE.test(entry.name) && !entry.name.endsWith('.d.ts'))
      found.push(full)
  }
}

/**
 * The files a `schema` entry names, absolute: a file, every source file under a folder, or the
 * files a glob matches under its first wildcard-free folder.
 */
export const schemaFiles = (configFile: string, entry: string): string[] => {
  const base = path.dirname(configFile)
  const star = entry.indexOf('*')
  if (star === -1) {
    const target = path.resolve(base, entry)
    if (isDirectory(target)) {
      const found: string[] = []
      listSources(target, found)
      return found.sort()
    }
    return fs.existsSync(target) ? [target] : []
  }
  const fixed = entry.slice(0, star).replace(/[^/]*$/, '')
  const dir = path.resolve(base, fixed)
  const found: string[] = []
  listSources(dir, found)
  const pattern = path.resolve(base, entry).split(path.sep).join('/')
  return found.filter((file) => matchGlob(file.split(path.sep).join('/'), pattern)).sort()
}
