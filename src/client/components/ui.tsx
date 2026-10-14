import type { ReactNode } from 'react'
import { useState } from 'react'
import { useT } from '../i18n'
import { cx } from '../util/cx'

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

type ButtonProps = React.ComponentProps<'button'> & { primary?: boolean }

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

export const Chip = ({ children, className }: { children: ReactNode; className?: string }) => (
  <span
    className={cx(
      'inline-flex items-center rounded-md border border-line bg-bg px-2 py-0.5 font-mono text-[12px]',
      className,
    )}
  >
    {children}
  </span>
)

export const Code = ({ text, className }: { text: string; className?: string }) => (
  <pre
    className={cx(
      'max-h-[32rem] overflow-auto rounded-xl border border-line bg-code-bg p-4 font-mono text-[12px] leading-5',
      className,
    )}
  >
    {text}
  </pre>
)

export const Warnings = ({ warnings }: { warnings: string[] }) => {
  const t = useT()
  if (warnings.length === 0) return null
  return (
    <details className="rounded-xl border border-warn-line bg-warn-bg px-4 py-3">
      <summary className="cursor-pointer font-medium text-warn">
        {t.overview.warnings(warnings.length)}
      </summary>
      <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
        {warnings.map((warning, index) => (
          <li key={index} className="break-words">
            {warning}
          </li>
        ))}
      </ul>
    </details>
  )
}
