import type { FeatureEdge, Graph } from '../../../shared/types'
import { useT } from '../../i18n'
import { SectionTitle } from '../ui'
import { EdgeImports } from './EdgeImports'
import { isRed } from './edges'

const MOST_COUPLED = 6

export const OverviewPanel = ({
  graph,
  onFocus,
}: {
  graph: Graph
  onFocus: (id: string) => void
}) => {
  const t = useT()
  const red: FeatureEdge[] = graph.edges.filter((edge) => isRed(edge.class))
  const coupled = [...graph.features]
    .sort((a, b) => b.ca + b.ce - (a.ca + a.ce))
    .slice(0, MOST_COUPLED)
  const peak = Math.max(1, ...coupled.map((feature) => feature.ca + feature.ce))

  return (
    <div className="flex flex-col gap-5">
      <p className="text-muted">{t.graph.clickHint}</p>

      <section>
        <SectionTitle>{t.graph.mostCoupled}</SectionTitle>
        <ul className="flex flex-col gap-1">
          {coupled.map((feature) => (
            <li key={feature.id}>
              <button
                type="button"
                onClick={() => onFocus(feature.id)}
                className="grid w-full grid-cols-[minmax(0,1fr)_6rem] items-center gap-3 rounded-md px-1.5 py-1 text-left hover:bg-hover"
              >
                <span className="min-w-0">
                  <span className="block truncate font-mono text-[12px]">{feature.id}</span>
                  <span className="block text-[11px] text-muted">
                    {t.graph.coupling(feature.ca, feature.ce)}
                  </span>
                </span>
                <span className="flex h-1.5 overflow-hidden rounded-full bg-line">
                  <span className="bg-accent" style={{ width: `${(feature.ca / peak) * 100}%` }} />
                  <span
                    className="bg-accent/40"
                    style={{ width: `${(feature.ce / peak) * 100}%` }}
                  />
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <SectionTitle>{t.graph.redEdges(red.length)}</SectionTitle>
        {red.length === 0 ? (
          <p className="text-good">{t.graph.noRedEdges}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {red.map((edge) => (
              <EdgeImports key={`${edge.from}→${edge.to}`} edge={edge} />
            ))}
          </ul>
        )}
      </section>

      <section>
        <SectionTitle>{t.graph.cycles(graph.cycles.length)}</SectionTitle>
        {graph.cycles.length === 0 ? (
          <p className="text-good">{t.graph.noCycles}</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {graph.cycles.map((cycle, index) => (
              <li key={index} className="font-mono text-[12px] break-all">
                {[...cycle, cycle[0]].join(' → ')}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
