import type { AiRuleConfig, CommandRuleConfig, ResolvedConfig } from '../../shared/config'
import type { Baseline, EngineResult, RuleResult, RunEvent, Scores } from '../../shared/types'
import { runAi } from './ai'
import { runCommand } from './command'
import { notRun } from './result'
import { computeScores } from './score'
import { evaluateStatic } from './static'
import { readBaseline, readRun, writeRun } from './state'

type Git = { commit: string | null; dirty: boolean }

export const evaluate = (opts: {
  root: string
  config: ResolvedConfig
  engine: EngineResult
  stateDir: string
  git: Git
}): { rules: RuleResult[]; scores: Scores; baseline: Baseline | null } => {
  const { root, config, engine, stateDir, git } = opts
  const statics = new Map(evaluateStatic(root, config, engine, git.commit).map((r) => [r.id, r]))
  const rules = config.rules.map((rule): RuleResult => {
    if (rule.kind !== 'command' && rule.kind !== 'ai') return statics.get(rule.id) as RuleResult
    const stored = readRun(stateDir, rule)
    return stored ? { ...stored, stale: stored.commit !== git.commit } : notRun(rule)
  })
  return { rules, scores: computeScores(rules), baseline: readBaseline(stateDir) }
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
      ? await runCommand(root, rule, base)
      : await runAi(root, rule, config, base)
  writeRun(stateDir, rule, result)
  onEvent({ type: 'done', result })
  return result
}

export const makeBaseline = (
  rules: RuleResult[],
  scores: Scores,
  commit: string | null,
): Baseline => ({
  commit,
  savedAt: new Date().toISOString(),
  scores,
  violations: Object.fromEntries(
    rules
      .filter((rule) => rule.kind !== 'ai' && (rule.status === 'pass' || rule.status === 'fail'))
      .map((rule) => [rule.id, rule.count]),
  ),
})

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
  regressions: { id: string; before: number; after: number }[]
}> => {
  const { root, config, engine, stateDir, git, skipCommands, recording = false, log } = opts
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
    rules.push(
      await runRule({
        root,
        config,
        rule,
        stateDir,
        commit: git.commit,
        onEvent: () => {},
      }),
    )
  }
  const scores = computeScores(rules)
  const baseline = readBaseline(stateDir)
  const regressions = rules.flatMap((rule) => {
    if (rule.status !== 'pass' && rule.status !== 'fail') return []
    const before = baseline?.violations[rule.id] ?? 0
    return rule.count > before ? [{ id: rule.id, before, after: rule.count }] : []
  })
  const errored = rules.some((rule) => rule.kind === 'command' && rule.status === 'error')
  const countOf = (rule: RuleResult) =>
    recording ? `${rule.count}` : `${rule.count} (baseline ${baseline?.violations[rule.id] ?? 0})`
  report(rules, scores, countOf, log)
  const ok = regressions.length === 0 && !errored
  if (!recording)
    log(
      ok
        ? '✓ No regression'
        : `✗ ${regressions.length} regression(s)${errored ? ', a command could not run' : ''}`,
    )
  return { ok, rules, scores, regressions }
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
