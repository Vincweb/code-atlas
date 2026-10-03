import type { Analysis } from '../../../shared/types'
import { cx } from '../../cx'
import { useT } from '../../i18n'
import { useClaudeStatus } from '../../queries'
import { formatUsd } from '../../util/format'
import { BAND_TEXT, bandOf } from '../../util/score'
import { Button, CopyButton, Spinner } from '../ui'

const CHECK = 'claude -p "dis bonjour"'

export const Connection = () => {
  const t = useT()
  const words = t.audits.connection
  const status = useClaudeStatus()
  const found = status.data?.found ?? false
  return (
    <div
      className={cx(
        'flex flex-col gap-2 rounded-xl border px-4 py-3',
        status.isPending
          ? 'border-line bg-bg'
          : found
            ? 'border-good-line bg-good-bg'
            : 'border-bad-line bg-bad-bg',
      )}
    >
      <span className="flex items-center gap-2 font-medium">
        {status.isPending ? (
          <>
            <Spinner /> {words.checking}
          </>
        ) : (
          <span className={found ? 'text-good' : 'text-bad'}>
            {found ? words.found(status.data?.version ?? '') : words.missing}
          </span>
        )}
      </span>
      <span className="text-[12px] leading-relaxed text-muted">
        {found || status.isPending ? words.text : words.missingText}
      </span>
      <span className="flex flex-wrap items-center gap-2 text-[12px] text-muted">
        {words.check}
        <code className="rounded bg-code-bg px-1.5 py-0.5 font-mono text-text">{CHECK}</code>
        <CopyButton text={CHECK} />
      </span>
    </div>
  )
}

export const AuditsHeader = ({
  analysis,
  busy,
  onRunAll,
  onCancelAll,
  left,
}: {
  analysis: Analysis
  busy: boolean
  onRunAll: () => void
  onCancelAll: () => void
  left: number
}) => {
  const t = useT()
  const help = t.audits
  const audits = analysis.rules.filter((rule) => rule.kind === 'ai')
  const ran = audits.filter((rule) => rule.ranAt !== null).length
  const spent = audits.reduce((sum, rule) => sum + (rule.costUsd ?? 0), 0)
  const cap = analysis.audits.items.reduce((sum, item) => sum + item.budgetUsd, 0)
  const family = analysis.scores.families.find((f) => f.family === 'ai')?.score ?? null

  return (
    <section className="grid grid-cols-1 gap-4 rounded-2xl border border-line bg-panel p-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h2 className="text-[20px] font-semibold tracking-tight">{t.tabs.audits}</h2>
          <span className="text-muted">{help.summary(audits.length, ran)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <span className="flex items-baseline gap-2">
            <span className="text-[12px] text-muted">{help.familyScore}</span>
            <span
              className={cx('text-[24px] font-semibold tabular-nums', BAND_TEXT[bandOf(family)])}
            >
              {family ?? '–'}
            </span>
          </span>
          {spent > 0 && (
            <span className="text-[12px] text-muted">{help.spent(formatUsd(spent))}</span>
          )}
        </div>
        <p className="max-w-2xl leading-relaxed text-muted">{help.intro}</p>
        <span className="flex flex-wrap gap-2">
          <Button primary onClick={onRunAll} disabled={busy || audits.length === 0}>
            {help.runAll(formatUsd(cap))}
          </Button>
          {busy && <Button onClick={onCancelAll}>{t.rules.cancelAll(left)}</Button>}
        </span>
      </div>
      <Connection />
    </section>
  )
}
