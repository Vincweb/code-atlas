import type { ReactNode } from 'react'
import type { Graph as MigrationGraph, MigrationRow } from 'drizzle-graph'
import { useT } from '../../i18n'
import { useMigrationSql } from '../../state/queries'
import { ErrorBox, Spinner } from '../ui'

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <>
    <dt className="text-muted">{label}</dt>
    <dd className="min-w-0 font-mono text-[12px] break-all whitespace-pre-line">{children}</dd>
  </>
)

const Out = ({ href, children }: { href: string; children: ReactNode }) => (
  <a className="text-accent hover:underline" href={href} target="_blank" rel="noreferrer">
    {children}
  </a>
)

/** One migration: what the graph knows about it, then its SQL, read on demand. */
export const MigrationDetails = ({
  row,
  graph,
  root,
}: {
  row: MigrationRow
  graph: MigrationGraph
  root: string
}) => {
  const t = useT()
  const words = t.database.migrations
  const sql = useMigrationSql(root, row.folder)
  return (
    <div className="flex flex-col gap-3">
      <dl className="grid grid-cols-[6rem_minmax(0,1fr)] gap-x-3 gap-y-1 text-[12px]">
        <Field label={words.created}>{row.createdAt || '—'}</Field>
        <Field label={words.snapshot}>{row.id}</Field>
        <Field label={words.parents}>
          {row.parentFolders.length ? row.parentFolders.join('\n') : words.root}
        </Field>
        <Field label={words.statements}>{String(row.statementCount)}</Field>
        <Field label={words.objects}>{row.tables.length ? row.tables.join(', ') : '—'}</Field>
        {row.commit && graph.repoUrl ? (
          <>
            <Field label={words.commit}>
              <Out href={`${graph.repoUrl}/commit/${row.commit.sha}`}>
                {row.commit.sha.slice(0, 10)}
              </Out>
              {row.commit.pr && (
                <>
                  {' · '}
                  <Out href={`${graph.repoUrl}/pull/${row.commit.pr}`}>#{row.commit.pr}</Out>
                </>
              )}
            </Field>
            <Field label={words.subject}>{row.commit.subject}</Field>
          </>
        ) : (
          <Field label={words.commit}>
            {row.commit ? row.commit.sha.slice(0, 10) : words.notCommitted}
          </Field>
        )}
      </dl>
      {sql.isPending && (
        <p className="flex items-center gap-2 text-muted">
          <Spinner /> {t.common.loading}
        </p>
      )}
      {sql.error && <ErrorBox message={sql.error.message} onRetry={() => void sql.refetch()} />}
      {sql.data &&
        (sql.data.sql ? (
          <pre className="max-h-[32rem] overflow-auto rounded-lg border border-line bg-code-bg p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
            {sql.data.sql}
          </pre>
        ) : (
          <p className="text-muted">{words.emptySql}</p>
        ))}
    </div>
  )
}
