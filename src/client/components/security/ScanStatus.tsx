import { useState } from 'react'
import type { StrixScan } from '../../../shared/types'
import { useT } from '../../i18n'
import { cx } from '../../util/cx'
import { formatUsd, relativeTime } from '../../util/format'
import { Button, ErrorBox, Spinner } from '../ui'

const PHASE_CLASS: Record<StrixScan['phase'], string> = {
  scanning: 'border-accent/40 bg-accent/5',
  done: 'border-good-line bg-good-bg',
  failed: 'border-bad-line bg-bad-bg',
  cancelled: 'border-line bg-bg',
}

const facts = (scan: StrixScan, t: ReturnType<typeof useT>) => {
  const words = t.security
  return [
    scan.endedAt
      ? words.endedAt(relativeTime(scan.endedAt, t.locale))
      : words.startedAt(relativeTime(scan.startedAt, t.locale)),
    words.modes[scan.mode].label,
    words.copied(scan.files),
    scan.running ? words.foundSoFar(scan.findings) : words.findings.count(scan.findings),
    scan.costUsd !== null ? words.spent(formatUsd(scan.costUsd)) : null,
    words.cap(formatUsd(scan.budgetUsd)),
  ].filter((fact): fact is string => fact !== null)
}

/** The scan in progress, or how the last one ended. */
export const ScanStatus = ({
  scan,
  stopping,
  onStop,
}: {
  scan: StrixScan
  stopping: boolean
  onStop: () => void
}) => {
  const t = useT()
  const words = t.security
  const [log, setLog] = useState(false)
  const error = scan.error === 'strix-not-found' ? words.notFound : scan.error
  return (
    <div className={cx('flex flex-col gap-2 rounded-xl border px-4 py-3', PHASE_CLASS[scan.phase])}>
      <div className="flex flex-wrap items-center gap-2">
        {scan.running && <Spinner />}
        <span className="font-medium">{words.phase[scan.phase]}</span>
        {scan.running && (
          <Button onClick={onStop} disabled={stopping} className="ml-auto">
            {stopping ? words.stopping : words.stop}
          </Button>
        )}
      </div>
      <p className="flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-muted">
        {facts(scan, t).map((fact) => (
          <span key={fact}>{fact}</span>
        ))}
      </p>
      {scan.running && <p className="text-[12px] text-muted">{words.leaveHint}</p>}
      {error && <ErrorBox message={error} />}
      {scan.log.length > 0 && (
        <Button onClick={() => setLog((on) => !on)} aria-expanded={log} className="w-fit">
          {log ? words.hideLog : words.showLog}
        </Button>
      )}
      {log && (
        <pre className="max-h-64 overflow-auto rounded border border-line bg-code-bg p-2 font-mono text-[11px] leading-4 whitespace-pre-wrap">
          {scan.log.join('\n')}
        </pre>
      )}
    </div>
  )
}
