import type { Analysis } from '../../../shared/types'
import { useT } from '../../i18n'
import { formatUsd } from '../../util/format'

export const Extras = ({ analysis }: { analysis: Analysis }) => {
  const t = useT()
  const help = t.audits
  const rows: [string, string][] = [
    [t.configHelp.ai.model, analysis.config.ai.model],
    [t.configHelp.ai.budget, formatUsd(analysis.config.ai.budgetUsd)],
    [t.configHelp.ai.language, analysis.config.ai.language],
  ]
  return (
    <div className="grid grid-cols-1 gap-5">
      <section className="flex flex-col gap-3 rounded-2xl border border-line bg-panel p-5">
        <h2 className="text-[16px] font-semibold tracking-tight">{help.settingsTitle}</h2>
        <p className="leading-relaxed text-muted">{help.settingsText}</p>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {rows.map(([label, value]) => (
            <div key={label} className="rounded-xl border border-line bg-bg px-4 py-3">
              <dt className="text-[12px] text-muted">{label}</dt>
              <dd className="font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
        <h2 className="mt-2 text-[16px] font-semibold tracking-tight">{help.costTitle}</h2>
        <ul className="flex list-disc flex-col gap-1.5 pl-5 leading-relaxed text-muted">
          {help.cost.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
    </div>
  )
}
