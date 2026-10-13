import { useState } from 'react'
import type { MigrationRow } from 'drizzle-graph'
import type { DatabaseResult } from '../../../shared/types'
import { cx } from '../../util/cx'
import { useT } from '../../i18n'
import { useMigrations } from '../../state/queries'
import { Badge, ErrorBox, Spinner } from '../ui'
import { SearchIcon } from '../welcome/icons'
import { MigrationDetails } from './MigrationDetails'
import { MigrationLanes, ROW_HEIGHT } from './MigrationLanes'

/** The filter dims rather than hides, so the rows stay lined up with their lanes. */
const matches = (row: MigrationRow, term: string) =>
  [row.folder, row.commit?.subject ?? '', row.commit?.sha ?? '', ...row.tables]
    .join(' ')
    .toLowerCase()
    .includes(term)

const Tag = ({ className, children }: { className?: string; children: string }) => (
  <span
    className={cx(
      'ml-1.5 shrink-0 rounded border px-1 text-[10px] leading-4 tracking-wide uppercase',
      className,
    )}
  >
    {children}
  </span>
)

const Row = ({
  row,
  selected,
  dimmed,
  onSelect,
}: {
  row: MigrationRow
  selected: boolean
  dimmed: boolean
  onSelect: () => void
}) => {
  const t = useT()
  const words = t.database.migrations
  return (
    <li
      tabIndex={0}
      style={{ height: ROW_HEIGHT }}
      className={cx(
        'grid cursor-pointer grid-cols-[minmax(0,1fr)_108px] items-center gap-2.5 rounded-md px-2.5 whitespace-nowrap md:grid-cols-[minmax(180px,34%)_minmax(0,1fr)_108px]',
        'hover:bg-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
        selected && 'bg-hover shadow-[inset_0_0_0_1px_var(--color-accent)]',
        dimmed && 'opacity-20',
      )}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        onSelect()
      }}
    >
      <span className={cx('flex min-w-0 items-center', row.phantom && 'text-muted italic')}>
        <span className="truncate font-medium">{row.name}</span>
        {row.isMerge && <Tag className="border-line text-muted">{words.merge}</Tag>}
        {row.isHead && <Tag className="border-accent text-accent">{words.head}</Tag>}
      </span>
      <span className="hidden gap-1.5 overflow-hidden md:flex">
        {row.badges.map((badge) => (
          <span
            key={badge.kind}
            className={cx(
              'shrink-0 rounded-full border border-line bg-code-bg px-1.5 text-[11px]',
              badge.kind.endsWith('-') && 'border-warn-line',
              ['table', 'column+', 'matview+'].includes(badge.kind) ? 'text-text' : 'text-muted',
            )}
          >
            {badge.label}
          </span>
        ))}
      </span>
      <span className="truncate text-[12px] text-muted tabular-nums">
        {row.createdAt || (row.commit ? '' : words.uncommitted)}
      </span>
    </li>
  )
}

/** The migration DAG the way drizzle-graph draws it, with the SQL of each migration on demand. */
export const MigrationsView = ({ db, root }: { db: DatabaseResult; root: string }) => {
  const t = useT()
  const words = t.database.migrations
  const info = db.migrations
  const query = useMigrations(root, info?.layout === 'v1')
  const [selected, setSelected] = useState<string | null>(null)
  const [filter, setFilter] = useState('')

  if (!info)
    return <p className="rounded-xl border border-line bg-panel p-4 text-muted">{words.none}</p>
  if (info.layout === 'v0')
    return (
      <p className="rounded-xl border border-line bg-panel p-4 text-muted">{words.v0(info.dir)}</p>
    )
  if (query.isPending)
    return (
      <p className="flex items-center gap-2 text-muted">
        <Spinner /> {words.loading}
      </p>
    )
  if (query.error)
    return <ErrorBox message={query.error.message} onRetry={() => void query.refetch()} />

  const { graph } = query.data
  const rows = graph.rows
  const term = filter.trim().toLowerCase()
  const selectedRow = rows.find((row) => row.folder === selected)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-semibold">{words.count(rows.length)}</span>
        <span title={words.headsHelp}>
          <Badge
            className={
              graph.heads.length > 1
                ? 'border-bad-line bg-bad-bg text-bad'
                : 'border-good-line bg-good-bg text-good'
            }
          >
            {words.heads(graph.heads.length)}
          </Badge>
        </span>
        {graph.unresolved.length > 0 && (
          <Badge className="border-warn-line bg-warn-bg text-warn">
            {words.unresolved(graph.unresolved.length)}
          </Badge>
        )}
        <label className="flex min-w-48 flex-1 items-center gap-2 rounded-lg border border-line bg-panel px-2.5 py-1 sm:max-w-64">
          <SearchIcon className="size-4 text-muted" />
          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder={words.filter}
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent outline-none"
          />
        </label>
        <span className="ml-auto text-[12px] text-muted">{words.credit}</span>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 items-start overflow-x-auto rounded-xl border border-line bg-panel py-2 pr-2">
          <MigrationLanes
            rows={rows}
            laneCount={graph.laneCount}
            selected={selected}
            onSelect={setSelected}
          />
          <ol className="min-w-0 flex-1">
            {rows.map((row) => (
              <Row
                key={row.folder}
                row={row}
                selected={row.folder === selected}
                dimmed={term.length > 0 && !matches(row, term)}
                onSelect={() => setSelected(row.folder === selected ? null : row.folder)}
              />
            ))}
          </ol>
        </div>
        {selectedRow && (
          <aside className="flex flex-col gap-3 rounded-xl border border-line bg-panel p-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:w-[26rem] lg:shrink-0 lg:overflow-y-auto">
            <div className="flex items-start gap-2">
              <h3 className="min-w-0 flex-1 font-mono text-[12px] font-semibold break-all">
                {selectedRow.folder}
              </h3>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label={words.close}
                title={words.close}
                className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-text"
              >
                ×
              </button>
            </div>
            <MigrationDetails row={selectedRow} graph={graph} root={root} />
          </aside>
        )}
      </div>
    </div>
  )
}
