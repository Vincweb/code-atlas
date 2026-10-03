import type { AiRuleConfig, CommandRuleConfig } from '../../shared/config'
import type { RuleResult, Violation } from '../../shared/types'
import { defaultTitle } from './static'

export const finishRun = (
  rule: CommandRuleConfig | AiRuleConfig,
  commit: string | null,
  outcome: {
    violations?: Violation[]
    costUsd?: number | null
    error?: string | null
    ok?: boolean
  },
): RuleResult => {
  const violations = outcome.violations ?? []
  const error = outcome.error ?? null
  return {
    id: rule.id,
    family: rule.family,
    severity: rule.severity,
    kind: rule.kind,
    title: rule.title ?? defaultTitle(rule),
    status: error ? 'error' : violations.length || outcome.ok === false ? 'fail' : 'pass',
    count: violations.length,
    violations: violations.slice(0, 500),
    ranAt: new Date().toISOString(),
    commit,
    stale: false,
    costUsd: outcome.costUsd ?? null,
    error,
  }
}

export const notRun = (rule: CommandRuleConfig | AiRuleConfig): RuleResult => ({
  ...finishRun(rule, null, {}),
  status: 'not-run',
  ranAt: null,
})

export const spawnEnv = (drop: (key: string) => boolean): NodeJS.ProcessEnv =>
  Object.fromEntries(Object.entries(process.env).filter(([key]) => !drop(key)))

export const killTree = (pid: number | undefined, fallback: () => void) => {
  if (pid !== undefined && process.platform !== 'win32') {
    try {
      process.kill(-pid, 'SIGKILL')
      return
    } catch {
      // the group is already gone
    }
  }
  fallback()
}
