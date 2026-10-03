import { useEffect, useRef } from 'react'
import { useT } from '../../i18n'
import { Button, ErrorBox, Spinner } from '../ui'
import type { RunState } from './useRunner'

export const RunPanel = ({ state, onCancel }: { state: RunState; onCancel: () => void }) => {
  const t = useT()
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const box = end.current?.parentElement
    if (box) box.scrollTop = box.scrollHeight
  }, [state.lines.length])

  return (
    <div className="mt-2 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-muted">
        {state.running && (
          <>
            <Spinner /> {t.rules.running}
            <Button onClick={onCancel} className="ml-auto text-text">
              {t.rules.cancel}
            </Button>
          </>
        )}
      </div>
      {state.lines.length > 0 && (
        <div className="max-h-48 overflow-auto rounded border border-line bg-code-bg p-2 font-mono text-[11px] leading-4">
          {state.lines.map((line, index) => (
            <div key={index} className="break-words whitespace-pre-wrap">
              {line}
            </div>
          ))}
          <div ref={end} />
        </div>
      )}
      {state.error && <ErrorBox message={state.error} />}
    </div>
  )
}
