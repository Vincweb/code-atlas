import { useState } from 'react'
import type { StrixRun, StrixRunSummary } from '../../../shared/types'
import { useT } from '../../i18n'
import { cx } from '../../util/cx'
import { formatUsd, relativeTime } from '../../util/format'
import { Button } from '../ui'
import { FindingCard } from './FindingCard'
import { SEVERITIES, viewerCommand } from './model'
import { Command, SeverityPill } from './parts'

const Breakdown = ({ run }: { run: StrixRunSummary }) => (
  <span className="flex flex-wrap items-center gap-1.5">
    {SEVERITIES.filter((severity) => run.bySeverity[severity] > 0).map((severity) => (
      <span key={severity} className="flex items-center gap-1">
        <SeverityPill severity={severity} />
        <span className="tabular-nums">{run.bySeverity[severity]}</span>
      </span>
    ))}
  </span>
)

const RunFacts = ({ run }: { run: StrixRunSummary }) => {
  const t = useT()
  const status = t.security.runs.status
  const modes: Record<string, { label: string } | undefined> = t.security.modes
  const facts = [
    run.mode && (modes[run.mode]?.label ?? run.mode),
    status[run.status] ?? run.status,
    run.startedAt && relativeTime(run.startedAt, t.locale),
    run.costUsd !== null && formatUsd(run.costUsd),
  ].filter((fact): fact is string => typeof fact === 'string')
  return <span className="text-[12px] text-muted">{facts.join(' · ')}</span>
}

const Runs = ({
  runs,
  shown,
  onSelect,
}: {
  runs: StrixRunSummary[]
  shown: string
  onSelect: (name: string | null) => void
}) => {
  const words = useT().security.runs
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[16px] font-semibold tracking-tight">{words.title}</h2>
      <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-panel">
        {runs.map((run, index) => (
          <li key={run.name}>
            <button
              type="button"
              onClick={() => onSelect(index === 0 ? null : run.name)}
              aria-current={run.name === shown ? 'true' : undefined}
              className={cx(
                'flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-left hover:bg-hover',
                run.name === shown && 'bg-hover',
              )}
            >
              <span className="font-mono text-[12px]">{run.name}</span>
              {index === 0 && <span className="text-[11px] text-accent">{words.latest}</span>}
              <RunFacts run={run} />
              <span className="ml-auto">
                <Breakdown run={run} />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

const Summary = ({ run, runsDir }: { run: StrixRun; runsDir: string }) => {
  const words = useT().security.findings
  const [open, setOpen] = useState(false)
  return (
    <div className="flex flex-col gap-2 text-[12px] text-muted">
      {run.report && (
        <Button onClick={() => setOpen((on) => !on)} aria-expanded={open} className="w-fit">
          {open ? words.hideReport : words.showReport}
        </Button>
      )}
      {open && run.report && (
        <pre className="max-h-[32rem] overflow-auto rounded-xl border border-line bg-code-bg p-4 font-mono text-[12px] leading-5 whitespace-pre-wrap text-text">
          {run.report}
        </pre>
      )}
      <span>{words.viewer}</span>
      <Command command={viewerCommand(runsDir, run.name)} />
    </div>
  )
}

export const RunView = ({
  run,
  runs,
  runsDir,
  root,
  onSelect,
}: {
  run: StrixRun | null
  runs: StrixRunSummary[]
  runsDir: string
  root: string
  onSelect: (name: string | null) => void
}) => {
  const words = useT().security.findings
  if (!run)
    return (
      <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-muted">
        {words.noRun}
      </p>
    )
  return (
    <>
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 className="text-[16px] font-semibold tracking-tight">{words.title}</h2>
          <span className="text-muted">{words.count(run.count)}</span>
          <Breakdown run={run} />
          <span className="ml-auto">
            <RunFacts run={run} />
          </span>
        </div>
        {run.findings.length === 0 && run.status === 'running' && (
          <p className="rounded-lg border border-line bg-bg px-3 py-2 text-muted">
            {words.pending}
          </p>
        )}
        {run.findings.length === 0 && run.status !== 'running' && (
          <p className="rounded-lg border border-good-line bg-good-bg px-3 py-2 text-good">
            {words.none}
          </p>
        )}
        {run.findings.length > 0 && (
          <ul className="flex flex-col gap-3">
            {run.findings.map((finding) => (
              <FindingCard key={finding.id} finding={finding} root={root} />
            ))}
          </ul>
        )}
        <Summary run={run} runsDir={runsDir} />
      </section>
      {runs.length > 1 && <Runs runs={runs} shown={run.name} onSelect={onSelect} />}
    </>
  )
}
