import path from 'node:path'
import type { EdgeClass, FeatureEdge, HistoryEntry, Violation } from '../shared/types'
import { scopeAnalysis } from '../shared/scope'
import { describeProject } from './describe'
import { isProject } from './discover'
import { docCandidates } from '../shared/docs'
import { analyzeEngine } from './engine'
import { findDoc, parseDoc } from './engine/docs'
import { matchGlob } from './engine/glob'
import { gitState } from './git'
import { analyzeProject, projectContext } from './project'
import type { Overrides } from './project'
import { CONFIG_REFERENCE } from './reference'
import { checkReport } from './report'
import { runCheck } from './rules'
import { historyEntry, recordHistory } from './rules/history'

import { EDGE_CLASSES, MAX_EDGES, MAX_VIOLATIONS } from './mcpTools'
import type { ToolName } from './mcpTools'

/** What each tool of `code-atlas mcp` answers; the catalogue is in mcpTools.ts, the protocol in mcp.ts. */
export type McpContext = { overrides: Overrides; cwd: string; version: string }

export type ToolResult = { content: { type: 'text'; text: string }[]; isError?: boolean }

const MAX_IMPORTS = 10
const MAX_HISTORY = 10
const MAX_CHECK_VIOLATIONS = 20
const MAX_DOC_CHARS = 20_000

class ToolError extends Error {}

type Params = Record<string, unknown>

export const paramsOf = (value: unknown): Params =>
  typeof value === 'object' && value !== null ? (value as Params) : {}

const stringOf = (params: Params, key: string) => {
  const value = params[key]
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') throw new ToolError(`${key} must be a string`)
  return value
}

const limitOf = (params: Params, fallback: number) => {
  const value = params.limit
  if (value === undefined || value === null) return fallback
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1)
    throw new ToolError('limit must be a positive integer')
  return Math.min(value, 500)
}

const rootOf = (ctx: McpContext, params: Params) => {
  const asked = stringOf(params, 'root')
  const root = asked ? path.resolve(ctx.cwd, asked) : ctx.overrides.root
  if (!root)
    throw new ToolError(
      'no project: start the server in a project, with --root, or pass root to the tool',
    )
  if (!isProject(root))
    throw new ToolError(
      `no project at ${root} — expected a folder with package.json and tsconfig.json, or a monorepo root`,
    )
  return root
}

const scoped = (ctx: McpContext, params: Params) => {
  const root = rootOf(ctx, params)
  const analysis = analyzeProject(root, ctx.overrides)
  const pkg = stringOf(params, 'package') ?? null
  if (pkg && !analysis.workspace?.packages.some((info) => info.dir === pkg))
    throw new ToolError(
      `no package ${pkg} — the packages are ${analysis.workspace?.packages.map((info) => info.dir).join(', ') || 'none: this is not a monorepo'}`,
    )
  return { root, analysis: scopeAnalysis(analysis, pkg), whole: analysis }
}

const recent = (history: HistoryEntry[]) =>
  history
    .slice(-MAX_HISTORY)
    .map(({ at, commit, dirty, overall }) => ({ at, commit, dirty, overall }))

const overview = (ctx: McpContext, params: Params) => {
  const { root, analysis, whole } = scoped(ctx, params)
  return {
    root,
    label: analysis.label,
    package: stringOf(params, 'package') ?? null,
    config: { source: analysis.configSource, path: analysis.configPath },
    commit: analysis.commit,
    dirty: analysis.dirty,
    stats: analysis.stats,
    scores: analysis.scores,
    rules: analysis.rules.map((rule) => ({
      id: rule.id,
      family: rule.family,
      severity: rule.severity,
      kind: rule.kind,
      title: rule.title,
      status: rule.status,
      violations: rule.count,
      score: rule.score,
      stale: rule.stale,
      error: rule.error,
    })),
    packages: (whole.workspace?.packages ?? []).map((pkg) => ({
      dir: pkg.dir,
      name: pkg.name,
      overall: pkg.scores.overall,
    })),
    database: analysis.database?.stats ?? null,
    baseline: analysis.baseline
      ? { commit: analysis.baseline.commit, overall: analysis.baseline.scores.overall }
      : null,
    history: recent(analysis.history),
    warnings: analysis.warnings,
  }
}

const violations = (ctx: McpContext, params: Params) => {
  const { analysis } = scoped(ctx, params)
  const ruleId = stringOf(params, 'rule')
  const glob = stringOf(params, 'file')
  const limit = limitOf(params, MAX_VIOLATIONS)
  if (ruleId && !analysis.rules.some((rule) => rule.id === ruleId))
    throw new ToolError(
      `no rule ${ruleId} — the rules are ${analysis.rules.map((rule) => rule.id).join(', ')}`,
    )
  const all = analysis.rules
    .filter((rule) => !ruleId || rule.id === ruleId)
    .flatMap((rule) =>
      rule.violations
        .filter(
          (violation: Violation) => !glob || (violation.file && matchGlob(violation.file, glob)),
        )
        .map((violation) => ({
          rule: rule.id,
          severity: rule.severity,
          file: violation.file,
          line: violation.line,
          message: violation.message,
          ...(violation.package ? { package: violation.package } : {}),
        })),
    )
  return { total: all.length, shown: Math.min(all.length, limit), violations: all.slice(0, limit) }
}

const edgeView = (edge: FeatureEdge) => ({
  from: edge.from,
  to: edge.to,
  class: edge.class,
  imports: edge.weight,
  behind: edge.imports.slice(0, MAX_IMPORTS),
  ...(edge.imports.length > MAX_IMPORTS ? { more: edge.imports.length - MAX_IMPORTS } : {}),
})

const edges = (ctx: McpContext, params: Params) => {
  const { analysis } = scoped(ctx, params)
  const which = stringOf(params, 'graph') ?? 'code'
  if (which !== 'code' && which !== 'database') throw new ToolError('graph is "code" or "database"')
  const kind = stringOf(params, 'class') ?? 'red'
  if (!EDGE_CLASSES.includes(kind as EdgeClass))
    throw new ToolError(`class is one of ${EDGE_CLASSES.join(', ')}`)
  const feature = stringOf(params, 'feature')
  const limit = limitOf(params, MAX_EDGES)
  const graph = which === 'database' ? analysis.database?.graph : analysis.graph
  if (!graph) throw new ToolError('no Drizzle config found: the project has no database graph')
  const kept = graph.edges.filter(
    (edge) =>
      (kind === 'all' ||
        (kind === 'red' ? edge.class === 'up' || edge.class === 'mutual' : edge.class === kind)) &&
      (!feature || edge.from === feature || edge.to === feature),
  )
  return {
    graph: which,
    layers: graph.layers.map((layer, index) => ({ index: index + 1, ...layer })),
    total: kept.length,
    shown: Math.min(kept.length, limit),
    edges: kept.slice(0, limit).map(edgeView),
  }
}

/** A feature's doc as written, or where it was looked for. */
const docOf = (root: string, id: string, templates: readonly string[]) => {
  const found = findDoc(root, id, templates)
  if (!found) return { path: null, lookedFor: docCandidates(id, templates) }
  const { title, description, owner, status } = parseDoc(found.text)
  const cut = found.text.length > MAX_DOC_CHARS
  return {
    path: found.path,
    title,
    description,
    owner,
    status,
    text: cut ? `${found.text.slice(0, MAX_DOC_CHARS)}\n… (cut, read ${found.path})` : found.text,
  }
}

const feature = (ctx: McpContext, params: Params) => {
  const id = stringOf(params, 'id')
  if (!id) throw new ToolError('id is required')
  const { root, analysis } = scoped(ctx, params)
  const node = analysis.graph.features.find((candidate) => candidate.id === id)
  if (!node)
    throw new ToolError(
      `no feature ${id} — the features are ${analysis.graph.features.map((f) => f.id).join(', ')}`,
    )
  return {
    id: node.id,
    layer: node.layer === null ? null : (analysis.graph.layers[node.layer]?.name ?? null),
    files: analysis.files.filter((file) => file.feature === id).map((file) => file.path),
    lines: node.lines,
    afferent: node.ca,
    efferent: node.ce,
    instability: node.instability,
    outgoing: analysis.graph.edges.filter((edge) => edge.from === id).map(edgeView),
    incoming: analysis.graph.edges.filter((edge) => edge.to === id).map(edgeView),
    doc: docOf(root, id, analysis.config.docs),
  }
}

const check = async (ctx: McpContext, params: Params) => {
  const root = rootOf(ctx, params)
  const commands = params.commands === true
  const { config, stateDir } = projectContext(root, ctx.overrides)
  const engine = analyzeEngine(root, config)
  const git = gitState(root)
  const result = await runCheck({
    root,
    config,
    engine,
    stateDir,
    git,
    skipCommands: !commands,
    log: () => {},
  })
  recordHistory(stateDir, historyEntry(result.scores, result.rules, result.packages, git))
  const report = checkReport({ root, engine, git, recording: false, result })
  return {
    ...report,
    rules: report.rules.map((rule) => ({
      ...rule,
      violations: rule.violations.slice(0, MAX_CHECK_VIOLATIONS),
      ...(rule.violations.length > MAX_CHECK_VIOLATIONS
        ? { more: rule.violations.length - MAX_CHECK_VIOLATIONS }
        : {}),
    })),
  }
}

const configTool = (ctx: McpContext, params: Params) => {
  const root = rootOf(ctx, params)
  const { config, source, configPath } = projectContext(root, ctx.overrides)
  return { reference: CONFIG_REFERENCE, source, path: configPath, config }
}

const describe = (ctx: McpContext, params: Params) =>
  describeProject(rootOf(ctx, params), ctx.overrides).text

const text = (value: unknown): ToolResult => ({
  content: [
    { type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) },
  ],
})

const failure = (error: unknown): ToolResult => {
  // A config error's message already lists its issues, one per line.
  const message = error instanceof Error ? error.message : String(error)
  return { content: [{ type: 'text', text: message }], isError: true }
}

export const callTool = async (
  ctx: McpContext,
  name: string,
  params: Params,
): Promise<ToolResult> => {
  try {
    switch (name as ToolName) {
      case 'overview':
        return text(overview(ctx, params))
      case 'violations':
        return text(violations(ctx, params))
      case 'edges':
        return text(edges(ctx, params))
      case 'feature':
        return text(feature(ctx, params))
      case 'check':
        return text(await check(ctx, params))
      case 'config':
        return text(configTool(ctx, params))
      case 'describe':
        return text(describe(ctx, params))
      default:
        return failure(new ToolError(`no tool ${name}`))
    }
  } catch (error) {
    return failure(error)
  }
}
