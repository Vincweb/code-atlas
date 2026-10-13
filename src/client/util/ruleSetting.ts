import type { RuleConfig } from '../../shared/config'
import type { ResolvedConfig } from '../../shared/config'
import type { Strings } from '../i18n'

export const ruleSetting = (rule: RuleConfig, config: ResolvedConfig, t: Strings) => {
  const params = t.configHelp.params
  switch (rule.kind) {
    case 'max-lines':
      return params.maxLines(rule.max)
    case 'complexity':
      return params.complexity(rule.max)
    case 'max-params':
      return params.maxParams(rule.max)
    case 'pattern':
      return `/${rule.pattern}/${rule.files ? ` · ${rule.files}` : ''}`
    case 'forbid-import':
      return `${rule.from} → ${rule.to}`
    case 'command':
      return rule.run
    case 'ai':
      return rule.model ?? config.ai.model
    default:
      return null
  }
}
