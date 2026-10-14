import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { matchGlob } from './engine/glob'
import type { WorkspaceMember } from './engine/workspace'

/** The files and features of a project whose config leaves them out, guessed from its folders. */

const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'coverage'])

const subdirectories = (dir: string) => {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
      .filter((entry) => !SKIP_DIRS.has(entry.name))
      .map((entry) => entry.name)
  } catch {
    return []
  }
}

export const defaultFeatures = (root: string, hasSrc: boolean) => {
  const base = hasSrc ? 'src' : ''
  const prefix = base ? `${base}/` : ''
  const grouped = subdirectories(join(root, base))
    .filter((name) => subdirectories(join(root, base, name)).length >= 3)
    .sort()
    .map((name) => `${prefix}${name}/*`)
  return [...grouped, `${prefix}*`]
}

const membersUnder = (pattern: string, members: WorkspaceMember[]) =>
  members.filter((member) =>
    matchGlob(member.dir, pattern.replace(/^\.\//, '').replace(/\/+$/, '')),
  )

const ownPatterns = (patterns: readonly string[]) =>
  patterns.filter((pattern) => !pattern.startsWith('!'))

/** `<pattern>/src/**` for the packages with a src folder, the whole folder for the others. */
const workspaceInclude = (
  patterns: readonly string[],
  members: WorkspaceMember[],
  rootSrc: boolean,
) => {
  const include = ownPatterns(patterns).flatMap((pattern) =>
    membersUnder(pattern, members).some((member) => member.hasSrc)
      ? [`${pattern.replace(/\/+$/, '')}/src/**`]
      : [],
  )
  for (const member of members) if (!member.hasSrc) include.push(`${member.dir}/**`)
  return rootSrc ? [...include, 'src/**'] : include
}

/** `src/**` in a project with a src folder, every file without one, each package's in a monorepo. */
export const defaultInclude = (
  patterns: readonly string[],
  members: WorkspaceMember[],
  { hasSrc, rootSrc }: { hasSrc: boolean; rootSrc: boolean },
) => {
  if (members.length) return workspaceInclude(patterns, members, rootSrc)
  return hasSrc ? ['src/**'] : ['**']
}

/** The single-project defaults inside each package, deepest packages first. */
export const workspaceFeatures = (root: string, members: WorkspaceMember[], rootSrc: boolean) => {
  const byDepth = [...members].sort((a, b) => b.dir.split('/').length - a.dir.split('/').length)
  const features = byDepth.flatMap((member) =>
    defaultFeatures(join(root, member.dir), member.hasSrc).map(
      (pattern) => `${member.dir}/${pattern}`,
    ),
  )
  return rootSrc ? [...features, ...defaultFeatures(root, true)] : features
}

export const DEFAULT_EXCLUDE = [
  '**/*.test.*',
  '**/*.spec.*',
  '**/*.d.ts',
  '**/node_modules/**',
  '**/dist/**',
]
