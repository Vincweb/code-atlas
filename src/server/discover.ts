import fs from 'fs'
import os from 'os'
import path from 'path'
import { CONFIG_FILE } from '../shared/config'
import type { BrowsePayload, FolderEntry, Place } from '../shared/types'

const SKIP = new Set(['node_modules', 'dist', 'build', 'coverage', '.next', '.turbo'])
const MAX_ENTRIES = 500
const PLACES = [
  'Developer',
  'Projects',
  'projects',
  'Code',
  'code',
  'dev',
  'src',
  'repos',
  'workspace',
  'GitHub',
  'Sites',
  'Documents',
  'Desktop',
]

export const canonicalDir = (root: string, dir: string) => {
  const relative = path.relative(path.resolve(root), dir)
  if (relative === '') return '.'
  return !relative.startsWith('..') && !path.isAbsolute(relative) ? relative : dir
}

export const expandHome = (value: string) =>
  value === '~' || value.startsWith('~/') ? path.join(os.homedir(), value.slice(1)) : value

const entriesOf = (dir: string) => {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return []
  }
}

const isDirectory = (dir: string) => {
  try {
    return fs.statSync(dir).isDirectory()
  } catch {
    return false
  }
}

export const isProject = (dir: string) =>
  isDirectory(dir) &&
  fs.existsSync(path.join(dir, 'package.json')) &&
  fs.existsSync(path.join(dir, 'tsconfig.json'))

export const projectLabel = (dir: string) => {
  try {
    const manifest: unknown = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'))
    if (
      manifest &&
      typeof manifest === 'object' &&
      'name' in manifest &&
      typeof manifest.name === 'string'
    )
      return manifest.name
  } catch {
    // No readable package.json: the folder's name stands in.
  }
  return path.basename(dir)
}

export const places = (cwd: string): Place[] => {
  const home = os.homedir()
  const found: Place[] = [{ kind: 'home', name: '~', path: home }]
  const resolvedCwd = path.resolve(cwd)
  if (resolvedCwd !== home)
    found.push({ kind: 'cwd', name: path.basename(resolvedCwd), path: resolvedCwd })
  for (const name of PLACES) {
    const dir = path.join(home, name)
    if (isDirectory(dir) && !found.some((place) => place.path === dir))
      found.push({ kind: 'folder', name, path: dir })
  }
  return found
}

const folderEntry = (dir: string, name: string): FolderEntry => {
  const full = path.join(dir, name)
  return {
    name,
    path: full,
    isProject: isProject(full),
    isGit: fs.existsSync(path.join(full, '.git')),
    hasConfig: fs.existsSync(path.join(full, CONFIG_FILE)),
  }
}

export const browseDirectories = (cwd: string, requested: string): BrowsePayload | null => {
  const home = os.homedir()
  const dir = requested.trim() ? path.resolve(cwd, expandHome(requested.trim())) : home
  if (!isDirectory(dir)) return null

  const directories = entriesOf(dir)
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.') && !SKIP.has(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    .slice(0, MAX_ENTRIES)
    .map((name) => folderEntry(dir, name))

  const parent = path.dirname(dir)
  return {
    path: dir,
    parent: parent === dir ? null : parent,
    home,
    isProject: isProject(dir),
    hasConfig: fs.existsSync(path.join(dir, CONFIG_FILE)),
    directories,
  }
}
