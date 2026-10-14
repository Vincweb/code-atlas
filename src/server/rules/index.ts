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
  Regression,
  RuleResult,
  RunEvent,
  Scores,
} from '../../shared/types'
import { workspaceMembers } from '../engine/workspace'
import { isDbKind } from '../../shared/config'
import { runAi } from './ai'
import { regressionsOf } from './baseline'
import { logCheck } from './checkLog'
import { runCommand } from './command'
import { ownersOf, settle } from './packages'
import type { Owners } from './packages'
import { notRun } from './result'
import { computeScores } from './score'
import type { PackageScores } from './score'
import { evaluateStatic } from './static'
import { readBaseline, readRun, writeRun } from './state'

export { isNewToBaseline, makeBaseline } from './baseline'
export type { PackageScores } from './score'

type Git = { commit: string | null; dirty: boolean }

/** The scores of each package, from the rules as that package sees them. */
const scoresByPackage = (rules: RuleResult[], owners: Owners | null): PackageScores[] =>
  (owners?.dirs ?? []).map((dir) => ({ dir, scores: computeScores(packageRules(rules, dir)) }))

/** A run's result as of this analysis: its violations owned by packages, its score recomputed. */
const settleRun = (rule: RuleConfig, result: RuleResult, owners: Owners | null) =>
  settle(rule, result, result.violations, owners)

/** Who owns what in a monorepo, and every static rule's result by id: once per analysis. */
const staticsOf = (
  project: { root: string; config: ResolvedConfig; commit: string | null },
  engine: EngineResult,
) => {
  const owners = ownersOf(engine)
  const results = evaluateStatic(project, engine, owners)
  return { owners, statics: new Map(results.map((result) => [result.id, result])) }
}

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
  const { owners, statics } = staticsOf({ root, config, commit: git.commit }, engine)
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
  // A cancelled run found nothing worth keeping: the previous result stays.
  if (!signal?.aborted) writeRun(stateDir, rule, result)
  onEvent({ type: 'done', result })
  return result
}

type CheckOptions = {
  root: string
  config: ResolvedConfig
  engine: EngineResult
  stateDir: string
  git: Git
  skipCommands: boolean
  /** The run is about to become the baseline: report the counts, not a verdict against the old one. */
  recording?: boolean
  log: (line: string) => void
}

/** The rules --check gates on: the static ones of this analysis, and each command run now. */
const gatedRules = async (
  opts: CheckOptions,
  owners: Owners | null,
  statics: Map<string, RuleResult>,
): Promise<RuleResult[]> => {
  const { root, config, stateDir, git, skipCommands, log } = opts
  const rules: RuleResult[] = []
  for (const rule of config.rules) {
    // AI runs disagree between two runs; database rules are in beta. Neither gates.
    if (rule.kind === 'ai' || isDbKind(rule.kind)) continue
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
  return rules
}

export const runCheck = async (
  opts: CheckOptions,
): Promise<{
  ok: boolean
  rules: RuleResult[]
  scores: Scores
  packages: PackageScores[]
  regressions: Regression[]
  baseline: Baseline | null
}> => {
  const { root, config, engine, stateDir, git, recording = false, log } = opts
  const { owners, statics } = staticsOf({ root, config, commit: git.commit }, engine)
  const rules = await gatedRules(opts, owners, statics)
  const scores = computeScores(rules)
  const packages = scoresByPackage(rules, owners)
  const baseline = readBaseline(stateDir)
  const regressions = regressionsOf(rules, baseline, packages)
  const errored = rules.some((rule) => rule.kind === 'command' && rule.status === 'error')
  logCheck({ engine, rules, scores, packages, regressions, baseline, errored, recording }, log)
  return {
    ok: regressions.length === 0 && !errored,
    rules,
    scores,
    packages,
    regressions,
    baseline,
  }
}
