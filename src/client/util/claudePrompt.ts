/** Installs code-atlas as an MCP server of the project, for every Claude Code session on it. */
export const MCP_INSTALL = 'claude mcp add -s project code-atlas -- npx -y @vincweb/code-atlas mcp'

import { CONFIG_FILE } from '../../shared/config'
import { isRed } from '../../shared/graph'
import type { Analysis, RuleResult } from '../../shared/types'
import type { Strings } from '../i18n'

const LINK_LIMIT = 5000
const MAX_RED = 10

const contextOf = (analysis: Analysis, t: Strings, redCount: number) => {
  const words = t.configHelp.context
  const { graph, scores } = analysis
  const layers = graph.layers.length
    ? graph.layers
        .map(
          (layer, index) =>
            `${layer.name} (${graph.features.filter((f) => f.layer === index).length})`,
        )
        .join(', ')
    : words.noLayers
  const unlayered = graph.layers.length
    ? graph.features.filter((f) => f.layer === null).map((f) => f.id)
    : []
  const red = graph.edges.filter((edge) => isRed(edge.class)).sort((a, b) => b.weight - a.weight)
  const redList = red
    .slice(0, redCount)
    .map((edge) => `${edge.from} → ${edge.to} (${t.edgeClass[edge.class]}, ${edge.weight})`)
    .join(' ; ')
  const scoreLine = [
    ...scores.families.map((f) => `${t.families[f.family] ?? f.family} ${f.score ?? '–'}`),
  ].join(' · ')
  const database = analysis.database
  return [
    words.features(graph.features.length, layers),
    ...(unlayered.length ? [words.unlayered(unlayered.join(', '))] : []),
    red.length ? words.red(red.length, redList) : words.noRed,
    ...(database
      ? [
          words.database(
            database.stats.tables,
            database.stats.features,
            database.graph.edges.filter((e) => isRed(e.class)).length,
          ),
        ]
      : []),
    words.scores(scoreLine),
  ].join('\n')
}

export const configPrompt = (analysis: Analysis, t: Strings) => {
  const exists = analysis.configSource !== 'default'
  const target = analysis.configPath ?? `${analysis.root}/${CONFIG_FILE}`
  const build = (redCount: number) =>
    t.configHelp.claudePrompt({
      root: analysis.root,
      target,
      exists,
      describe: analysis.describeCommand,
      context: contextOf(analysis, t, redCount),
    })
  for (let count = MAX_RED; count > 0; count--) {
    const prompt = build(count)
    if (prompt.length <= LINK_LIMIT) return prompt
  }
  return build(0)
}

export const auditPrompt = (analysis: Analysis, t: Strings) =>
  t.audits.createPrompt(analysis.root, analysis.describeCommand)

const MAX_LISTED = 60

export const fixPrompt = (analysis: Analysis, rule: RuleResult, title: string, t: Strings) => {
  const lesson = t.learn.kinds[rule.kind]
  const build = (listed: number) => {
    const lines = rule.violations
      .slice(0, listed)
      .map((v) => `- ${v.file ? `${v.file}${v.line ? `:${v.line}` : ''} — ` : ''}${v.message}`)
    if (rule.count > listed) lines.push(`- … ${rule.count - listed}`)
    return t.rules.fixPrompt({
      root: analysis.root,
      id: rule.id,
      title,
      what: lesson?.what ?? '',
      fix: lesson?.fix ?? '',
      describe: analysis.describeCommand,
      count: rule.count,
      list: lines.join('\n'),
    })
  }
  for (let listed = Math.min(MAX_LISTED, rule.violations.length); listed > 0; listed--) {
    const prompt = build(listed)
    if (prompt.length <= LINK_LIMIT) return prompt
  }
  return build(0)
}
