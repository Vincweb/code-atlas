import type { Analysis, Distribution } from '../../../shared/types'
import { cx } from '../../util/cx'
import { useT } from '../../i18n'

export const limitOf = (analysis: Analysis, kind: 'complexity' | 'max-lines') => {
  const rule = analysis.config.rules.find((candidate) => candidate.kind === kind)
  return rule && 'max' in rule ? { max: rule.max, id: rule.id } : null
}

export const Tiles = ({ analysis }: { analysis: Analysis }) => {
  const t = useT()
  const words = t.metrics.tiles
  const { stats, graph, distribution } = analysis
  const instability = graph.features.length
    ? graph.features.reduce((sum, f) => sum + f.instability, 0) / graph.features.length
    : 0
  const tiles: [string, string, string][] = [
    [words.files, stats.files.toLocaleString(t.locale), words.filesHint],
    [
      words.lines,
      stats.lines.toLocaleString(t.locale),
      words.linesHint(distribution.fileLines.average.toLocaleString(t.locale)),
    ],
    [words.functions, stats.functions.toLocaleString(t.locale), ''],
    [
      words.complexity,
      distribution.complexity.average.toLocaleString(t.locale),
      words.complexityHint(distribution.complexity.max),
    ],
    [
      words.features,
      String(stats.features),
      graph.layers.length ? words.featuresHint(graph.layers.length) : words.noLayers,
    ],
    [words.instability, instability.toFixed(2), words.instabilityHint],
  ]
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {tiles.map(([label, value, hint]) => (
        <div key={label} className="rounded-xl border border-line bg-panel px-4 py-3">
          <div className="text-[12px] text-muted">{label}</div>
          <div className="text-[22px] font-semibold tabular-nums">{value}</div>
          {hint && <div className="text-[11px] text-muted">{hint}</div>}
        </div>
      ))}
    </div>
  )
}

export const Histogram = ({
  title,
  text,
  distribution,
  limit,
  count,
}: {
  title: string
  text: string
  distribution: Distribution
  limit: { max: number; id: string } | null
  count: (n: number) => string
}) => {
  const t = useT()
  const peak = Math.max(1, ...distribution.buckets.map((bucket) => bucket.count))
  const above = limit
    ? distribution.buckets
        .filter((bucket) => bucket.min > limit.max)
        .reduce((sum, bucket) => sum + bucket.count, 0)
    : 0
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-line bg-panel p-5">
      <header>
        <h2 className="text-[16px] font-semibold tracking-tight">{title}</h2>
        <p className="text-[12px] leading-relaxed text-muted">{text}</p>
      </header>
      <div className="flex h-40 items-end gap-2">
        {distribution.buckets.map((bucket) => {
          const over = limit !== null && bucket.min > limit.max
          return (
            <div
              key={bucket.min}
              className="flex h-full flex-1 flex-col items-center justify-end gap-1"
            >
              <span className="text-[11px] text-muted tabular-nums">{bucket.count}</span>
              <span
                className={cx('w-full rounded-t-md', over ? 'bg-bad' : 'bg-accent/70')}
                style={{ height: `${Math.max(2, (bucket.count / peak) * 100)}%` }}
              />
              <span className="text-[11px] text-muted tabular-nums">
                {t.metrics.bucket(bucket.min, bucket.max)}
              </span>
            </div>
          )
        })}
      </div>
      <p className="text-[12px] text-muted">
        {count(distribution.total)}
        {limit && (
          <span className={above ? 'text-bad' : 'text-good'}>
            {' · '}
            {t.metrics.aboveLimit(above, limit.max, limit.id)}
          </span>
        )}
      </p>
    </section>
  )
}
