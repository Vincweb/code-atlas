import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ResolvedConfig, RuleConfig, StaticRuleConfig } from '../../shared/config'
import type { EdgeClass, EngineResult, RuleResult, Violation } from '../../shared/types'
import { matchGlob } from '../glob'

const MAX_VIOLATIONS = 500

export const defaultTitle = (rule: RuleConfig): string => {
  switch (rule.kind) {
    case 'layers':
      return 'Layering'
    case 'mutual':
      return 'Mutual dependencies'
    case 'siblings':
      return 'Sibling coupling'
    case 'no-cycle':
      return 'Import cycles'
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
  }
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

const collect = (root: string, rule: StaticRuleConfig, engine: EngineResult): Violation[] => {
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
  const results: RuleResult[] = []
  for (const rule of config.rules) {
    if (rule.kind === 'command' || rule.kind === 'ai') continue
    const violations = collect(root, rule, engine).sort(compare)
    results.push({
      id: rule.id,
      family: rule.family,
      severity: rule.severity,
      kind: rule.kind,
      title: rule.title ?? defaultTitle(rule),
      status: violations.length ? 'fail' : 'pass',
      count: violations.length,
      violations: violations.slice(0, MAX_VIOLATIONS),
      ranAt: new Date().toISOString(),
      commit,
      stale: false,
      costUsd: null,
      error: null,
    })
  }
  return results
}
