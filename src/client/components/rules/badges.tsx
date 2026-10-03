import type { Severity } from '../../../shared/config'
import type { RuleStatus } from '../../../shared/types'
import { useT } from '../../i18n'
import { Badge } from '../ui'

const SEVERITY_CLASS: Record<Severity, string> = {
  critical: 'border-sev-critical text-sev-critical',
  high: 'border-sev-high text-sev-high',
  medium: 'border-sev-medium text-sev-medium',
  low: 'border-sev-low text-sev-low',
}

const STATUS_CLASS: Record<RuleStatus, string> = {
  pass: 'border-good-line bg-good-bg text-good',
  fail: 'border-bad-line bg-bad-bg text-bad',
  error: 'border-bad-line bg-bad-bg text-bad',
  'not-run': 'border-line bg-none-bg text-none',
}

export const SeverityBadge = ({ severity }: { severity: Severity }) => {
  const t = useT()
  return <Badge className={SEVERITY_CLASS[severity]}>{t.severity[severity]}</Badge>
}

export const StatusBadge = ({ status }: { status: RuleStatus }) => {
  const t = useT()
  return <Badge className={STATUS_CLASS[status]}>{t.status[status]}</Badge>
}
