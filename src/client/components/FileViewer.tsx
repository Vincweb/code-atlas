import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '../i18n'
import { useFile } from '../state/queries'
import { Button, ErrorBox, Spinner } from './ui'

type Props = { root: string; path: string; line: number | null; onClose: () => void }

export const FileViewer = ({ root, path, line, onClose }: Props) => {
  const t = useT()
  const file = useFile(root, path)
  const target = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (file.data) target.current?.scrollIntoView({ block: 'center' })
  }, [file.data])

  const lines = file.data?.text.split('\n')
  const width = String(lines?.length ?? 0).length

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={path}
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-line bg-panel shadow-xl"
      >
        <header className="flex items-center gap-3 border-b border-line px-3 py-2">
          <span className="min-w-0 flex-1 truncate font-mono text-[12px]">
            {path}
            {line ? `:${line}` : ''}
          </span>
          <Button onClick={onClose}>{t.viewer.close}</Button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto bg-code-bg">
          {file.isPending && (
            <p className="flex items-center gap-2 p-4 text-muted">
              <Spinner /> {t.common.loading}
            </p>
          )}
          {file.error && (
            <div className="p-3">
              <ErrorBox message={file.error.message} onRetry={() => void file.refetch()} />
            </div>
          )}
          {lines && (
            <pre className="py-2 font-mono text-[12px] leading-5">
              {lines.map((text, index) => {
                const number = index + 1
                const hit = number === line
                return (
                  <div
                    key={number}
                    ref={hit ? target : undefined}
                    className={hit ? 'flex bg-warn-bg' : 'flex'}
                  >
                    <span
                      className="shrink-0 pr-3 pl-3 text-right text-muted select-none"
                      style={{ minWidth: `${width + 3}ch` }}
                    >
                      {number}
                    </span>
                    <code className="pr-3 whitespace-pre">{text}</code>
                  </div>
                )
              })}
            </pre>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
