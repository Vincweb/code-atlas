import { useMemo, useState } from 'react'
import type { Analysis, FeatureNode } from '../../../shared/types'
import { cx } from '../../util/cx'
import { useT } from '../../i18n'
import { SearchIcon } from '../welcome/icons'

type SortKey = 'id' | 'layer' | 'files' | 'lines' | 'ca' | 'ce' | 'instability'

const InstabilityBar = ({ value }: { value: number }) => (
  <span className="flex items-center gap-2">
    <span className="h-1.5 w-16 overflow-hidden rounded-full bg-line">
      <span
        className={cx('block h-full', value > 0.7 ? 'bg-warn' : 'bg-accent/70')}
        style={{ width: `${value * 100}%` }}
      />
    </span>
    <span className="w-9 text-right tabular-nums">{value.toFixed(2)}</span>
  </span>
)

export const FeaturesTable = ({ analysis }: { analysis: Analysis }) => {
  const t = useT()
  const words = t.metrics
  const { graph } = analysis
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'lines', desc: true })
  const [query, setQuery] = useState('')
  const layerName = (feature: FeatureNode) =>
    feature.layer === null ? t.common.unlayered : (graph.layers[feature.layer]?.name ?? '')

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const value = (feature: FeatureNode): string | number =>
      sort.key === 'id'
        ? feature.id
        : sort.key === 'layer'
          ? (feature.layer ?? Number.MAX_SAFE_INTEGER)
          : feature[sort.key]
    const sign = sort.desc ? -1 : 1
    return graph.features
      .filter((feature) => !needle || feature.id.toLowerCase().includes(needle))
      .sort((a, b) => {
        const x = value(a)
        const y = value(b)
        const order =
          typeof x === 'number' && typeof y === 'number'
            ? x - y
            : String(x).localeCompare(String(y))
        return order * sign || a.id.localeCompare(b.id)
      })
  }, [graph, sort, query])

  const columns: [SortKey, string, boolean][] = [
    ['id', words.feature, false],
    ['layer', words.layer, false],
    ['files', words.files, true],
    ['lines', words.lines, true],
    ['ca', words.ca, true],
    ['ce', words.ce, true],
    ['instability', words.instability, true],
  ]
  const toggle = (key: SortKey) =>
    setSort({ key, desc: sort.key === key ? !sort.desc : key !== 'id' && key !== 'layer' })

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-line bg-panel p-5">
      <header className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[16px] font-semibold tracking-tight">{words.features}</h2>
          <p className="max-w-3xl text-[12px] leading-relaxed text-muted">{words.featuresText}</p>
        </div>
        <label className="flex w-full items-center gap-2 rounded-lg border border-line bg-bg px-2.5 py-1 sm:w-56">
          <SearchIcon className="size-4 text-muted" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={words.search}
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent outline-none"
          />
        </label>
      </header>

      <div className="hidden overflow-x-auto rounded-xl border border-line md:block">
        <table className="w-full text-left">
          <thead className="bg-bg">
            <tr>
              {columns.map(([key, label, right]) => (
                <th
                  key={key}
                  aria-sort={sort.key === key ? (sort.desc ? 'descending' : 'ascending') : 'none'}
                  className={cx('px-3 py-2', right && 'text-right')}
                >
                  <button
                    type="button"
                    onClick={() => toggle(key)}
                    className={cx(
                      'text-[12px] font-medium hover:text-text',
                      sort.key === key ? 'text-text' : 'text-muted',
                    )}
                  >
                    {label}
                    {sort.key === key && (sort.desc ? ' ↓' : ' ↑')}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((feature) => (
              <tr key={feature.id} className="border-t border-line hover:bg-hover">
                <td className="px-3 py-1.5 font-mono text-[12px]">{feature.id}</td>
                <td className="px-3 py-1.5">
                  <span className="rounded-full border border-line px-2 text-[11px] text-muted">
                    {layerName(feature)}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">{feature.files}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {feature.lines.toLocaleString(t.locale)}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">{feature.ca}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{feature.ce}</td>
                <td className="px-3 py-1.5">
                  <span className="flex justify-end">
                    <InstabilityBar value={feature.instability} />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-2 md:hidden">
        {rows.map((feature) => (
          <li
            key={feature.id}
            className="flex flex-col gap-1.5 rounded-xl border border-line bg-bg px-3 py-2"
          >
            <span className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate font-mono text-[12px]">{feature.id}</span>
              <span className="rounded-full border border-line px-2 text-[11px] text-muted">
                {layerName(feature)}
              </span>
            </span>
            <span className="flex flex-wrap gap-x-3 text-[12px] text-muted">
              <span>
                {words.files} {feature.files}
              </span>
              <span>
                {words.lines} {feature.lines.toLocaleString(t.locale)}
              </span>
              <span>
                {words.ca} {feature.ca}
              </span>
              <span>
                {words.ce} {feature.ce}
              </span>
            </span>
            <InstabilityBar value={feature.instability} />
          </li>
        ))}
      </ul>
    </section>
  )
}
