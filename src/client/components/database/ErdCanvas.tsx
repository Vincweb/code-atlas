import type { RefObject } from 'react'
import { useT } from '../../i18n'
import type { ErdLayout } from './erd'
import { TableCard } from './TableCard'

/** The tables as cards, the foreign keys as arrows; the active table's are lit, the rest dimmed. */
export const ErdCanvas = ({
  frame,
  layout,
  empty,
  colorOf,
  active,
  dimmed,
  onHover,
  onFocus,
  onClear,
}: {
  frame: RefObject<HTMLDivElement | null>
  layout: ErdLayout
  empty: boolean
  colorOf: Map<string, string | undefined>
  active: string | null
  dimmed: (table: string) => boolean
  onHover: (table: string | null) => void
  onFocus: (table: string) => void
  onClear: () => void
}) => {
  const t = useT()
  return (
    <div
      ref={frame}
      className="relative min-w-0 overflow-auto rounded-xl border border-line bg-bg"
      onClick={onClear}
    >
      {empty ? (
        <p className="p-4 text-muted">{t.database.schema.noTables}</p>
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
              const touched = active !== null && (edge.source === active || edge.target === active)
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
              dim={dimmed(placed.table.id)}
              onHover={onHover}
              onFocus={onFocus}
            />
          ))}
        </div>
      )}
    </div>
  )
}
