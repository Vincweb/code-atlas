import type { AiRuleConfig, CommandRuleConfig } from '../../shared/config'
import { ruleScore } from '../../shared/score'
import type { RuleResult, Violation } from '../../shared/types'
import { defaultTitle } from './static'

export const finishRun = (
  rule: CommandRuleConfig | AiRuleConfig,
  commit: string | null,
  outcome: {
    violations?: Violation[]
    error?: string | null
    ok?: boolean
  },
): RuleResult => {
  const violations = outcome.violations ?? []
  const error = outcome.error ?? null
  const status = error ? 'error' : violations.length || outcome.ok === false ? 'fail' : 'pass'
  return {
    id: rule.id,
    family: rule.family,
    severity: rule.severity,
    kind: rule.kind,
    title: rule.title ?? defaultTitle(rule),
    status,
    count: violations.length,
    score: status === 'error' ? null : ruleScore(rule.severity, violations.length),
    violations: violations.slice(0, 500),
    ranAt: new Date().toISOString(),
    commit,
    stale: false,
    error,
  }
}

export const notRun = (rule: CommandRuleConfig | AiRuleConfig): RuleResult => ({
  ...finishRun(rule, null, {}),
  status: 'not-run',
  score: null,
  ranAt: null,
})
