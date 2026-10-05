import type { ReactNode } from 'react'
import type { StrixSeverity } from '../../../shared/types'
import { useT } from '../../i18n'
import { cx } from '../../util/cx'
import { Badge, CopyButton } from '../ui'
import { SEVERITY_CLASS, severityLabel } from './model'

export type Tone = 'good' | 'warn' | 'bad' | 'none'

const MARK: Record<Tone, { sign: string; className: string }> = {
  good: { sign: '✓', className: 'bg-good-bg text-good' },
  warn: { sign: '!', className: 'bg-warn-bg text-warn' },
  bad: { sign: '✗', className: 'bg-bad-bg text-bad' },
  none: { sign: '·', className: 'bg-hover text-muted' },
}

/** One line of a checklist: a mark, what was checked, and what to do about it. */
export const Check = ({
  tone,
  title,
  children,
}: {
  tone: Tone
  title: ReactNode
  children?: ReactNode
}) => (
  <li className="flex gap-3 py-2.5">
    <span
      aria-hidden="true"
      className={cx(
        'flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
        MARK[tone].className,
      )}
    >
      {MARK[tone].sign}
    </span>
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className="font-medium">{title}</span>
      {children && <div className="flex flex-col gap-2 text-[12px] text-muted">{children}</div>}
    </div>
  </li>
)

export const Command = ({ command }: { command: string }) => (
  <span className="flex flex-wrap items-center gap-2">
    <code className="rounded bg-code-bg px-1.5 py-0.5 font-mono break-all whitespace-pre-wrap text-text">
      {command}
    </code>
    <CopyButton text={command} />
  </span>
)

export const SeverityPill = ({ severity }: { severity: StrixSeverity }) => {
  const t = useT()
  return <Badge className={SEVERITY_CLASS[severity]}>{severityLabel(severity, t)}</Badge>
}

/** A small tag: green when the setting is right, amber when it deserves a look. */
export const Fact = ({ good, children }: { good: boolean; children: ReactNode }) => (
  <span
    className={cx(
      'rounded-full border px-2 py-0.5 text-[11px]',
      good ? 'border-good-line bg-good-bg text-good' : 'border-warn-line bg-warn-bg text-warn',
    )}
  >
    {children}
  </span>
)
