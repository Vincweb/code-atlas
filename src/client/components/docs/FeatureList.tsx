import { useState } from 'react'
import { cx } from '../../util/cx'
import { useT } from '../../i18n'
import { SearchIcon } from '../icons'
import { commonParent, isDocumented, shortId } from './model'
import type { Entry, Group } from './model'

type Filter = 'all' | 'missing'

const FILTERS: Filter[] = ['all', 'missing']

const matches = (entry: Entry, needle: string) =>
  !needle ||
  entry.node.id.toLowerCase().includes(needle) ||
  (entry.doc?.description ?? '').toLowerCase().includes(needle)

const Item = ({
  entry,
  parent,
  active,
  onSelect,
}: {
  entry: Entry
  parent: string
  active: boolean
  onSelect: (id: string) => void
}) => {
  const t = useT()
  const documented = isDocumented(entry)
  const description = entry.doc?.description
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(entry.node.id)}
        aria-current={active ? 'true' : undefined}
        className={cx(
          'flex w-full flex-col gap-0.5 rounded-lg px-2 py-1.5 text-left',
          active ? 'bg-accent/10' : 'hover:bg-hover',
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden="true"
            className={cx('size-1.5 shrink-0 rounded-full', documented ? 'bg-good' : 'bg-line')}
          />
          <span
            title={entry.node.id}
            className={cx('truncate font-mono text-[12px]', active && 'font-semibold text-accent')}
          >
            {shortId(entry.node.id, parent)}
          </span>
        </span>
        {description ? (
          <span className="line-clamp-2 pl-3.5 text-[12px] text-muted">{description}</span>
        ) : (
          !documented && (
            <span className="pl-3.5 text-[12px] text-muted italic">{t.docs.noDoc}</span>
          )
        )}
      </button>
    </li>
  )
}

/** The features to pick from, by layer, with a search and a filter on those without a doc. */
export const FeatureList = ({
  groups,
  selected,
  onSelect,
}: {
  groups: Group[]
  selected: string | null
  onSelect: (id: string) => void
}) => {
  const t = useT()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const needle = query.trim().toLowerCase()
  const parent = commonParent(groups.flatMap((group) => group.entries.map((e) => e.node.id)))
  const visible = groups
    .map((group) => ({
      ...group,
      entries: group.entries.filter(
        (entry) => (filter === 'all' || !isDocumented(entry)) && matches(entry, needle),
      ),
    }))
    .filter((group) => group.entries.length > 0)

  return (
    <aside className="flex min-w-0 flex-col gap-2 rounded-2xl border border-line bg-panel p-3 lg:sticky lg:top-14 lg:max-h-[calc(100vh-4.5rem)]">
      <label className="flex items-center gap-2 rounded-lg border border-line bg-bg px-2.5 py-1.5 focus-within:border-accent">
        <SearchIcon className="size-3.5 shrink-0 text-muted" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t.docs.search}
          aria-label={t.docs.search}
          className="min-w-0 flex-1 bg-transparent outline-none"
        />
      </label>
      <div className="inline-flex w-fit rounded-lg border border-line bg-bg p-0.5">
        {FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            aria-pressed={filter === value}
            className={cx(
              'rounded-md px-2.5 py-0.5 text-[12px]',
              filter === value ? 'bg-accent text-white' : 'text-muted hover:text-text',
            )}
          >
            {t.docs.filters[value]}
          </button>
        ))}
      </div>
      {parent && <p className="truncate px-2 font-mono text-[11px] text-muted">{parent}/</p>}
      <div className="-mx-1 min-h-0 overflow-y-auto px-1">
        {visible.length === 0 ? (
          <p className="px-2 py-3 text-muted">{t.docs.noMatch}</p>
        ) : (
          visible.map((group) => (
            <div key={group.name ?? ''} className="flex flex-col pb-1">
              {group.name && (
                <h3 className="px-2 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-muted uppercase">
                  {group.name}
                </h3>
              )}
              <ul className="flex flex-col">
                {group.entries.map((entry) => (
                  <Item
                    key={entry.node.id}
                    entry={entry}
                    parent={parent}
                    active={entry.node.id === selected}
                    onSelect={onSelect}
                  />
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </aside>
  )
}
