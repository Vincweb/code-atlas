import type { ResolvedConfig } from '../../shared/config'
import type { EngineResult, FileNode, FunctionMetric } from '../../shared/types'
import { featureOf } from './glob'
import { measureFunctions } from './complexity'
import { buildGraph } from './graph'
import { extractImports, parseFile, resolveImports } from './imports'
import type { RawImport } from './imports'
import { collectFiles, loadProjects } from './project'
import { loadTypeScript } from './typescript'

export { EngineError } from './errors'

const MAX_WARNINGS = 20

export const analyzeEngine = (root: string, config: ResolvedConfig): EngineResult => {
  const ts = loadTypeScript(root)
  const warnings: string[] = []
  const projects = loadProjects(ts, root, config.tsconfig, warnings)
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
    lines: source.lines,
  }))
  const graph = buildGraph(files, imports, config)
  const typeImports = imports.filter((edge) => edge.kind === 'type').length

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
    warnings,
  }
}
