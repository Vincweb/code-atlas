import { useState } from 'react'
import type { AiRuleConfig } from '../../../shared/config'
import { projectPath } from '../../../shared/routes'
import type { Analysis, AuditPreview, RuleResult } from '../../../shared/types'
import { useT } from '../../i18n'
import { formatUsd, relativeTime } from '../../util/format'
import { BAND_TEXT, bandOf } from '../../util/score'
import { ruleScore } from '../../../shared/score'
import { Link } from '../Link'
import { SeverityBadge, StatusBadge } from '../rules/badges'
import { Violations } from '../rules/Violations'
import { ClaudeActions } from '../ClaudeActions'
import { fixPrompt } from '../../util/claudePrompt'
import { AuditProgress } from './AuditProgress'
import { hasOutput } from '../rules/useRunner'
import type { RunState } from '../rules/useRunner'
import { Badge, Button } from '../ui'

const shellQuote = (arg: string) =>
  /^[\w@%+=:,./-]+$/.test(arg) ? arg : `'${arg.replace(/'/g, `'\\''`)}'`

const AuditScore = ({ result }: { result: RuleResult | undefined }) => {
  const ran = result?.status === 'pass' || result?.status === 'fail'
  const score = ran ? ruleScore(result.severity, result.count) : null
  return (
    <span className={`text-[18px] font-semibold tabular-nums ${BAND_TEXT[bandOf(score)]}`}>
      {score ?? '–'}
    </span>
  )
}

type Props = {
  analysis: Analysis
  preview: AuditPreview
  rule: AiRuleConfig
  result: RuleResult | undefined
  title: string
  root: string
  state: RunState | undefined
  locked: boolean
  onRun: () => void
  onCancel: () => void
}

/** The model, the spending cap, the last run and its cost. */
const AuditFacts = ({
  preview,
  result,
}: {
  preview: AuditPreview
  result: RuleResult | undefined
}) => {
  const t = useT()
  const help = t.audits
  const ran = result?.status === 'pass' || result?.status === 'fail'
  return (
    <p className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
      <span>
        {help.model} · <span className="font-mono text-text">{preview.model}</span>
      </span>
      <span>
        {help.cap} · <span className="text-text">{formatUsd(preview.budgetUsd)}</span>
      </span>
      <span>
        {result?.ranAt ? help.lastRun(relativeTime(result.ranAt, t.locale)) : help.neverRun}
        {typeof result?.costUsd === 'number' && ` · ${formatUsd(result.costUsd)}`}
      </span>
      {ran && <span>{t.rules.violations(result.count)}</span>}
    </p>
  )
}

const AuditFindings = ({
  analysis,
  result,
  title,
}: {
  analysis: Analysis
  result: RuleResult
  title: string
}) => {
  const t = useT()
  const help = t.audits
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[12px] font-semibold text-muted">{help.findingsTitle}</span>
      {result.violations.length === 0 ? (
        <p className="rounded-lg border border-good-line bg-good-bg px-3 py-2 text-good">
          {help.noFindings}
        </p>
      ) : (
        <>
          <Violations rule={result} />
          <div className="flex flex-col gap-2 rounded-xl border border-line bg-bg p-3">
            <span className="font-semibold">{t.rules.fixTitle}</span>
            <ClaudeActions prompt={fixPrompt(analysis, result, title, t)} cwd={analysis.root} />
          </div>
        </>
      )}
    </div>
  )
}

export const AuditCard = ({
  analysis,
  preview,
  rule,
  result,
  title,
  root,
  state,
  locked,
  onRun,
  onCancel,
}: Props) => {
  const t = useT()
  const help = t.audits
  const [full, setFull] = useState(false)
  const [command, setCommand] = useState(false)
  const ran = result?.status === 'pass' || result?.status === 'fail'
  const running = state?.running ?? false

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-line bg-panel p-5">
      <header className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={rule.severity} />
        {result && <StatusBadge status={result.status} />}
        {result?.stale && (
          <Badge className="border-warn-line bg-warn-bg text-warn">{t.rules.stale}</Badge>
        )}
        <h3 className="min-w-0 flex-1 truncate text-[15px] font-semibold">{title}</h3>
        <code className="font-mono text-[12px] text-muted">{rule.id}</code>
        <AuditScore result={result} />
      </header>

      <AuditFacts preview={preview} result={result} />

      <div className="flex flex-col gap-1.5">
        <span className="text-[12px] font-semibold text-muted">{help.rulePrompt}</span>
        <blockquote className="rounded-xl border-l-4 border-accent bg-bg px-4 py-3 leading-relaxed">
          {rule.prompt}
        </blockquote>
      </div>

      {result?.error && <p className="text-bad">{result.error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <Button primary onClick={onRun} disabled={locked || running}>
          {help.run}
        </Button>
        <Button onClick={() => setFull((open) => !open)} aria-expanded={full}>
          {full ? help.hideFull : help.showFull}
        </Button>
        <Button onClick={() => setCommand((open) => !open)} aria-expanded={command}>
          {command ? help.hideCommand : help.showCommand}
        </Button>
        {ran && (
          <Link
            to={projectPath(root, 'rules', rule.id)}
            className="ml-auto text-accent hover:underline"
          >
            {help.results} →
          </Link>
        )}
      </div>

      {hasOutput(state) && <AuditProgress state={state} onCancel={onCancel} />}
      {ran && !running && <AuditFindings analysis={analysis} result={result} title={title} />}
      {full && (
        <pre className="rounded-xl border border-line bg-code-bg p-4 font-mono text-[12px] leading-5 whitespace-pre-wrap">
          {preview.prompt}
        </pre>
      )}
      {command && (
        <pre className="overflow-x-auto rounded-xl border border-line bg-code-bg p-4 font-mono text-[12px] leading-5 break-all whitespace-pre-wrap">
          {['claude', ...preview.args.map(shellQuote)].join(' ')}
        </pre>
      )}
    </li>
  )
}
