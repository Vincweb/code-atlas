import path from 'path'
import { STATE_DIR } from '../shared/config'
import type { Analysis, Bucket, Distribution } from '../shared/types'
import { loadConfig } from './config'
import { projectLabel } from './discover'
import { analyzeEngine } from './engine'
import { gitState } from './git'
import { evaluate } from './rules'
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
  const { rules, scores, baseline } = evaluate({ root, config, engine, stateDir, git })
  const functions = [...engine.functions]
    .sort((a, b) => b.complexity - a.complexity)
    .slice(0, MAX_FUNCTIONS)

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
    functions,
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
    distribution: {
      complexity: distributionOf(
        engine.functions.map((fn) => fn.complexity),
        COMPLEXITY_EDGES,
      ),
      fileLines: distributionOf(
        engine.files.map((file) => file.lines),
        LINE_EDGES,
      ),
    },
    describeCommand: describeCommand(root, overrides),
    warnings: engine.warnings,
  }
}
