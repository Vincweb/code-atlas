import type { Analysis } from '../../../shared/types'
import { useT } from '../../i18n'

export const Figures = ({ analysis }: { analysis: Analysis }) => {
  const t = useT()
  const { stats } = analysis
  const figures = t.learn.figures
  const tiles: [string, number, string][] = [
    [t.overview.files, stats.files, figures.files],
    [t.overview.lines, stats.lines, figures.lines],
    [t.overview.imports, stats.imports, figures.imports],
    [t.overview.typeImports, stats.typeImports, figures.typeImports],
    [t.overview.features, stats.features, figures.features],
    [t.overview.functions, stats.functions, figures.functions],
    [t.overview.cycles, analysis.graph.cycles.length, figures.cycles],
  ]
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[16px] font-semibold tracking-tight">{t.learn.figuresTitle}</h2>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
        {tiles.map(([label, value, hint]) => (
          <div key={label} className="rounded-xl border border-line bg-panel px-4 py-3">
            <div className="text-[22px] font-semibold tabular-nums">
              {value.toLocaleString(t.locale)}
            </div>
            <div className="text-[12px] leading-snug text-muted">{hint}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

export const Glossary = () => {
  const t = useT()
  return (
    <details className="rounded-xl border border-line bg-panel px-4 py-3">
      <summary className="cursor-pointer font-semibold">{t.learn.glossaryTitle}</summary>
      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        {t.learn.glossary.map(([term, definition]) => (
          <div key={term}>
            <dt className="font-medium">{term}</dt>
            <dd className="text-[12px] leading-relaxed text-muted">{definition}</dd>
          </div>
        ))}
      </dl>
    </details>
  )
}

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
