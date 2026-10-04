import type { RuleResult } from '../../../shared/types'
import { ruleScore } from '../../../shared/score'

export type StatusFilter = 'all' | 'fail' | 'pass' | 'pending'

const ORDER: Record<RuleResult['status'], number> = { fail: 0, error: 1, 'not-run': 2, pass: 3 }

export const sortRules = (rules: RuleResult[]) =>
  [...rules].sort(
    (a, b) =>
      ORDER[a.status] - ORDER[b.status] ||
      ruleScore(a.severity, a.count) - ruleScore(b.severity, b.count),
  )

export const matchesStatus = (rule: RuleResult, filter: StatusFilter) => {
  if (filter === 'all') return true
  if (filter === 'fail') return rule.status === 'fail' || rule.status === 'error'
  if (filter === 'pass') return rule.status === 'pass'
  return rule.status === 'not-run'
}

export type FileGroup = { file: string | null; items: RuleResult['violations'] }

export const groupByFile = (violations: RuleResult['violations']): FileGroup[] => {
  const groups = new Map<string, FileGroup>()
  for (const violation of violations) {
    const key = violation.file ?? ''
    const group = groups.get(key) ?? { file: violation.file, items: [] }
    group.items.push(violation)
    groups.set(key, group)
  }
  return [...groups.values()].sort((a, b) => b.items.length - a.items.length)
}
