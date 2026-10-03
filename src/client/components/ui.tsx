import type { ReactNode } from 'react'
import { useState } from 'react'
import { useT } from '../i18n'
import { cx } from '../cx'

export const Spinner = ({ className }: { className?: string }) => (
  <span
    role="status"
    className={cx(
      'inline-block size-3.5 animate-spin rounded-full border-2 border-line border-t-accent',
      className,
    )}
  />
)

export const Badge = ({ className, children }: { className?: string; children: ReactNode }) => (
  <span
    className={cx(
      'inline-flex items-center rounded border px-1.5 text-[11px] leading-5 font-medium whitespace-nowrap',
      className,
    )}
  >
    {children}
  </span>
)

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }

export const Button = ({ className, primary = false, ...props }: ButtonProps) => (
  <button
    type="button"
    {...props}
    className={cx(
      'rounded border px-2.5 py-1',
      primary
        ? 'border-accent bg-accent text-white hover:opacity-90'
        : 'border-line bg-panel hover:bg-hover disabled:hover:bg-panel',
      className,
    )}
  />
)

export const ErrorBox = ({ message, onRetry }: { message: string; onRetry?: () => void }) => {
  const t = useT()
  return (
    <div className="rounded border border-bad-line bg-bad-bg px-3 py-2 text-bad">
      <p className="break-words whitespace-pre-wrap">{message}</p>
      {onRetry && (
        <Button onClick={onRetry} className="mt-2 text-text">
          {t.common.retry}
        </Button>
      )}
    </div>
  )
}

export const CopyButton = ({ text }: { text: string }) => {
  const t = useT()
  const [copied, setCopied] = useState(false)
  const copy = () => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return <Button onClick={copy}>{copied ? t.common.copied : t.common.copy}</Button>
}

export const SectionTitle = ({ children }: { children: ReactNode }) => (
  <h2 className="mb-2 text-[11px] font-semibold tracking-wide text-muted uppercase">{children}</h2>
)
