import type { FeatureEdge, FeatureNode } from '../../../shared/types'
import { cx } from '../../util/cx'
import { useT } from '../../i18n'
import { SectionTitle } from '../ui'
import { EdgeImports } from './EdgeImports'
import { CHIP, TONE, isRed } from './edges'

type Props = {
  feature: FeatureNode
  edges: FeatureEdge[]
  layerName: string | null
  onFocus: (id: string) => void
  onClose: () => void
}

const Chips = ({
  edges,
  side,
  onFocus,
}: {
  edges: FeatureEdge[]
  side: 'from' | 'to'
  onFocus: (id: string) => void
}) => {
  const t = useT()
  if (edges.length === 0) return <p className="text-muted">{t.common.none}</p>
  return (
    <div className="flex flex-wrap gap-1.5">
      {edges.map((edge) => (
        <button
          key={edge[side]}
          type="button"
          onClick={() => onFocus(edge[side])}
          title={t.edgeClass[edge.class]}
          className={cx(
            'rounded border px-1.5 font-mono text-[11px] hover:bg-hover',
            CHIP[TONE[edge.class]],
          )}
        >
          {edge[side]} · {edge.weight}
        </button>
      ))}
    </div>
  )
}

export const NodePanel = ({ feature, edges, layerName, onFocus, onClose }: Props) => {
  const t = useT()
  const outgoing = edges.filter((edge) => edge.from === feature.id)
  const incoming = edges.filter((edge) => edge.to === feature.id)
  const red = [...outgoing, ...incoming].filter((edge) => isRed(edge.class))
  const stats: [string, string][] = [
    [t.metrics.files, String(feature.files)],
    [t.metrics.lines, feature.lines.toLocaleString(t.locale)],
    ['Ca', String(feature.ca)],
    ['Ce', String(feature.ce)],
    [t.metrics.instability, feature.instability.toFixed(2)],
  ]
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-mono text-[13px] font-semibold break-all">{feature.id}</h3>
          <p className="text-muted">{layerName ?? t.common.unlayered}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t.graph.close}
          title={t.graph.close}
          className="flex size-6 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-text"
        >
          ×
        </button>
      </div>
      <dl className="grid grid-cols-5 gap-2">
        {stats.map(([label, value]) => (
          <div key={label}>
            <dt className="text-muted">{label}</dt>
            <dd className="font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-muted">{t.graph.instabilityHelp}</p>
      <section>
        <SectionTitle>{t.graph.dependsOn(outgoing.length)}</SectionTitle>
        <Chips edges={outgoing} side="to" onFocus={onFocus} />
      </section>
      <section>
        <SectionTitle>{t.graph.usedBy(incoming.length)}</SectionTitle>
        <Chips edges={incoming} side="from" onFocus={onFocus} />
      </section>
      {red.length > 0 && (
        <section>
          <SectionTitle>{t.graph.problemImports}</SectionTitle>
          <ul className="flex flex-col gap-2">
            {red.map((edge) => (
              <EdgeImports key={`${edge.from}→${edge.to}`} edge={edge} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
