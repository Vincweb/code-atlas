import type { ReactNode } from 'react'
import { cx } from '../../cx'
import { useT } from '../../i18n'
import { FileLink } from '../viewer'

export type RankItem = {
  key: string
  value: number
  title: ReactNode
  file: string
  line: number | null
  detail: string
}

export const Ranking = ({
  title,
  text,
  items,
  limit,
}: {
  title: string
  text: string
  items: RankItem[]
  limit: number | null
}) => {
  const t = useT()
  const peak = Math.max(1, limit ?? 0, ...items.map((item) => item.value))
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-2xl border border-line bg-panel p-5">
      <header>
        <h2 className="text-[16px] font-semibold tracking-tight">{title}</h2>
        <p className="text-[12px] leading-relaxed text-muted">{text}</p>
      </header>
      <ol className="flex flex-col gap-2.5">
        {items.map((item, index) => {
          const over = limit !== null && item.value > limit
          return (
            <li key={item.key} className="flex flex-col gap-1">
              <div className="flex items-baseline gap-2">
                <span className="w-5 shrink-0 text-right text-[11px] text-muted tabular-nums">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">{item.title}</span>
                <span
                  className={cx(
                    'shrink-0 font-semibold tabular-nums',
                    over ? 'text-bad' : 'text-text',
                  )}
                >
                  {item.value.toLocaleString(t.locale)}
                </span>
              </div>
              <div className="relative ml-7 h-1.5 rounded-full bg-line">
                <span
                  className={cx('block h-full rounded-full', over ? 'bg-bad' : 'bg-accent/70')}
                  style={{ width: `${(item.value / peak) * 100}%` }}
                />
                {limit !== null && (
                  <span
                    title={t.metrics.limit(limit)}
                    className="absolute -top-1 h-3.5 w-0.5 rounded bg-text"
                    style={{ left: `${(limit / peak) * 100}%` }}
                  />
                )}
              </div>
              <div className="ml-7 flex flex-wrap gap-x-3 text-[11px] text-muted">
                <FileLink file={item.file} line={item.line} className="text-[11px]" />
                <span>{item.detail}</span>
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
