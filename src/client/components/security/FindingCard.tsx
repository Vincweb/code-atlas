import { useState } from 'react'
import type { StrixFinding, StrixLocation } from '../../../shared/types'
import { useT } from '../../i18n'
import { ClaudeActions } from '../ClaudeActions'
import { Button } from '../ui'
import { FileLink } from '../viewer'
import { fixPrompt } from './model'
import { SeverityPill } from './parts'

type BlockProps = { title?: string; text: string | null; code?: boolean }

const Block = ({ title, text, code = false }: BlockProps) =>
  text ? (
    <div className="flex flex-col gap-1">
      {title && <span className="text-[12px] font-semibold text-muted">{title}</span>}
      {code ? (
        <pre className="overflow-x-auto rounded-lg border border-line bg-code-bg p-3 font-mono text-[12px] leading-5">
          {text}
        </pre>
      ) : (
        <p className="leading-relaxed break-words whitespace-pre-wrap">{text}</p>
      )}
    </div>
  ) : null

const Location = ({ location }: { location: StrixLocation }) => {
  const words = useT().security.findings
  const fix = location.fixBefore || location.fixAfter
  return (
    <li className="flex flex-col gap-1.5 px-3 py-2">
      <span className="flex flex-wrap items-center gap-2">
        {location.exists ? (
          <FileLink file={location.file} line={location.line} />
        ) : (
          <span className="font-mono text-[12px]">
            {location.file}:{location.line} ·{' '}
            <span className="text-muted">{words.notInProject}</span>
          </span>
        )}
        {location.label && <span className="text-[12px] text-muted">{location.label}</span>}
      </span>
      {location.snippet && !fix && (
        <pre className="overflow-x-auto rounded bg-code-bg p-2 font-mono text-[11px] leading-4">
          {location.snippet}
        </pre>
      )}
      {fix && (
        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-muted">{words.suggested}</span>
          <pre className="overflow-x-auto rounded bg-code-bg p-2 font-mono text-[11px] leading-4">
            {location.fixBefore && <span className="block text-bad">{location.fixBefore}</span>}
            {location.fixAfter && <span className="block text-good">{location.fixAfter}</span>}
          </pre>
        </div>
      )}
    </li>
  )
}

const Facts = ({ finding }: { finding: StrixFinding }) => {
  const words = useT().security.findings
  const facts = [
    finding.cvss !== null ? `${words.cvss} ${finding.cvss}` : null,
    finding.cwe,
    finding.cve,
    finding.endpoint ? `${finding.method ?? ''} ${finding.endpoint}`.trim() : null,
    finding.confidence ? `${words.confidence} ${finding.confidence}` : null,
    finding.fixEffort ? `${words.fixEffort} ${finding.fixEffort}` : null,
  ].filter((fact): fact is string => !!fact)
  if (!facts.length) return null
  return (
    <p className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[12px] text-muted">
      {facts.map((fact) => (
        <span key={fact}>{fact}</span>
      ))}
    </p>
  )
}

const Details = ({ finding }: { finding: StrixFinding }) => {
  const words = useT().security.findings
  return (
    <div className="flex flex-col gap-3">
      <Block title={words.impact} text={finding.impact} />
      <Block title={words.technical} text={finding.technicalAnalysis} />
      <Block title={words.poc} text={finding.poc} />
      <Block title={finding.poc ? undefined : words.poc} text={finding.pocCode} code />
    </div>
  )
}

export const FindingCard = ({ finding, root }: { finding: StrixFinding; root: string }) => {
  const t = useT()
  const words = t.security.findings
  const [open, setOpen] = useState(false)
  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-line bg-panel p-5">
      <header className="flex flex-wrap items-center gap-2">
        <SeverityPill severity={finding.severity} />
        <h3 className="min-w-0 flex-1 text-[15px] font-semibold">{finding.title}</h3>
        <code className="font-mono text-[12px] text-muted">{finding.id}</code>
      </header>
      <Facts finding={finding} />
      <Block title={words.description} text={finding.description} />
      {finding.locations.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-[12px] font-semibold text-muted">{words.locations}</span>
          <ul className="flex flex-col divide-y divide-line rounded-xl border border-line bg-bg">
            {finding.locations.map((location, index) => (
              <Location key={`${location.file}:${location.line}:${index}`} location={location} />
            ))}
          </ul>
        </div>
      )}
      <Block title={words.remediation} text={finding.remediation} />
      <Button onClick={() => setOpen((on) => !on)} aria-expanded={open} className="w-fit">
        {open ? words.hideDetails : words.details}
      </Button>
      {open && <Details finding={finding} />}
      <div className="flex flex-col gap-2 rounded-xl border border-line bg-bg p-3">
        <span className="font-semibold">{words.fixTitle}</span>
        <ClaudeActions prompt={fixPrompt(root, finding, t)} cwd={root} />
      </div>
    </li>
  )
}
