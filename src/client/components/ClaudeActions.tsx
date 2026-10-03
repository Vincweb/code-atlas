import { useState } from 'react'
import { openInClaude } from '../api'
import { useT } from '../i18n'
import { Button, Spinner } from './ui'

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
  const [launch, setLaunch] = useState<'idle' | 'pending' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)
  const launchClaude = () => {
    setLaunch('pending')
    setError(null)
    openInClaude(cwd, prompt)
      .then(() => {
        setLaunch('done')
        setTimeout(() => setLaunch('idle'), 2000)
      })
      .catch((reason: unknown) => {
        setLaunch('idle')
        setError(reason instanceof Error ? reason.message : String(reason))
      })
  }
  const copy = () => {
    void navigator.clipboard.writeText(prompt).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <div className="flex flex-col gap-2">
      <span className="flex flex-wrap items-center gap-2">
        <Button
          primary={primary}
          onClick={launchClaude}
          disabled={launch === 'pending'}
          className="flex items-center gap-2"
        >
          {launch === 'pending' && (
            <Spinner className={primary ? 'border-white/40 border-t-white' : undefined} />
          )}
          {launch === 'done' ? t.claude.opened : t.claude.open}
        </Button>
        <Button onClick={copy}>{copied ? t.claude.copied : t.claude.copy}</Button>
        <Button onClick={() => setOpen((on) => !on)} aria-expanded={open}>
          {open ? t.claude.hide : t.claude.show}
        </Button>
      </span>
      {error && <span className="text-[12px] text-bad">{t.claude.failed(error)}</span>}
      <span className="text-[11px] text-muted">{t.claude.hint}</span>
      {open && (
        <pre className="rounded-lg border border-line bg-code-bg p-3 font-mono text-[12px] leading-5 whitespace-pre-wrap">
          {prompt}
        </pre>
      )}
    </div>
  )
}
