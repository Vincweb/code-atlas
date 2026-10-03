import { useEffect, useRef, useState } from 'react'
import { RUN_KINDS } from '../../../shared/config'
import type { Analysis, RuleResult } from '../../../shared/types'
import { cx } from '../../cx'
import { useT } from '../../i18n'
import { fixPrompt } from '../../util/claudePrompt'
import { formatUsd, relativeTime } from '../../util/format'
import { ruleSetting } from '../../util/ruleSetting'
import { BAND_TEXT, bandOf, ruleScore } from '../../util/score'
import type { Band } from '../../util/score'
import { ClaudeActions } from '../ClaudeActions'
import { ChevronIcon } from '../welcome/icons'
import { Badge, Button } from '../ui'
import { SeverityBadge } from './badges'
import { RunPanel } from './RunPanel'
import type { RunState } from './useRunner'
import { Violations } from './Violations'

const BAR: Record<Band, string> = {
  good: 'bg-good',
  warn: 'bg-warn',
  bad: 'bg-bad',
  none: 'bg-line',
}

const ICON: Record<RuleResult['status'], [string, string]> = {
  pass: ['✓', 'bg-good-bg text-good border-good-line'],
  fail: ['✗', 'bg-bad-bg text-bad border-bad-line'],
  error: ['!', 'bg-bad-bg text-bad border-bad-line'],
  'not-run': ['○', 'bg-none-bg text-none border-line'],
}

type Props = {
  analysis: Analysis
  rule: RuleResult
  title: string
  focused: boolean
  budget: number | null
  state: RunState | undefined
  locked: boolean
  onRun: () => void
  onCancel: () => void
}

export const RuleCard = (props: Props) => {
  const { analysis, rule, title, focused, budget, state, locked, onRun, onCancel } = props
  const t = useT()
  const [open, setOpen] = useState(focused)
  const card = useRef<HTMLLIElement>(null)
  useEffect(() => {
    if (focused) card.current?.scrollIntoView({ block: 'start' })
  }, [focused])

  const ran = rule.status === 'pass' || rule.status === 'fail'
  const score = ran ? ruleScore(rule.severity, rule.count) : null
  const band = bandOf(score)
  const configured = analysis.config.rules.find((candidate) => candidate.id === rule.id)
  const setting = configured ? ruleSetting(configured, analysis.config, t) : null
  const lesson = t.learn.kinds[rule.kind]
  const runnable = RUN_KINDS.includes(rule.kind)
  const running = state?.running ?? false
  const [icon, iconClass] = ICON[rule.status]

  return (
    <li
      ref={card}
      className={cx(
        'scroll-mt-20 rounded-xl border bg-panel',
        focused ? 'border-accent ring-1 ring-accent' : 'border-line',
      )}
    >
      <div className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start sm:gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span
            className={cx(
              'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border text-[13px] font-semibold',
              iconClass,
            )}
          >
            {icon}
          </span>
          <button
            type="button"
            onClick={() => setOpen((on) => !on)}
            aria-expanded={open}
            className="flex min-w-0 flex-1 flex-col gap-1 text-left"
          >
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{title}</span>
              <SeverityBadge severity={rule.severity} />
              {rule.stale && (
                <Badge className="border-warn-line bg-warn-bg text-warn">{t.rules.stale}</Badge>
              )}
            </span>
            <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-muted">
              <code className="font-mono">{rule.id}</code>
              <span>{t.configHelp.kinds[rule.kind] ?? rule.kind}</span>
              {setting && <span className="max-w-md truncate font-mono">{setting}</span>}
              {runnable && (
                <span>
                  {rule.ranAt ? t.rules.lastRun(relativeTime(rule.ranAt, t.locale)) : t.rules.never}
                  {rule.costUsd !== null && ` · ${formatUsd(rule.costUsd)}`}
                </span>
              )}
            </span>
          </button>
        </div>
        <span className="flex items-center gap-3 pl-10 sm:shrink-0 sm:pl-0">
          {ran && (
            <span
              className={cx('text-[12px] tabular-nums', rule.count ? 'text-bad' : 'text-muted')}
            >
              {t.rules.violations(rule.count)}
            </span>
          )}
          <span className="flex w-14 flex-col items-end gap-1">
            <span
              className={cx('text-[16px] leading-none font-semibold tabular-nums', BAND_TEXT[band])}
            >
              {score ?? '–'}
            </span>
            <span className="h-1 w-full overflow-hidden rounded-full bg-line">
              <span className={cx('block h-full', BAR[band])} style={{ width: `${score ?? 0}%` }} />
            </span>
          </span>
          {runnable && (
            <Button onClick={onRun} disabled={running || locked}>
              {rule.kind === 'ai' && budget !== null
                ? t.rules.runAi(formatUsd(budget))
                : t.rules.run}
            </Button>
          )}
          <button
            type="button"
            onClick={() => setOpen((on) => !on)}
            aria-label={title}
            className="flex size-7 items-center justify-center rounded-md text-muted hover:bg-hover"
          >
            <ChevronIcon className={cx('size-4 transition-transform', open && 'rotate-90')} />
          </button>
        </span>
      </div>

      {state && (state.running || state.lines.length > 0 || state.error) && (
        <div className="px-3 pb-3">
          <RunPanel state={state} onCancel={onCancel} />
        </div>
      )}

      {open && (
        <div className="flex flex-col gap-4 border-t border-line px-4 py-4">
          {lesson && (
            <dl className="grid grid-cols-1 gap-3 text-[12px] leading-relaxed sm:grid-cols-3">
              {(['what', 'why', 'fix'] as const).map((key) => (
                <div key={key}>
                  <dt className="mb-0.5 font-semibold text-muted">{t.learn[key]}</dt>
                  <dd>{lesson[key]}</dd>
                </div>
              ))}
            </dl>
          )}
          {rule.error && (
            <p className="rounded-lg border border-bad-line bg-bad-bg px-3 py-2 break-words whitespace-pre-wrap text-bad">
              {rule.error}
            </p>
          )}
          {rule.violations.length > 0 && <Violations rule={rule} />}
          {rule.status === 'fail' && rule.violations.length > 0 && (
            <div className="flex flex-col gap-2 rounded-xl border border-line bg-bg p-3">
              <span className="font-semibold">{t.rules.fixTitle}</span>
              <span className="text-[12px] text-muted">{t.rules.fixText}</span>
              <ClaudeActions prompt={fixPrompt(analysis, rule, title, t)} cwd={analysis.root} />
            </div>
          )}
        </div>
      )}
    </li>
  )
}
