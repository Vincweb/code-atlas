import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { matchAny } from './glob'

export type WorkspaceMember = { dir: string; name: string; hasSrc: boolean }

const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'coverage'])
const DEEP_LIMIT = 6

const readJson = (path: string): unknown => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

const isDirectory = (path: string) => existsSync(path) && statSync(path).isDirectory()

const stringsOf = (value: unknown) =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []

/** The `packages:` list of a pnpm-workspace.yaml, read by hand: the tool has no YAML parser. */
export const pnpmPackages = (text: string): string[] => {
  const found: string[] = []
  let inside = false
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+#.*$/, '')
    if (!line.trim() || line.trimStart().startsWith('#')) continue
    if (/^\S/.test(line)) {
      inside = /^packages\s*:\s*$/.test(line)
      continue
    }
    const item = inside ? /^\s+-\s*(.+?)\s*$/.exec(line) : null
    if (item?.[1]) found.push(item[1].replace(/^(['"])(.*)\1$/, '$2'))
  }
  return found
}

/** The workspace patterns the package manager reads, or none for a single project. */
export const detectWorkspaces = (root: string): string[] => {
  const pnpm = join(root, 'pnpm-workspace.yaml')
  if (existsSync(pnpm)) {
    try {
      const patterns = pnpmPackages(readFileSync(pnpm, 'utf8'))
      if (patterns.length) return patterns
    } catch {
      // unreadable: fall back to package.json
    }
  }
  const manifest = readJson(join(root, 'package.json')) as { workspaces?: unknown } | null
  const workspaces = manifest?.workspaces
  if (Array.isArray(workspaces)) return stringsOf(workspaces)
  if (workspaces && typeof workspaces === 'object' && 'packages' in workspaces)
    return stringsOf(workspaces.packages)
  return []
}

const normalise = (pattern: string) => pattern.replace(/^\.\//, '').replace(/\/+$/, '')

/** How deep a pattern can reach, and the literal folders it starts with. */
const reachOf = (pattern: string) => {
  const segments = pattern.split('/')
  const glob = segments.findIndex((segment) => /[*?{[]/.test(segment))
  return {
    prefix: glob === -1 ? segments : segments.slice(0, glob),
    depth: pattern.includes('**') ? DEEP_LIMIT : segments.length,
  }
}

const childrenOf = (root: string, dir: string) => {
  try {
    return readdirSync(join(root, dir), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
      .filter((entry) => !SKIP_DIRS.has(entry.name))
      .map((entry) => (dir ? `${dir}/${entry.name}` : entry.name))
  } catch {
    return []
  }
}

/** The package.json name, or the folder when it has none. */
export const packageName = (root: string, dir: string) => {
  const manifest = readJson(join(root, dir, 'package.json')) as { name?: unknown } | null
  return typeof manifest?.name === 'string' && manifest.name ? manifest.name : dir
}

/**
 * The folders the patterns name that hold a package.json and the tsconfig, so TypeScript can read
 * them. A `!pattern` takes folders back out, as in the package managers.
 */
export const workspaceMembers = (
  root: string,
  patterns: readonly string[],
  tsconfig: string,
): WorkspaceMember[] => {
  const include = patterns.filter((p) => !p.startsWith('!')).map(normalise)
  const exclude = patterns.filter((p) => p.startsWith('!')).map((p) => normalise(p.slice(1)))
  if (!include.length) return []
  const reaches = include.map(reachOf)
  const depth = Math.max(...reaches.map((reach) => reach.depth))
  const worthEntering = (dir: string) => {
    const segments = dir.split('/')
    return reaches.some(({ prefix }) =>
      segments.every((segment, index) => index >= prefix.length || prefix[index] === segment),
    )
  }
  const found: string[] = []
  let level = childrenOf(root, '').filter(worthEntering)
  for (let current = 1; current <= depth && level.length; current++) {
    for (const dir of level)
      if (matchAny(dir, include) && !matchAny(dir, exclude) && dir !== '') found.push(dir)
    level = level.flatMap((dir) => childrenOf(root, dir)).filter(worthEntering)
  }
  return found
    .filter((dir) => existsSync(join(root, dir, 'package.json')))
    .filter((dir) => existsSync(join(root, dir, tsconfig)))
    .sort()
    .map((dir) => ({
      dir,
      name: packageName(root, dir),
      hasSrc: isDirectory(join(root, dir, 'src')),
    }))
}
