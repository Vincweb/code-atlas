import { ruleScore } from './score'
import type { RuleResult } from './types'

/** The package a path belongs to: the deepest package folder that holds it. */
export const packageOf = (path: string, dirs: readonly string[]): string | null => {
  let best: string | null = null
  for (const dir of dirs)
    if ((path === dir || path.startsWith(`${dir}/`)) && (!best || dir.length > best.length))
      best = dir
  return best
}

/** A rule without its monorepo breakdown. */
export const withoutPackages = (rule: RuleResult): RuleResult => {
  const own = { ...rule }
  delete own.packages
  delete own.unattributed
  return own
}

/** The rules as one package sees them: those that apply to it, with its own violations only. */
export const packageRules = (rules: RuleResult[], dir: string): RuleResult[] =>
  rules.flatMap((rule) => {
    const count = rule.packages?.[dir]
    if (count === undefined) return []
    const ran = rule.status === 'pass' || rule.status === 'fail'
    return [
      {
        ...withoutPackages(rule),
        status: ran ? (count > 0 ? 'fail' : 'pass') : rule.status,
        count,
        score: ran ? ruleScore(rule.severity, count) : null,
        violations: rule.violations.filter((violation) => violation.package === dir),
      },
    ]
  })
