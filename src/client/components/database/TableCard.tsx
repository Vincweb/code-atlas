import type { DbColumn } from '../../../shared/types'
import { cx } from '../../util/cx'
import { useT } from '../../i18n'
import { CARD_W, HEADER_H, ROW_H } from './erd'
import type { Placed } from './erd'

const Tag = ({ className, children }: { className?: string; children: string }) => (
  <span
    className={cx(
      'shrink-0 rounded border px-1 text-[9px] leading-[14px] font-semibold tracking-wide uppercase',
      className,
    )}
  >
    {children}
  </span>
)

const ColumnRow = ({ column }: { column: DbColumn }) => {
  const t = useT()
  const words = t.database.schema
  return (
    <li
      className="flex items-center gap-1.5 px-2 font-mono text-[11px] leading-none"
      style={{ height: ROW_H }}
      title={`${column.sqlName ?? column.name}: ${column.type}${column.notNull ? ' not null' : ''}${
        column.references ? ` → ${column.references.table}.${column.references.column}` : ''
      }`}
    >
      <span className={cx('truncate', column.primaryKey && 'font-semibold')}>{column.name}</span>
      <span className="ml-auto truncate text-[10px] text-muted">{column.type}</span>
      {column.primaryKey && <Tag className="border-accent/50 text-accent">{words.pk}</Tag>}
      {column.references && !column.primaryKey && <Tag className="border-line text-muted">FK</Tag>}
    </li>
  )
}

type Props = {
  placed: Placed
  color: string
  active: boolean
  dim: boolean
  onHover: (id: string | null) => void
  onFocus: (id: string) => void
}

/** One table of the schema diagram: its name, then one row per column with its type and keys. */
export const TableCard = ({ placed, color, active, dim, onHover, onFocus }: Props) => {
  const t = useT()
  const words = t.database.schema
  const { table } = placed
  return (
    <div
      role="button"
      tabIndex={0}
      onMouseEnter={() => onHover(table.id)}
      onMouseLeave={() => onHover(null)}
      onClick={(event) => {
        event.stopPropagation()
        onFocus(table.id)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onFocus(table.id)
        }
      }}
      style={{ left: placed.x, top: placed.y, width: CARD_W, height: placed.height }}
      className={cx(
        'absolute cursor-pointer overflow-hidden rounded-lg border bg-panel shadow-sm transition-opacity',
        active ? 'border-accent ring-1 ring-accent' : 'border-line',
        !placed.own && 'border-dashed',
        dim && 'opacity-20',
      )}
    >
      <header
        className="flex items-center gap-1.5 border-b border-line px-2"
        style={{ height: HEADER_H, borderLeft: `3px solid ${color}` }}
      >
        <span className="truncate font-mono text-[12px] font-semibold">{table.name}</span>
        {table.schema && <Tag className="border-line text-muted">{table.schema}</Tag>}
        {table.kind === 'view' && <Tag className="border-line text-muted">{words.view}</Tag>}
        {table.junction && (
          <Tag className="border-edge-amber text-edge-amber">{words.junction}</Tag>
        )}
      </header>
      <ul className="py-[3px]">
        {table.columns.map((column) => (
          <ColumnRow key={column.name} column={column} />
        ))}
      </ul>
    </div>
  )
}
