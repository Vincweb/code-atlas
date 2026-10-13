import { basename, join } from 'node:path'
import type { ResolvedConfig } from '../../shared/config'
import { packageOf } from '../../shared/packages'
import type { EngineResult, FileNode, FunctionMetric, PackageRef } from '../../shared/types'
import { packageName, workspaceMembers } from './workspace'
import { analyzeDatabase } from './database'
import { featureOf } from './glob'
import { measureFunctions } from './complexity'
import { buildGraph } from './graph'
import { extractImports, parseFile, resolveImports } from './imports'
import type { RawImport } from './imports'
import { collectFiles, loadProjects } from './project'
import { loadTypeScript } from './typescript'

export { EngineError } from './errors'

const MAX_WARNINGS = 20

/** The root counts as a package when it holds files of its own besides its packages'. */
const ROOT_PACKAGE = '.'

export const analyzeEngine = (root: string, config: ResolvedConfig): EngineResult => {
  const members = workspaceMembers(root, config.workspaces, config.tsconfig)
  const dirs = members.map((member) => member.dir)
  const ts = loadTypeScript(root, dirs)
  const warnings: string[] = []
  const tsconfigs = members.length
    ? [...dirs.map((dir) => join(dir, config.tsconfig)), config.tsconfig]
    : [config.tsconfig]
  const projects = loadProjects(ts, root, tsconfigs, warnings)
  const sources = collectFiles(root, projects, config)

  const raws = new Map<string, RawImport[]>()
  const functions: FunctionMetric[] = []
  for (const source of sources) {
    const sourceFile = parseFile(ts, source)
    raws.set(source.path, extractImports(ts, sourceFile))
    functions.push(...measureFunctions(ts, sourceFile, source.path))
  }

  const { edges: imports, unresolved } = resolveImports(ts, root, sources, raws)
  warnings.push(...unresolved.slice(0, MAX_WARNINGS))
  if (unresolved.length > MAX_WARNINGS) {
    warnings.push(`… and ${unresolved.length - MAX_WARNINGS} more unresolved imports`)
  }

  const files: FileNode[] = sources.map((source) => ({
    path: source.path,
    feature: featureOf(source.path, config.features),
    package: members.length ? (packageOf(source.path, dirs) ?? ROOT_PACKAGE) : null,
    lines: source.lines,
  }))
  const held = new Set(files.map((file) => file.package))
  const packages: PackageRef[] = members
    .filter((member) => held.has(member.dir))
    .map(({ dir, name }) => ({ dir, name }))
  if (held.has(ROOT_PACKAGE))
    packages.push({ dir: ROOT_PACKAGE, name: packageName(root, '') || basename(root) })
  const graph = buildGraph(files, imports, config)
  const typeImports = imports.filter((edge) => edge.kind === 'type').length

  let database = null
  try {
    database = analyzeDatabase(root, config, ts)
  } catch (error) {
    warnings.push(
      `database schema not read: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  return {
    ts: { version: ts.version, projects: projects.map((project) => project.tsconfig) },
    files,
    imports,
    graph,
    functions,
    stats: {
      files: files.length,
      lines: files.reduce((sum, file) => sum + file.lines, 0),
      imports: imports.length - typeImports,
      typeImports,
      features: graph.features.length,
      functions: functions.length,
    },
    packages,
    database,
    warnings,
  }
}
