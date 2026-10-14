import { useMemo, useState } from 'react'
import type { DatabaseResult } from '../../../shared/types'
import { useWidth } from '../../util/useWidth'
import { ErdCanvas } from './ErdCanvas'
import { SchemaLegend, SchemaToolbar } from './SchemaControls'
import { TableDetails } from './TableDetails'
import { ALL, featureColor, layoutErd, relatedTables, tablesInView } from './erd'

/** The feature shown first: the one with the most tables. */
const largestFeature = (db: DatabaseResult) =>
  [...db.graph.features].sort((a, b) => b.files - a.files || a.id.localeCompare(b.id))[0]?.id ?? ALL

/** The tables as cards, the foreign keys as lines between them: one feature at a time, or all. */
export const SchemaView = ({ db }: { db: DatabaseResult }) => {
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
  const { own, others } = useMemo(
    () => tablesInView(db, feature, neighbours),
    [db, feature, neighbours],
  )
  const layout = useMemo(() => layoutErd(own, others, width), [own, others, width])
  const shown = useMemo(() => [...own, ...others], [own, others])

  const active = hover ?? focus
  const related = useMemo(() => relatedTables(active, layout.edges), [active, layout])
  const needle = query.trim().toLowerCase()
  const matches = needle
    ? new Set(
        shown.filter((table) => table.id.toLowerCase().includes(needle)).map((table) => table.id),
      )
    : null
  const focused = focus ? db.tables.find((table) => table.id === focus) : undefined

  return (
    <div className="flex flex-col gap-3">
      <SchemaToolbar
        db={db}
        feature={feature}
        onFeature={(id) => {
          setFeature(id)
          setFocus(null)
        }}
        neighbours={neighbours}
        onNeighbours={setNeighbours}
        query={query}
        onQuery={setQuery}
        matches={matches?.size ?? null}
      />
      <SchemaLegend />
      <ErdCanvas
        frame={frame}
        layout={layout}
        empty={shown.length === 0}
        colorOf={colorOf}
        active={active}
        dimmed={(id) =>
          (active !== null && !related.has(id)) ||
          (active === null && matches !== null && !matches.has(id))
        }
        onHover={setHover}
        onFocus={(id) => setFocus((current) => (current === id ? null : id))}
        onClear={() => setFocus(null)}
      />
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
