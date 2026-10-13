import path from 'path'
import { STATE_DIR } from '../shared/config'
import type { ResolvedConfig } from '../shared/config'
import type {
  Analysis,
  Bucket,
  Distribution,
  Distributions,
  EngineResult,
  EngineStats,
  FileNode,
  FunctionMetric,
  ImportEdge,
  Workspace,
} from '../shared/types'
import { loadConfig } from './config'
import { projectLabel } from './discover'
import { analyzeEngine } from './engine'
import { buildGraph } from './engine/graph'
import { gitState } from './git'
import { evaluate } from './rules'
import type { PackageScores } from './rules'
import { describeCommand } from './selfCommand'
import { AI_TOOLS, FINDINGS_SCHEMA, aiInvocation } from './rules/ai'

const MAX_FUNCTIONS = 300
const COMPLEXITY_EDGES = [5, 10, 15, 25]
const LINE_EDGES = [100, 200, 400, 800]

const distributionOf = (values: number[], edges: number[]): Distribution => {
  const buckets: Bucket[] = [...edges, null].map((max, index) => ({
    min: index === 0 ? 1 : (edges[index - 1] ?? 0) + 1,
    max,
    count: 0,
  }))
  for (const value of values) {
    const bucket = buckets.find((candidate) => candidate.max === null || value <= candidate.max)
    if (bucket) bucket.count++
  }
  const total = values.reduce((sum, value) => sum + value, 0)
  return {
    buckets,
    average: values.length ? Math.round((total / values.length) * 10) / 10 : 0,
    max: values.length ? Math.max(...values) : 0,
    total: values.length,
  }
}

const distributionsOf = (files: FileNode[], functions: FunctionMetric[]): Distributions => ({
  complexity: distributionOf(
    functions.map((fn) => fn.complexity),
    COMPLEXITY_EDGES,
  ),
  fileLines: distributionOf(
    files.map((file) => file.lines),
    LINE_EDGES,
  ),
})

const statsOf = (
  files: FileNode[],
  imports: ImportEdge[],
  functions: FunctionMetric[],
): EngineStats => {
  const typeImports = imports.filter((edge) => edge.kind === 'type').length
  return {
    files: files.length,
    lines: files.reduce((sum, file) => sum + file.lines, 0),
    imports: imports.length - typeImports,
    typeImports,
    features: new Set(files.map((file) => file.feature)).size,
    functions: functions.length,
  }
}

const mostComplex = (functions: FunctionMetric[]) =>
  [...functions].sort((a, b) => b.complexity - a.complexity).slice(0, MAX_FUNCTIONS)

/**
 * Each package's figures, and the graph of the packages themselves: one node per package, whose
 * edges are the imports from one package into another.
 */
const workspaceOf = (
  engine: EngineResult,
  config: ResolvedConfig,
  packages: PackageScores[],
): Workspace | null => {
  if (!engine.packages.length) return null
  const packageOfFile = new Map(engine.files.map((file) => [file.path, file.package]))
  const asPackages = engine.files.map((file) => ({ ...file, feature: file.package ?? '.' }))
  return {
    packages: engine.packages.map((pkg) => {
      const files = engine.files.filter((file) => file.package === pkg.dir)
      const imports = engine.imports.filter((edge) => packageOfFile.get(edge.from) === pkg.dir)
      const own = new Set(files.map((file) => file.path))
      const functions = engine.functions.filter((fn) => own.has(fn.file))
      return {
        ...pkg,
        scores: packages.find((entry) => entry.dir === pkg.dir)?.scores ?? {
          overall: null,
          families: [],
        },
        stats: statsOf(files, imports, functions),
        distribution: distributionsOf(files, functions),
      }
    }),
    graph: buildGraph(asPackages, engine.imports, { ...config, layers: [], allow: [] }),
  }
}

/** The most complex functions overall, and in a monorepo those of each package as well. */
const functionsOf = (engine: EngineResult) => {
  if (!engine.packages.length) return mostComplex(engine.functions)
  const packageOfFile = new Map(engine.files.map((file) => [file.path, file.package]))
  const kept = new Set(mostComplex(engine.functions))
  for (const pkg of engine.packages)
    for (const fn of mostComplex(
      engine.functions.filter((candidate) => packageOfFile.get(candidate.file) === pkg.dir),
    ))
      kept.add(fn)
  return [...kept].sort((a, b) => b.complexity - a.complexity)
}

export type Overrides = {
  root: string | null
  config: string | null
  state: string | null
}

export const projectContext = (root: string, overrides: Overrides) => {
  const isStartup = overrides.root !== null && path.resolve(overrides.root) === root
  const { config, source, path: configPath } = loadConfig(root, isStartup ? overrides.config : null)
  const stateDir =
    isStartup && overrides.state ? path.resolve(overrides.state) : path.join(root, STATE_DIR)
  return { config, source, configPath, stateDir }
}

export const analyzeProject = (root: string, overrides: Overrides): Analysis => {
  const started = performance.now()
  const { config, source, configPath, stateDir } = projectContext(root, overrides)
  const engine = analyzeEngine(root, config)
  const git = gitState(root)
  const { rules, scores, packages, baseline } = evaluate({ root, config, engine, stateDir, git })

  return {
    root,
    label: projectLabel(root),
    config,
    configSource: source,
    configPath,
    commit: git.commit,
    dirty: git.dirty,
    analyzedAt: new Date().toISOString(),
    durationMs: Math.round(performance.now() - started),
    ts: engine.ts,
    stats: engine.stats,
    graph: engine.graph,
    files: engine.files,
    functions: functionsOf(engine),
    database: engine.database,
    rules,
    scores,
    baseline,
    audits: {
      schema: JSON.stringify(FINDINGS_SCHEMA, null, 2),
      tools: AI_TOOLS,
      items: config.rules.flatMap((rule) => {
        if (rule.kind !== 'ai') return []
        const { model, budgetUsd, prompt, args } = aiInvocation(rule, config)
        return [{ id: rule.id, model, budgetUsd, prompt, args }]
      }),
    },
    distribution: distributionsOf(engine.files, engine.functions),
    workspace: workspaceOf(engine, config, packages),
    describeCommand: describeCommand(root, overrides),
    warnings: engine.warnings,
  }
}
