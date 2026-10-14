import type { DbTable } from '../../../shared/types'
import { useT } from '../../i18n'
import { SectionTitle } from '../ui'
import { FileLink } from '../viewer'

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

export const TableDetails = ({ table, tables, onFocus }: { table: DbTable } & Focus) => {
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
