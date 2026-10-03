import { useState } from 'react'
import { useT } from '../i18n'
import { Button } from './ui'

const PROMPT_LIMIT = 5000

export const claudeLink = (prompt: string, cwd: string) =>
  `claude-cli://open?q=${encodeURIComponent(prompt.slice(0, PROMPT_LIMIT))}&cwd=${encodeURIComponent(cwd)}`

export const ClaudeActions = ({
  prompt,
  cwd,
  primary = false,
}: {
  prompt: string
  cwd: string
  primary?: boolean
}) => {
  const t = useT()
  const [copied, setCopied] = useState(false)
  const [open, setOpen] = useState(false)
  const copy = () => {
    void navigator.clipboard.writeText(prompt).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <div className="flex flex-col gap-2">
      <span className="flex flex-wrap items-center gap-2">
        <a
          href={claudeLink(prompt, cwd)}
          className={
            primary
              ? 'rounded border border-accent bg-accent px-2.5 py-1 text-white hover:opacity-90'
              : 'rounded border border-line bg-panel px-2.5 py-1 hover:bg-hover'
          }
        >
          {t.claude.open}
        </a>
        <Button onClick={copy}>{copied ? t.claude.copied : t.claude.copy}</Button>
        <Button onClick={() => setOpen((on) => !on)} aria-expanded={open}>
          {open ? t.claude.hide : t.claude.show}
        </Button>
      </span>
      <span className="text-[11px] text-muted">{t.claude.hint}</span>
      {open && (
        <pre className="rounded-lg border border-line bg-code-bg p-3 font-mono text-[12px] leading-5 whitespace-pre-wrap">
          {prompt}
        </pre>
      )}
    </div>
  )
}
