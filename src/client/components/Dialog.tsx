import type { ReactNode } from 'react'
import { useEffect, useId, useRef } from 'react'
import { useT } from '../i18n'
import { Button, ErrorBox, Spinner } from './ui'

type Props = {
  title: string
  icon?: ReactNode
  children: ReactNode
  confirmLabel: string
  onConfirm: () => void
  onClose: () => void
  pending?: boolean
  error?: string | null
}

export const ConfirmDialog = ({
  title,
  icon,
  children,
  confirmLabel,
  onConfirm,
  onClose,
  pending = false,
  error = null,
}: Props) => {
  const t = useT()
  const titleId = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  const confirm = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const element = dialog.current
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    element?.showModal()
    confirm.current?.focus()
    return () => {
      element?.close()
      trigger?.focus()
    }
  }, [])

  const dismiss = () => {
    if (!pending) onClose()
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onClose={() => {
        if (!dialog.current?.open) onClose()
      }}
      onCancel={(event) => {
        event.preventDefault()
        dismiss()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) dismiss()
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-line bg-panel text-text shadow-2xl transition duration-150 backdrop:bg-black/50 starting:scale-95 starting:opacity-0 motion-reduce:transition-none"
    >
      <div className="flex max-h-[calc(100dvh-3rem)] flex-col">
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto p-5">
          <header className="flex items-center gap-3">
            {icon && (
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                {icon}
              </span>
            )}
            <h2 id={titleId} className="text-[16px] font-semibold tracking-tight">
              {title}
            </h2>
          </header>
          <div className="flex flex-col gap-3 leading-relaxed">{children}</div>
          {error && <ErrorBox message={error} />}
        </div>
        <footer className="flex shrink-0 justify-end gap-2 border-t border-line bg-bg px-5 py-3">
          <Button onClick={dismiss} disabled={pending}>
            {t.common.cancel}
          </Button>
          <Button
            ref={confirm}
            primary
            onClick={onConfirm}
            disabled={pending}
            className="flex items-center gap-2"
          >
            {pending && <Spinner className="border-white/40 border-t-white" />}
            {confirmLabel}
          </Button>
        </footer>
      </div>
    </dialog>
  )
}
