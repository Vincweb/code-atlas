import fs from 'node:fs'
import path from 'node:path'
import type * as TS from 'typescript'
import { matchAny } from './glob'
import type { ResolvedConfig } from '../../shared/config'
import { EngineError } from './errors'
import type { TsApi } from './typescript'

export type Project = {
  tsconfig: string
  options: TS.CompilerOptions
  fileNames: string[]
  pathKeys: string[]
}

export type SourceFile = {
  path: string
  absolute: string
  text: string
  lines: number
  project: Project
}

const SOURCE_EXTENSIONS = /\.(?:[cm]?[jt]s|[jt]sx)$/

const toRelative = (root: string, file: string) =>
  path.relative(root, file).split(path.sep).join('/')

export const loadProjects = (
  ts: TsApi,
  root: string,
  tsconfig: string,
  warnings: string[],
): Project[] => {
  const entry = path.resolve(root, tsconfig)
  if (!fs.existsSync(entry)) {
    throw new EngineError('tsconfig-missing', `${tsconfig} not found in ${root}`)
  }
  const projects: Project[] = []
  const seen = new Set<string>()
  const queue = [entry]
  while (queue.length > 0) {
    const current = queue.shift() as string
    if (seen.has(current)) continue
    seen.add(current)
    const read = ts.readConfigFile(current, (file) => ts.sys.readFile(file))
    if (read.error || !read.config) {
      const reason = read.error ? ts.flattenDiagnosticMessageText(read.error.messageText, '\n') : ''
      if (current === entry) {
        throw new EngineError('tsconfig-invalid', `${tsconfig} cannot be read: ${reason}`)
      }
      warnings.push(`referenced tsconfig ${toRelative(root, current)} cannot be read`)
      continue
    }
    const parsed = ts.parseJsonConfigFileContent(
      read.config,
      ts.sys,
      path.dirname(current),
      undefined,
      current,
    )
    projects.push({
      tsconfig: toRelative(root, current),
      options: parsed.options,
      fileNames: parsed.fileNames,
      pathKeys: Object.keys(parsed.options.paths ?? {}),
    })
    for (const reference of parsed.projectReferences ?? []) {
      const target = ts.resolveProjectReferencePath(reference)
      if (fs.existsSync(target)) queue.push(path.resolve(target))
      else warnings.push(`referenced tsconfig ${toRelative(root, target)} not found`)
    }
  }
  return projects
}

export const collectFiles = (
  root: string,
  projects: Project[],
  config: ResolvedConfig,
): SourceFile[] => {
  const files = new Map<string, SourceFile>()
  for (const project of projects) {
    for (const fileName of project.fileNames) {
      const relative = toRelative(root, fileName)
      if (files.has(relative) || relative.startsWith('..') || path.isAbsolute(relative)) continue
      if (relative.endsWith('.d.ts') || /(^|\/)node_modules\//.test(relative)) continue
      if (!SOURCE_EXTENSIONS.test(relative)) continue
      if (!matchAny(relative, config.include) || matchAny(relative, config.exclude)) continue
      let text: string
      try {
        text = fs.readFileSync(fileName, 'utf8')
      } catch {
        continue
      }
      let lines = 0
      if (text.length > 0) {
        lines = 1
        for (let index = text.indexOf('\n'); index !== -1; index = text.indexOf('\n', index + 1)) {
          lines++
        }
      }
      files.set(relative, { path: relative, absolute: fileName, text, lines, project })
    }
  }
  return [...files.values()]
}

export const relativeTo = toRelative
