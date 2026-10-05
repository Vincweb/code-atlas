import type {
  AiRuleConfig,
  CommandRuleConfig,
  ResolvedConfig,
  RuleConfig,
} from '../../shared/config'
import { packageRules } from '../../shared/packages'
import type {
  Baseline,
  EngineResult,
  PackageBaseline,
  RuleResult,
  RunEvent,
  Scores,
} from '../../shared/types'
import { workspaceMembers } from '../engine/workspace'
import { runAi } from './ai'
import { runCommand } from './command'
import { ownersOf, settle } from './packages'
import type { Owners } from './packages'
import { notRun } from './result'
import { computeScores } from './score'
import { evaluateStatic } from './static'
import { readBaseline, readRun, writeRun } from './state'

type Git = { commit: string | null; dirty: boolean }

export type PackageScores = { dir: string; scores: Scores }

/** The scores of each package, from the rules as that package sees them. */
const scoresByPackage = (rules: RuleResult[], owners: Owners | null): PackageScores[] =>
  (owners?.dirs ?? []).map((dir) => ({ dir, scores: computeScores(packageRules(rules, dir)) }))

/** A run's result as of this analysis: its violations owned by packages, its score recomputed. */
const settleRun = (rule: RuleConfig, result: RuleResult, owners: Owners | null) =>
  settle(rule, result, result.violations, owners)

export const evaluate = (opts: {
  root: string
  config: ResolvedConfig
  engine: EngineResult
  stateDir: string
  git: Git
}): {
  rules: RuleResult[]
  scores: Scores
  packages: PackageScores[]
  baseline: Baseline | null
} => {
  const { root, config, engine, stateDir, git } = opts
  const owners = ownersOf(engine)
  const statics = new Map(evaluateStatic(root, config, engine, git.commit).map((r) => [r.id, r]))
  const rules = config.rules.map((rule): RuleResult => {
    if (rule.kind !== 'command' && rule.kind !== 'ai') return statics.get(rule.id) as RuleResult
    const stored = readRun(stateDir, rule)
    return settleRun(
      rule,
      stored ? { ...stored, stale: stored.commit !== git.commit } : notRun(rule),
      owners,
    )
  })
  return {
    rules,
    scores: computeScores(rules),
    packages: scoresByPackage(rules, owners),
    baseline: readBaseline(stateDir),
  }
}

export const runRule = async (opts: {
  root: string
  config: ResolvedConfig
  rule: CommandRuleConfig | AiRuleConfig
  stateDir: string
  commit: string | null
  onEvent: (e: RunEvent) => void
  signal?: AbortSignal
}): Promise<RuleResult> => {
  const { root, config, rule, stateDir, commit, onEvent, signal } = opts
  onEvent({ type: 'start', rule: rule.id, kind: rule.kind, at: new Date().toISOString() })
  const base = { commit, onEvent, ...(signal ? { signal } : {}) }
  const result =
    rule.kind === 'command'
      ? await runCommand(root, rule, {
          ...base,
          packages: workspaceMembers(root, config.workspaces, config.tsconfig),
        })
      : await runAi(root, rule, config, base)
  writeRun(stateDir, rule, result)
  onEvent({ type: 'done', result })
  return result
}

const countsOf = (rules: RuleResult[]) =>
  Object.fromEntries(
    rules
      .filter((rule) => rule.kind !== 'ai' && (rule.status === 'pass' || rule.status === 'fail'))
      .map((rule) => [rule.id, rule.count]),
  )

export const makeBaseline = (
  rules: RuleResult[],
  scores: Scores,
  commit: string | null,
  packages: PackageScores[] = [],
): Baseline => ({
  commit,
  savedAt: new Date().toISOString(),
  scores,
  violations: countsOf(rules),
  ...(packages.length
    ? {
        packages: Object.fromEntries(
          packages.map(({ dir, scores: own }): [string, PackageBaseline] => [
            dir,
            { scores: own, violations: countsOf(packageRules(rules, dir)) },
          ]),
        ),
      }
    : {}),
})

type Regression = { id: string; package?: string; before: number; after: number }

/** Every count above the baseline's: the whole repository's, then each package's it recorded. */
const regressionsOf = (
  rules: RuleResult[],
  baseline: Baseline | null,
  packages: PackageScores[],
): Regression[] => {
  const ran = rules.filter((rule) => rule.status === 'pass' || rule.status === 'fail')
  const global = ran.flatMap((rule) => {
    const before = baseline?.violations[rule.id] ?? 0
    return rule.count > before ? [{ id: rule.id, before, after: rule.count }] : []
  })
  const recorded = baseline?.packages
  if (!recorded) return global
  const own = packages.flatMap(({ dir }) =>
    packageRules(ran, dir).flatMap((rule) => {
      const before = recorded[dir]?.violations[rule.id] ?? 0
      return rule.count > before ? [{ id: rule.id, package: dir, before, after: rule.count }] : []
    }),
  )
  return [...global, ...own]
}

export const runCheck = async (opts: {
  root: string
  config: ResolvedConfig
  engine: EngineResult
  stateDir: string
  git: Git
  skipCommands: boolean
  /** The run is about to become the baseline: report the counts, not a verdict against the old one. */
  recording?: boolean
  log: (line: string) => void
}): Promise<{
  ok: boolean
  rules: RuleResult[]
  scores: Scores
  packages: PackageScores[]
  regressions: Regression[]
}> => {
  const { root, config, engine, stateDir, git, skipCommands, recording = false, log } = opts
  const owners = ownersOf(engine)
  const statics = new Map(evaluateStatic(root, config, engine, git.commit).map((r) => [r.id, r]))
  const rules: RuleResult[] = []
  for (const rule of config.rules) {
    if (rule.kind === 'ai') continue
    if (rule.kind !== 'command') {
      rules.push(statics.get(rule.id) as RuleResult)
      continue
    }
    if (skipCommands) continue
    log(`… ${rule.id} ${rule.run}`)
    const result = await runRule({
      root,
      config,
      rule,
      stateDir,
      commit: git.commit,
      onEvent: () => {},
    })
    rules.push(settleRun(rule, result, owners))
  }
  const scores = computeScores(rules)
  const packages = scoresByPackage(rules, owners)
  const baseline = readBaseline(stateDir)
  const regressions = regressionsOf(rules, baseline, packages)
  const errored = rules.some((rule) => rule.kind === 'command' && rule.status === 'error')
  const countOf = (rule: RuleResult) =>
    recording ? `${rule.count}` : `${rule.count} (baseline ${baseline?.violations[rule.id] ?? 0})`
  report(rules, scores, countOf, log)
  reportPackages(engine, packages, log)
  if (!recording)
    for (const regression of regressions.filter((r) => r.package !== undefined))
      log(
        `  ✗ ${regression.package}: ${regression.id} ${regression.after} (baseline ${regression.before})`,
      )
  const ok = regressions.length === 0 && !errored
  if (!recording)
    log(
      ok
        ? '✓ No regression'
        : `✗ ${regressions.length} regression(s)${errored ? ', a command could not run' : ''}`,
    )
  return { ok, rules, scores, packages, regressions }
}

const reportPackages = (
  engine: EngineResult,
  packages: PackageScores[],
  log: (line: string) => void,
) => {
  if (!packages.length) return
  log('packages:')
  for (const { dir, scores } of packages) {
    const name = engine.packages.find((pkg) => pkg.dir === dir)?.name ?? dir
    log(`  ${name} (${dir}): ${scores.overall ?? '—'}`)
  }
}

const report = (
  rules: RuleResult[],
  scores: Scores,
  countOf: (rule: RuleResult) => string,
  log: (line: string) => void,
) => {
  for (const family of scores.families) {
    log(`${family.family}: ${family.score ?? '—'}`)
    for (const rule of rules.filter((r) => r.family === family.family)) {
      if (rule.status === 'error') log(`  ✗ ${rule.id} ${rule.title} — error: ${rule.error}`)
      else if (rule.status === 'fail') log(`  ✗ ${rule.id} ${rule.title} — ${countOf(rule)}`)
      else if (rule.status === 'pass') log(`  ✓ ${rule.id} ${rule.title}`)
    }
  }
  log(`overall: ${scores.overall ?? '—'}`)
}
