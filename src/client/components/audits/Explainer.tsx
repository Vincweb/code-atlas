import { useState } from 'react'
import type { Analysis } from '../../../shared/types'
import { useT } from '../../i18n'
import { Button } from '../ui'
import { Code } from '../config/parts'

export const frameOf = (analysis: Analysis) => {
  const item = analysis.audits.items[0]
  const rule = analysis.config.rules.find((candidate) => candidate.id === item?.id)
  if (!item || rule?.kind !== 'ai') return null
  return item.prompt.slice(rule.prompt.trim().length).trim()
}

export const Explainer = ({ analysis, open }: { analysis: Analysis; open: boolean }) => {
  const t = useT()
  const help = t.audits
  const [schema, setSchema] = useState(false)
  const frame = frameOf(analysis)

  return (
    <details open={open} className="group rounded-2xl border border-line bg-panel p-5">
      <summary className="cursor-pointer text-[16px] font-semibold tracking-tight">
        {help.howTitle}
      </summary>
      <div className="mt-4 flex flex-col gap-5">
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {help.points.map(([title, text]) => (
            <li key={title} className="rounded-xl border border-line bg-bg px-4 py-3">
              <span className="block font-semibold">{title}</span>
              <span className="text-[12px] leading-relaxed text-muted">{text}</span>
            </li>
          ))}
        </ul>
        <section className="flex flex-col gap-3">
          <h2 className="text-[16px] font-semibold tracking-tight">{help.pipelineTitle}</h2>
          <ol className="grid grid-cols-1 gap-3 md:grid-cols-4">
            {help.pipeline.map(([title, text], index) => (
              <li
                key={title}
                className="relative flex flex-col gap-1.5 rounded-xl border border-line bg-panel p-4"
              >
                <span className="flex size-7 items-center justify-center rounded-full bg-accent text-[13px] font-semibold text-white">
                  {index + 1}
                </span>
                <span className="font-semibold">{title}</span>
                <span className="text-[12px] leading-relaxed text-muted">{text}</span>
                {index < help.pipeline.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="absolute top-1/2 -right-3 z-10 hidden size-6 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-bg text-muted md:flex"
                  >
                    →
                  </span>
                )}
              </li>
            ))}
          </ol>
        </section>

        <section className="flex flex-col gap-3 rounded-2xl border border-line bg-panel p-5">
          <h2 className="text-[16px] font-semibold tracking-tight">{help.inputsTitle}</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {help.inputs.map(([title, text]) => (
              <div key={title} className="rounded-xl border border-line bg-bg px-4 py-3">
                <span className="block font-semibold">{title}</span>
                <span className="text-[12px] leading-relaxed text-muted">{text}</span>
              </div>
            ))}
          </div>
          {frame && (
            <div className="flex flex-col gap-2">
              <h3 className="text-[12px] font-semibold text-muted">{help.frame}</h3>
              <pre className="rounded-xl border border-line bg-code-bg p-4 font-mono text-[12px] leading-5 whitespace-pre-wrap">
                {frame}
              </pre>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => setSchema((open) => !open)} aria-expanded={schema}>
              {schema ? help.hideSchema : help.showSchema}
            </Button>
            <span className="flex flex-wrap gap-1.5">
              {analysis.audits.tools.map((tool) => (
                <span
                  key={tool}
                  className="rounded-md border border-line bg-bg px-2 py-0.5 font-mono text-[12px]"
                >
                  {tool}
                </span>
              ))}
            </span>
          </div>
          {schema && <Code text={analysis.audits.schema} />}
        </section>
      </div>
    </details>
  )
}
