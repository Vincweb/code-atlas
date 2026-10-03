import type { RuleConfig } from '../../shared/config'
import type { RuleResult } from '../../shared/types'
import type { Strings } from '../i18n'

export const ruleTitle = (rule: RuleResult, rules: RuleConfig[], t: Strings) => {
  const configured = rules.find((candidate) => candidate.id === rule.id)
  if (!configured) return rule.title
  if (configured.title) return configured.title
  const titles = t.ruleTitles
  switch (configured.kind) {
    case 'layers':
      return titles.layers
    case 'mutual':
      return titles.mutual
    case 'siblings':
      return titles.siblings
    case 'no-cycle':
      return titles.noCycle
    case 'forbid-import':
      return titles.forbid(configured.from, configured.to)
    case 'max-lines':
      return titles.maxLines(configured.max)
    case 'complexity':
      return titles.complexity(configured.max)
    case 'max-params':
      return titles.maxParams(configured.max)
    case 'pattern':
      return titles.pattern(configured.pattern)
    case 'command':
      return rule.title
    case 'ai':
      if (configured.id === 'AI-ARCH') return titles.aiArch
      if (configured.id === 'AI-CLEAN') return titles.aiClean
      return rule.title
  }
}
