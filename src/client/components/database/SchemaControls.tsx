import type { DatabaseResult } from '../../../shared/types'
import { useT } from '../../i18n'
import { SearchIcon } from '../icons'
import { ALL } from './erd'

/** The feature shown, whether its neighbours come along, and the search over the tables shown. */
export const SchemaToolbar = ({
  db,
  feature,
  onFeature,
  neighbours,
  onNeighbours,
  query,
  onQuery,
  matches,
}: {
  db: DatabaseResult
  feature: string
  onFeature: (feature: string) => void
  neighbours: boolean
  onNeighbours: (neighbours: boolean) => void
  query: string
  onQuery: (query: string) => void
  /** How many tables the search matches, or null without a search. */
  matches: number | null
}) => {
  const t = useT()
  const words = t.database.schema
  const sorted = [...db.graph.features].sort((a, b) => a.id.localeCompare(b.id))
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-muted">
        {words.feature}
        <select
          value={feature}
          onChange={(event) => onFeature(event.target.value)}
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
            onChange={(event) => onNeighbours(event.target.checked)}
          />
          {words.neighbours}
        </label>
      )}
      <label className="flex min-w-48 flex-1 items-center gap-2 rounded-lg border border-line bg-panel px-2.5 py-1 sm:max-w-64">
        <SearchIcon className="size-4 text-muted" />
        <input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder={words.search}
          spellCheck={false}
          className="min-w-0 flex-1 bg-transparent outline-none"
        />
        {matches !== null && <span className="text-[11px] text-muted">{matches}</span>}
      </label>
    </div>
  )
}

export const SchemaLegend = () => {
  const t = useT()
  const words = t.database.schema
  return (
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
  )
}
