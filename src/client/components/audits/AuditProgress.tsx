import type { ReactNode } from 'react'
import { useT } from '../../i18n'
import type { RunState } from '../rules/useRunner'
import { FolderIcon, SearchIcon, TerminalIcon } from '../welcome/icons'
import { Button, ErrorBox, Spinner } from '../ui'

const ICON: Record<string, ReactNode> = {
  Read: <TerminalIcon className="size-3.5" />,
  Grep: <SearchIcon className="size-3.5" />,
  Glob: <FolderIcon className="size-3.5" />,
}

const kindOf = (line: string) => line.split(' ')[0] ?? ''

export const AuditProgress = ({ state, onCancel }: { state: RunState; onCancel: () => void }) => {
  const t = useT()
  const files = new Set(state.lines.filter((line) => kindOf(line) === 'Read')).size
  const searches = state.lines.filter((line) => ['Grep', 'Glob'].includes(kindOf(line))).length
  const recent = state.lines.slice(-8)
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line bg-bg p-3">
      <div className="flex flex-wrap items-center gap-3 text-[12px] text-muted">
        {state.running && <Spinner />}
        <span>{t.audits.progressFiles(files)}</span>
        <span>{t.audits.progressSearches(searches)}</span>
        {state.running && (
          <Button onClick={onCancel} className="ml-auto text-text">
            {t.rules.cancel}
          </Button>
        )}
      </div>
      {recent.length > 0 && (
        <ol className="flex flex-col gap-1 font-mono text-[11px]">
          {recent.map((line, index) => (
            <li key={`${index}-${line}`} className="flex gap-2 text-muted">
              <span className="flex w-4 shrink-0 justify-center pt-px" aria-hidden="true">
                {ICON[kindOf(line)] ?? '·'}
              </span>
              <span className="min-w-0 truncate">{line}</span>
            </li>
          ))}
        </ol>
      )}
      {state.error && <ErrorBox message={state.error} />}
    </div>
  )
}
