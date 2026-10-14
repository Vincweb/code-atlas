import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ResolvedConfig, RuleConfig, RuleKind, StaticRuleConfig } from '../../shared/config'
import { docCandidates } from '../../shared/docs'
import type { EdgeClass, EngineResult, RuleResult, Violation } from '../../shared/types'
import { matchGlob } from '../engine/glob'
import { ownersOf, settle } from './packages'
import type { Owners } from './packages'

/** The titles that do not depend on a rule's settings. */
const FIXED_TITLES: Partial<Record<RuleKind, string>> = {
  layers: 'Layering',
  mutual: 'Mutual dependencies',
  siblings: 'Sibling coupling',
  'no-cycle': 'Import cycles',
  docs: 'Undocumented features',
  'db-layers': 'Database layering',
  'db-mutual': 'Mutual database dependencies',
  'db-siblings': 'Database sibling coupling',
}

export const defaultTitle = (rule: RuleConfig): string => {
  switch (rule.kind) {
    case 'forbid-import':
      return `Forbidden imports ${rule.from} → ${rule.to}`
    case 'max-lines':
      return `Files over ${rule.max} lines`
    case 'complexity':
      return `Functions over complexity ${rule.max}`
    case 'max-params':
      return `Functions over ${rule.max} parameters`
    case 'pattern':
      return `Pattern /${rule.pattern}/`
    case 'command':
      return `\`${rule.run}\``
    case 'ai':
      return rule.prompt.slice(0, 60)
    default:
      return FIXED_TITLES[rule.kind] ?? rule.kind
  }
}

/** The edge classes each database rule reports, over the feature graph of the schema. */
const DB_CLASSES: Record<'db-layers' | 'db-mutual' | 'db-siblings', EdgeClass[]> = {
  'db-layers': ['up'],
  'db-mutual': ['mutual'],
  'db-siblings': ['sibling'],
}

const databaseViolations = (
  rule: Extract<StaticRuleConfig, { kind: keyof typeof DB_CLASSES }>,
  engine: EngineResult,
): Violation[] =>
  engine.database
    ? engine.database.graph.edges
        .filter((edge) => DB_CLASSES[rule.kind].includes(edge.class))
        .flatMap((edge) =>
          edge.imports.map((entry) => ({
            file: entry.file,
            line: entry.line,
            message: `${edge.from} → ${edge.to} (${edge.class}): ${entry.target}`,
          })),
        )
    : []

const SOURCE_FILE = /\.[cm]?[jt]sx?$/

/** One violation per feature without a doc, counted against the package that holds it. */
const docsViolations = (
  rule: Extract<StaticRuleConfig, { kind: 'docs' }>,
  engine: EngineResult,
  templates: readonly string[],
): Violation[] => {
  const missing = new Set(engine.docs.filter((doc) => doc.path === null).map((doc) => doc.id))
  const packageOf = new Map(engine.files.map((file) => [file.feature, file.package]))
  return (
    engine.graph.features
      // A feature a literal pattern names as one file has no folder to hold a doc.
      .filter((feature) => missing.has(feature.id) && !SOURCE_FILE.test(feature.id))
      .filter((feature) => !rule.features || matchGlob(feature.id, rule.features))
      .map((feature) => ({
        file: null,
        line: null,
        message: `${feature.id} has no doc: add ${docCandidates(feature.id, templates)[0] ?? 'one'}`,
        ...(engine.packages.length ? { package: packageOf.get(feature.id) ?? null } : {}),
      }))
  )
}

const inScope = (path: string, files: string | undefined) => !files || matchGlob(path, files)

const edgeViolations = (engine: EngineResult, classes: EdgeClass[]): Violation[] =>
  engine.graph.edges
    .filter((edge) => classes.includes(edge.class))
    .flatMap((edge) =>
      edge.imports.map((entry) => ({
        file: entry.file,
        line: entry.line,
        message: `${edge.from} → ${edge.to} (${edge.class})`,
      })),
    )

const patternViolations = (
  root: string,
  rule: Extract<StaticRuleConfig, { kind: 'pattern' }>,
  engine: EngineResult,
): Violation[] => {
  const flags = [...new Set(`${rule.flags ?? ''}gm`)].join('')
  const violations: Violation[] = []
  for (const file of engine.files) {
    if (!inScope(file.path, rule.files) || (rule.exclude && matchGlob(file.path, rule.exclude)))
      continue
    let text: string
    try {
      text = readFileSync(join(root, file.path), 'utf8')
    } catch {
      continue
    }
    const lineStarts = [0]
    for (let index = text.indexOf('\n'); index !== -1; index = text.indexOf('\n', index + 1))
      lineStarts.push(index + 1)
    const lines = text.split('\n')
    const regexp = new RegExp(rule.pattern, flags)
    for (const match of text.matchAll(regexp)) {
      let low = 0
      let high = lineStarts.length - 1
      while (low < high) {
        const mid = Math.ceil((low + high) / 2)
        if ((lineStarts[mid] ?? 0) <= (match.index ?? 0)) low = mid
        else high = mid - 1
      }
      violations.push({
        file: file.path,
        line: low + 1,
        message: (lines[low] ?? '').trim().slice(0, 160),
      })
    }
  }
  return violations
}

/** The package a cycle counts against: the one that holds all of it, or none. */
const cycleOwner = (cycle: string[], owners: Owners | null) => {
  if (!owners) return {}
  const [first, ...others] = cycle.map((file) => owners.ownerOf(file))
  return { package: others.every((owner) => owner === first) ? (first ?? null) : null }
}

type Project = { root: string; config: ResolvedConfig }

const collect = (
  { root, config }: Project,
  rule: StaticRuleConfig,
  engine: EngineResult,
  owners: Owners | null,
): Violation[] => {
  if (rule.kind === 'db-layers' || rule.kind === 'db-mutual' || rule.kind === 'db-siblings')
    return databaseViolations(rule, engine)
  if (rule.kind === 'docs') return docsViolations(rule, engine, config.docs)
  switch (rule.kind) {
    case 'layers':
      return edgeViolations(engine, ['up'])
    case 'mutual':
      return edgeViolations(engine, ['mutual'])
    case 'siblings':
      return edgeViolations(engine, ['sibling'])
    case 'no-cycle':
      return engine.graph.cycles.map((cycle) => ({
        file: cycle[0] ?? null,
        line: null,
        message: `cycle: ${[...cycle, cycle[0] ?? ''].join(' → ')}`,
        ...cycleOwner(cycle, owners),
      }))
    case 'forbid-import':
      return engine.imports
        .filter(
          (edge) =>
            (rule.types || edge.kind !== 'type') &&
            matchGlob(edge.from, rule.from) &&
            matchGlob(edge.to, rule.to),
        )
        .map((edge) => ({
          file: edge.from,
          line: edge.line,
          message: `${edge.from} → ${edge.to}`,
        }))
    case 'max-lines':
      return engine.files
        .filter((file) => inScope(file.path, rule.files) && file.lines > rule.max)
        .map((file) => ({
          file: file.path,
          line: null,
          message: `${file.lines} lines (max ${rule.max})`,
        }))
    case 'complexity':
      return engine.functions
        .filter((fn) => inScope(fn.file, rule.files) && fn.complexity > rule.max)
        .map((fn) => ({
          file: fn.file,
          line: fn.line,
          message: `${fn.name}: complexity ${fn.complexity} (max ${rule.max})`,
        }))
    case 'max-params':
      return engine.functions
        .filter((fn) => inScope(fn.file, rule.files) && fn.params > rule.max)
        .map((fn) => ({
          file: fn.file,
          line: fn.line,
          message: `${fn.name}: ${fn.params} parameters (max ${rule.max})`,
        }))
    case 'pattern':
      return patternViolations(root, rule, engine)
  }
}

const compare = (a: Violation, b: Violation) =>
  (a.file ?? '').localeCompare(b.file ?? '') || (a.line ?? 0) - (b.line ?? 0)

export const evaluateStatic = (
  root: string,
  config: ResolvedConfig,
  engine: EngineResult,
  commit: string | null,
): RuleResult[] => {
  const owners = ownersOf(engine)
  const results: RuleResult[] = []
  for (const rule of config.rules) {
    if (rule.kind === 'command' || rule.kind === 'ai') continue
    const violations = collect({ root, config }, rule, engine, owners).sort(compare)
    const result: RuleResult = {
      id: rule.id,
      family: rule.family,
      severity: rule.severity,
      kind: rule.kind,
      title: rule.title ?? defaultTitle(rule),
      status: violations.length ? 'fail' : 'pass',
      count: violations.length,
      score: null,
      violations: [],
      ranAt: new Date().toISOString(),
      commit,
      stale: false,
      error: null,
    }
    results.push(settle(rule, result, violations, owners))
  }
  return results
}
