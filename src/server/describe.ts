import path from 'path'
import { CONFIG_FILE } from '../shared/config'
import type { ResolvedConfig } from '../shared/config'
import type {
  DatabaseResult,
  EngineResult,
  FeatureEdge,
  HistoryEntry,
  RuleResult,
  Scores,
} from '../shared/types'
import { ConfigError } from './config'
import { projectLabel } from './discover'
import { analyzeEngine } from './engine'
import { gitState } from './git'
import { projectContext } from './project'
import type { Overrides } from './project'
import { CONFIG_REFERENCE } from './reference'
import { evaluate } from './rules'
import type { PackageScores } from './rules'
import { readHistory } from './rules/history'

const MAX_EDGES = 40
const MAX_IMPORTS = 3

const edgeLine = (edge: FeatureEdge, noun = 'import') =>
  [
    `- ${edge.from} → ${edge.to} (${edge.class}, ${edge.weight} ${noun}${edge.weight === 1 ? '' : 's'})`,
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

const MAX_DOCS = 60

/** Each feature's doc: where it is, and what it says the feature is for. */
const docsSection = (engine: EngineResult, templates: readonly string[]) => {
  const ids = new Set(engine.graph.features.map((feature) => feature.id))
  const docs = engine.docs.filter((doc) => ids.has(doc.id))
  const documented = docs.filter((doc) => doc.path !== null).length
  return [
    `## Feature docs: ${documented} of ${docs.length} features documented (looked for ${templates.join(', ')})`,
    ...docs
      .slice(0, MAX_DOCS)
      .map((doc) =>
        doc.path
          ? `- ${doc.id}: ${doc.path}${doc.description ? ` — ${doc.description}` : ''}`
          : `- ${doc.id}: none`,
      ),
    ...(docs.length > MAX_DOCS ? [`… ${docs.length - MAX_DOCS} more`] : []),
  ]
}

const databaseSection = (database: DatabaseResult | null) => {
  if (!database) return ['## Database: no Drizzle config found']
  const chosen = database.configs.find((config) => config.chosen)
  const red = database.graph.edges.filter((edge) => edge.class === 'up' || edge.class === 'mutual')
  const siblings = database.graph.edges.filter((edge) => edge.class === 'sibling')
  const { stats } = database
  return [
    `## Database: ${stats.tables} tables in ${stats.features} features, ${stats.junctions} junction tables, ${stats.foreignKeys} foreign keys`,
    `Drizzle config: ${chosen?.path ?? '—'} (schema: ${chosen?.schema.join(', ') || '—'}; migrations: ${database.migrations ? `${database.migrations.count}, Drizzle Kit ${database.migrations.layout}` : 'none'})`,
    `Features grouped by: ${database.featuresSource === 'config' ? 'database.features in the config' : 'the first word of each table name (set database.features to correct)'}`,
    ...database.graph.features.map(
      (feature) =>
        `- ${feature.id} (${feature.files} tables)${
          feature.layer === null ? '' : `, layer ${feature.layer + 1}`
        }`,
    ),
    `Red foreign-key edges (up and mutual): ${red.length}`,
    ...red.slice(0, MAX_EDGES).map((edge) => edgeLine(edge, 'foreign key')),
    `Sibling foreign-key edges: ${siblings.length}`,
    ...siblings.map((edge) => `- ${edge.from} → ${edge.to} (${edge.weight})`),
    `Junction tables: ${
      database.tables
        .filter((table) => table.junction)
        .map((table) => table.id)
        .join(', ') || 'none'
    }`,
  ]
}

const rulesSection = (rules: RuleResult[]) =>
  rules.map((rule) => {
    const state =
      rule.status === 'pass' || rule.status === 'fail'
        ? `${rule.count} violation${rule.count === 1 ? '' : 's'}`
        : rule.status
    return `- ${rule.id} (${rule.kind}, ${rule.severity}): ${state}`
  })

const MAX_PACKAGES_PER_RULE = 5

/** Each package's scores, and where the failing rules' violations sit. */
const packagesSection = (engine: EngineResult, rules: RuleResult[], packages: PackageScores[]) => {
  if (!packages.length) return []
  const nameOf = (dir: string) => engine.packages.find((pkg) => pkg.dir === dir)?.name ?? dir
  const filesOf = (dir: string) => engine.files.filter((file) => file.package === dir).length
  const spread = rules.flatMap((rule) => {
    const counts = Object.entries(rule.packages ?? {})
      .filter(([, count]) => count > 0)
      .sort(([, a], [, b]) => b - a)
    if (!counts.length) return []
    const shown = counts.slice(0, MAX_PACKAGES_PER_RULE).map(([dir, n]) => `${dir} ${n}`)
    const more = counts.length > MAX_PACKAGES_PER_RULE ? ', …' : ''
    return [`- ${rule.id}: ${shown.join(', ')}${more}`]
  })
  return [
    `## Packages: ${packages.length} — each scored on its own violations; the repository's scores are their line-weighted mean`,
    ...[...packages]
      .sort((a, b) => (a.scores.overall ?? 101) - (b.scores.overall ?? 101))
      .map(
        ({ dir, scores }) =>
          `- ${nameOf(dir)} (${dir}, ${filesOf(dir)} files): ${scoresLine(scores)}`,
      ),
    '',
    '## Violations by package',
    ...(spread.length ? spread : ['- none']),
    '',
  ]
}

const MAX_HISTORY = 8

/** The overall score of the last recorded analyses, oldest first: the direction, in one line. */
const historySection = (history: HistoryEntry[]) => {
  if (history.length < 2)
    return ['## History: not enough yet — the page and --check record one point per commit']
  const recent = history.slice(-MAX_HISTORY)
  return [
    `## History (overall score of the last ${recent.length} recorded commits, oldest first): ${recent
      .map((entry) => entry.overall ?? '—')
      .join(' → ')}`,
    ...recent.map(
      (entry) =>
        `- ${entry.at.slice(0, 10)} ${entry.commit?.slice(0, 7) ?? 'no commit'}${entry.dirty ? ' (dirty)' : ''}: ${entry.overall ?? '—'}`,
    ),
  ]
}

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
  const { rules, scores, packages } = evaluate({
    root,
    config,
    engine,
    stateDir,
    git: gitState(root),
  })
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
    ...docsSection(engine, config.docs),
    '',
    `## Red edges (up and mutual): ${red.length}`,
    ...red.slice(0, MAX_EDGES).map((edge) => edgeLine(edge)),
    ...(red.length > MAX_EDGES ? [`… ${red.length - MAX_EDGES} more`] : []),
    '',
    `## Sibling edges: ${siblings.length}`,
    ...siblings.map((edge) => `- ${edge.from} → ${edge.to} (${edge.weight})`),
    '',
    `## File cycles: ${graph.cycles.length}`,
    ...graph.cycles.map((cycle) => `- ${[...cycle, cycle[0]].join(' → ')}`),
    '',
    ...databaseSection(engine.database),
    '',
    '## Rules',
    ...rulesSection(rules),
    '',
    ...packagesSection(engine, rules, packages),
    `## Scores: ${scoresLine(scores)}`,
    '',
    ...historySection(readHistory(stateDir)),
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
