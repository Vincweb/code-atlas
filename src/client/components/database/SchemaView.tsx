import { useMemo, useState } from 'react'
import type { DatabaseResult, DbTable } from '../../../shared/types'
import { useT } from '../../i18n'
import { useWidth } from '../../util/useWidth'
import { SectionTitle } from '../ui'
import { FileLink } from '../viewer'
import { SearchIcon } from '../icons'
import { featureColor, layoutErd } from './erd'
import { TableCard } from './TableCard'

const ALL = '*'

/** The feature shown first: the one with the most tables. */
const largestFeature = (db: DatabaseResult) =>
  [...db.graph.features].sort((a, b) => b.files - a.files || a.id.localeCompare(b.id))[0]?.id ?? ALL

const outsideRoot = (file: string) => file.startsWith('../')

type Focus = { tables: DbTable[]; onFocus: (id: string) => void }

/** A table named by a key: a link when the schema declares it, plain text otherwise. */
const Ref = ({ id, label, tables, onFocus }: { id: string; label: string } & Focus) => {
  const t = useT()
  return tables.some((candidate) => candidate.id === id) ? (
    <button
      type="button"
      onClick={() => onFocus(id)}
      className="font-mono text-[12px] text-accent hover:underline"
    >
      {label}
    </button>
  ) : (
    <span className="font-mono text-[12px] text-muted" title={t.database.schema.unresolved}>
      {label}
    </span>
  )
}

const TableDetails = ({ table, tables, onFocus }: { table: DbTable } & Focus) => {
  const t = useT()
  const words = t.database.schema
  const incoming = tables.flatMap((other) =>
    other.foreignKeys
      .filter((key) => key.table === table.id && other.id !== table.id)
      .map((key) => ({ table: other, key })),
  )
  const focus = { tables, onFocus }
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-line bg-panel p-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="font-mono text-[13px] font-semibold">{table.id}</h3>
        <span className="text-muted">
          {table.feature} · {words.columns(table.columns.length)}
        </span>
      </div>
      <p className="flex flex-wrap items-center gap-2 text-[12px] text-muted">
        {words.declaredIn}
        {outsideRoot(table.file) ? (
          <span className="font-mono" title={words.outsideRoot}>
            {table.file}:{table.line}
          </span>
        ) : (
          <FileLink file={table.file} line={table.line} />
        )}
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <section>
          <SectionTitle>{words.references(table.foreignKeys.length)}</SectionTitle>
          <ul className="flex flex-col gap-0.5 text-[12px]">
            {table.foreignKeys.map((key, index) => (
              <li key={index} className="flex flex-wrap gap-x-1.5">
                <span className="font-mono">{key.columns.join(', ')}</span>
                <span className="text-muted">→</span>
                <Ref
                  id={key.table}
                  label={`${key.table}.${key.targetColumns.join(', ')}`}
                  {...focus}
                />
              </li>
            ))}
            {table.foreignKeys.length === 0 && <li className="text-muted">{t.common.none}</li>}
          </ul>
        </section>
        <section>
          <SectionTitle>{words.referencedBy(incoming.length)}</SectionTitle>
          <ul className="flex flex-col gap-0.5 text-[12px]">
            {incoming.map(({ table: other, key }, index) => (
              <li key={index} className="flex flex-wrap gap-x-1.5">
                <Ref id={other.id} label={`${other.id}.${key.columns.join(', ')}`} {...focus} />
                <span className="text-muted">→</span>
                <span className="font-mono">{key.targetColumns.join(', ')}</span>
              </li>
            ))}
            {incoming.length === 0 && <li className="text-muted">{t.common.none}</li>}
          </ul>
        </section>
      </div>
    </section>
  )
}

/** The tables as cards, the foreign keys as lines between them: one feature at a time, or all. */
export const SchemaView = ({ db }: { db: DatabaseResult }) => {
  const t = useT()
  const words = t.database.schema
  const [feature, setFeature] = useState(() => largestFeature(db))
  const [neighbours, setNeighbours] = useState(true)
  const [query, setQuery] = useState('')
  const [hover, setHover] = useState<string | null>(null)
  const [focus, setFocus] = useState<string | null>(null)
  const [frame, width] = useWidth()

  const colorOf = useMemo(
    () => new Map(db.graph.features.map((node, index) => [node.id, featureColor(index)])),
    [db],
  )
  const { own, others } = useMemo(() => {
    if (feature === ALL) return { own: db.tables, others: [] }
    const ownTables = db.tables.filter((table) => table.feature === feature)
    if (!neighbours) return { own: ownTables, others: [] }
    const ownIds = new Set(ownTables.map((table) => table.id))
    const linked = new Set<string>()
    for (const table of db.tables)
      for (const key of table.foreignKeys) {
        if (ownIds.has(table.id) && !ownIds.has(key.table)) linked.add(key.table)
        if (!ownIds.has(table.id) && ownIds.has(key.table)) linked.add(table.id)
      }
    return { own: ownTables, others: db.tables.filter((table) => linked.has(table.id)) }
  }, [db, feature, neighbours])

  const layout = useMemo(() => layoutErd(own, others, width), [own, others, width])
  const shown = useMemo(() => [...own, ...others], [own, others])

  const active = hover ?? focus
  const related = useMemo(() => {
    const set = new Set<string>()
    if (active === null) return set
    set.add(active)
    for (const edge of layout.edges) {
      if (edge.source === active) set.add(edge.target)
      if (edge.target === active) set.add(edge.source)
    }
    return set
  }, [active, layout])
  const needle = query.trim().toLowerCase()
  const matches = needle
    ? new Set(shown.filter((table) => table.id.toLowerCase().includes(needle)).map((t) => t.id))
    : null

  const focused = focus ? db.tables.find((table) => table.id === focus) : undefined
  const sorted = [...db.graph.features].sort((a, b) => a.id.localeCompare(b.id))

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-muted">
          {words.feature}
          <select
            value={feature}
            onChange={(event) => {
              setFeature(event.target.value)
              setFocus(null)
            }}
            className="rounded-lg border border-line bg-panel px-2 py-1 text-text"
          >
            {sorted.map((node) => (
              <option key={node.id} value={node.id}>
                {node.id} ({node.files})
              </option>
            ))}
            <option value={ALL}>
              {words.all} ({db.tables.length})
            </option>
          </select>
        </label>
        {feature !== ALL && (
          <label className="flex items-center gap-2 text-muted">
            <input
              type="checkbox"
              checked={neighbours}
              onChange={(event) => setNeighbours(event.target.checked)}
            />
            {words.neighbours}
          </label>
        )}
        <label className="flex min-w-48 flex-1 items-center gap-2 rounded-lg border border-line bg-panel px-2.5 py-1 sm:max-w-64">
          <SearchIcon className="size-4 text-muted" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={words.search}
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent outline-none"
          />
          {matches && <span className="text-[11px] text-muted">{matches.size}</span>}
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-5 rounded border border-line bg-panel" aria-hidden="true" />
          {words.legend.own}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-5 rounded border border-dashed border-line" aria-hidden="true" />
          {words.legend.other}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="rounded border border-edge-amber px-1 text-[9px] text-edge-amber uppercase">
            {words.junction}
          </span>
          {words.legend.junction}
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="26" height="8" aria-hidden="true">
            <line x1="1" y1="4" x2="25" y2="4" strokeWidth="2" className="stroke-edge-grey" />
          </svg>
          {words.legend.line}
        </span>
        <span className="ml-auto">{words.hint}</span>
      </div>

      <div
        ref={frame}
        className="relative min-w-0 overflow-auto rounded-xl border border-line bg-bg"
        onClick={() => setFocus(null)}
      >
        {shown.length === 0 ? (
          <p className="p-4 text-muted">{words.noTables}</p>
        ) : (
          <div className="relative" style={{ width: layout.width, height: layout.height }}>
            <svg
              width={layout.width}
              height={layout.height}
              className="absolute inset-0"
              aria-hidden="true"
            >
              <defs>
                <marker
                  id="erd-arrow"
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  markerUnits="userSpaceOnUse"
                  orient="auto"
                >
                  <path d="M0 0 L10 5 L0 10 z" className="fill-edge-grey" />
                </marker>
              </defs>
              {layout.edges.map((edge) => {
                const touched =
                  active !== null && (edge.source === active || edge.target === active)
                return (
                  <path
                    key={edge.key}
                    d={edge.d}
                    fill="none"
                    strokeWidth={touched ? 2 : 1.2}
                    markerEnd="url(#erd-arrow)"
                    className={touched ? 'stroke-accent' : 'stroke-edge-grey'}
                    opacity={active === null ? 0.7 : touched ? 1 : 0.1}
                  />
                )
              })}
            </svg>
            {[...layout.placed.values()].map((placed) => (
              <TableCard
                key={placed.table.id}
                placed={placed}
                color={colorOf.get(placed.table.feature) ?? '#888'}
                active={placed.table.id === active}
                dim={
                  (active !== null && !related.has(placed.table.id)) ||
                  (active === null && matches !== null && !matches.has(placed.table.id))
                }
                onHover={setHover}
                onFocus={(id) => setFocus((current) => (current === id ? null : id))}
              />
            ))}
          </div>
        )}
      </div>

      {focused && (
        <TableDetails
          table={focused}
          tables={db.tables}
          onFocus={(id) => {
            const target = db.tables.find((table) => table.id === id)
            if (target && feature !== ALL && !shown.some((table) => table.id === id))
              setFeature(target.feature)
            setFocus(id)
          }}
        />
      )}
    </div>
  )
}
