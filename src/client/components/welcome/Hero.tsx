import { useState } from 'react'
import { useT } from '../../i18n'
import { AtlasArt } from './AtlasArt'

const COMMAND = 'npx @vincweb/code-atlas'

const CommandChip = () => {
  const t = useT()
  const [copied, setCopied] = useState(false)
  const copy = () => {
    void navigator.clipboard.writeText(COMMAND).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <button
      type="button"
      onClick={copy}
      title={t.landing.copyCommand}
      className="inline-flex items-center gap-3 rounded-lg border border-line bg-code-bg px-4 py-2.5 font-mono text-[13px] hover:bg-hover"
    >
      <span className="text-muted select-none">$</span>
      <span>{COMMAND}</span>
      <span className="text-[11px] text-muted">{copied ? t.landing.copied : '⧉'}</span>
    </button>
  )
}

const ScorePill = ({ label, score, tone }: { label: string; score: number; tone: string }) => (
  <span className={`flex items-baseline gap-2 rounded-lg border px-3 py-1.5 ${tone}`}>
    <span className="text-[12px]">{label}</span>
    <span className="text-[17px] font-semibold tabular-nums">{score}</span>
  </span>
)

export const Hero = ({ onOpen }: { onOpen: () => void }) => {
  const t = useT()
  return (
    <section className="grid grid-cols-1 items-center gap-10 py-10 lg:grid-cols-[1.05fr_1fr] lg:py-16">
      <div className="flex flex-col gap-6">
        <span className="w-fit rounded-full border border-line bg-panel px-3 py-1 text-[12px] text-muted">
          {t.landing.eyebrow}
        </span>
        <h1 className="text-[34px] leading-[1.1] font-semibold tracking-tight sm:text-[44px]">
          {t.landing.title}
          <span className="block text-accent">{t.landing.titleAccent}</span>
        </h1>
        <p className="max-w-xl text-[15px] leading-relaxed text-muted">{t.landing.lead}</p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onOpen}
            className="rounded-lg bg-accent px-5 py-2.5 text-[14px] font-medium text-white hover:opacity-90"
          >
            {t.landing.cta}
          </button>
          <CommandChip />
        </div>
      </div>

      <div className="atlas-grid rounded-2xl border border-line bg-panel p-5">
        <AtlasArt />
        <div className="mt-3 flex flex-wrap gap-2">
          <ScorePill
            label={t.landing.scores.architecture}
            score={42}
            tone="border-bad-line bg-bad-bg text-bad"
          />
          <ScorePill
            label={t.landing.scores.cleanCode}
            score={58}
            tone="border-warn-line bg-warn-bg text-warn"
          />
          <ScorePill
            label={t.landing.scores.tooling}
            score={100}
            tone="border-good-line bg-good-bg text-good"
          />
        </div>
      </div>
    </section>
  )
}
