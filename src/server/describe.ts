import path from 'path'
import { CONFIG_FILE } from '../shared/config'
import type { ResolvedConfig } from '../shared/config'
import type { EngineResult, FeatureEdge, RuleResult, Scores } from '../shared/types'
import { ConfigError } from './config'
import { projectLabel } from './discover'
import { analyzeEngine } from './engine'
import { gitState } from './git'
import { projectContext } from './project'
import type { Overrides } from './project'
import { CONFIG_REFERENCE } from './reference'
import { evaluate } from './rules'

const MAX_EDGES = 40
const MAX_IMPORTS = 3

const edgeLine = (edge: FeatureEdge) =>
  [
    `- ${edge.from} → ${edge.to} (${edge.class}, ${edge.weight} import${edge.weight === 1 ? '' : 's'})`,
    ...edge.imports
      .slice(0, MAX_IMPORTS)
      .map((item) => `    ${item.file}:${item.line} → ${item.target}`),
    ...(edge.imports.length > MAX_IMPORTS
      ? [`    … ${edge.imports.length - MAX_IMPORTS} more`]
      : []),
  ].join('\n')

const layersSection = (config: ResolvedConfig, engine: EngineResult) => {
  const { features } = engine.graph
  if (config.layers.length === 0)
    return [
      'No layers configured. Features:',
      ...features.map((f) => `- ${f.id} (${f.files} files)`),
    ]
  const lines = config.layers.map((layer, index) => {
    const members = features.filter((f) => f.layer === index).map((f) => f.id)
    return `${index + 1}. "${layer.name}"${layer.siblings ? ' (siblings)' : ''}: ${members.join(', ') || '—'}`
  })
  const unlayered = features.filter((f) => f.layer === null).map((f) => f.id)
  return [...lines, `Unlayered: ${unlayered.join(', ') || 'none'}`]
}

const rulesSection = (rules: RuleResult[]) =>
  rules.map((rule) => {
    const state =
      rule.status === 'pass' || rule.status === 'fail'
        ? `${rule.count} violation${rule.count === 1 ? '' : 's'}`
        : rule.status
    return `- ${rule.id} (${rule.kind}, ${rule.severity}): ${state}`
  })

const scoresLine = (scores: Scores) =>
  [
    ...scores.families.map((family) => `${family.family} ${family.score ?? '—'}`),
    `overall ${scores.overall ?? '—'}`,
  ].join(' · ')

const stateOf = (
  root: string,
  { config, source, configPath, stateDir }: ReturnType<typeof projectContext>,
) => {
  const engine = analyzeEngine(root, config)
  const { rules, scores } = evaluate({ root, config, engine, stateDir, git: gitState(root) })
  const red = engine.graph.edges
    .filter((edge) => edge.class === 'up' || edge.class === 'mutual')
    .sort((a, b) => b.weight - a.weight)
  const siblings = engine.graph.edges.filter((edge) => edge.class === 'sibling')
  const { stats, graph } = engine
  return [
    `# Current state of ${projectLabel(root)} (${root})`,
    '',
    `Config: ${source === 'default' ? `defaults — there is no ${path.join(root, CONFIG_FILE)} yet` : `${source} ${configPath}`}`,
    `Files analysed: ${stats.files} · features: ${stats.features} · imports between files: ${stats.imports} (plus ${stats.typeImports} type-only)`,
    `Feature patterns: ${JSON.stringify(config.features)}`,
    '',
    '## Features and layers',
    ...layersSection(config, engine),
    '',
    `## Red edges (up and mutual): ${red.length}`,
    ...red.slice(0, MAX_EDGES).map(edgeLine),
    ...(red.length > MAX_EDGES ? [`… ${red.length - MAX_EDGES} more`] : []),
    '',
    `## Sibling edges: ${siblings.length}`,
    ...siblings.map((edge) => `- ${edge.from} → ${edge.to} (${edge.weight})`),
    '',
    `## File cycles: ${graph.cycles.length}`,
    ...graph.cycles.map((cycle) => `- ${[...cycle, cycle[0]].join(' → ')}`),
    '',
    '## Rules',
    ...rulesSection(rules),
    '',
    `## Scores: ${scoresLine(scores)}`,
  ].join('\n')
}

export const describeProject = (root: string, overrides: Overrides) => {
  try {
    const state = stateOf(root, projectContext(root, overrides))
    return { ok: true, text: `${CONFIG_REFERENCE}\n${state}\n` }
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error
    const issues = error.issues.map((issue) => `- ${issue}`).join('\n')
    return {
      ok: false,
      text: `${CONFIG_REFERENCE}\n# The config is invalid — fix these first\n\n${issues}\n`,
    }
  }
}
