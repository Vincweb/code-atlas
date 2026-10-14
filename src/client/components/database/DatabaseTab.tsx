import { useState } from 'react'
import { projectPath } from '../../../shared/routes'
import type { Analysis, DatabaseResult } from '../../../shared/types'
import { cx } from '../../util/cx'
import { useT } from '../../i18n'
import { Chip, Warnings } from '../ui'
import { Link } from '../Link'
import { FeaturesView } from './FeaturesView'
import { MigrationsView } from './MigrationsView'
import { SchemaView } from './SchemaView'

type View = 'schema' | 'features' | 'migrations'

const VIEWS: View[] = ['schema', 'features', 'migrations']
const VIEW_KEY = 'code-atlas.database-view'

const useView = () => {
  const [view, setView] = useState<View>(() => {
    try {
      const saved = localStorage.getItem(VIEW_KEY)
      return VIEWS.includes(saved as View) ? (saved as View) : 'schema'
    } catch {
      return 'schema'
    }
  })
  const update = (next: View) => {
    setView(next)
    try {
      localStorage.setItem(VIEW_KEY, next)
    } catch {
      return
    }
  }
  return [view, update] as const
}

const EmptyState = ({ root }: { root: string }) => {
  const t = useT()
  const words = t.database.empty
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-dashed border-line bg-panel p-5">
      <h2 className="text-[16px] font-semibold tracking-tight">{words.title}</h2>
      <p className="max-w-3xl leading-relaxed text-muted">{words.text}</p>
      <p className="max-w-3xl text-[12px] leading-relaxed text-muted">{words.readOnly}</p>
      <Link to={projectPath(root, 'config')} className="w-fit text-accent hover:underline">
        {t.database.config.openConfig} →
      </Link>
    </section>
  )
}

const Header = ({ db, root }: { db: DatabaseResult; root: string }) => {
  const t = useT()
  const words = t.database
  const chosen = db.configs.find((config) => config.chosen)
  const { stats } = db
  const tiles: [string, string][] = [
    [words.tiles.tables, String(stats.tables)],
    [words.tiles.columns, stats.columns.toLocaleString(t.locale)],
    [words.tiles.foreignKeys, String(stats.foreignKeys)],
    [words.tiles.features, String(stats.features)],
    [words.tiles.junctions, String(stats.junctions)],
    [words.tiles.migrations, db.migrations ? String(db.migrations.count) : '—'],
  ]
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-line bg-panel p-5">
      <p className="max-w-3xl leading-relaxed text-muted">{words.intro}</p>
      <div className="grid grid-cols-3 gap-3 lg:grid-cols-6">
        {tiles.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-line bg-bg px-4 py-3">
            <div className="text-[12px] text-muted">{label}</div>
            <div className="text-[22px] font-semibold tabular-nums">{value}</div>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] font-semibold text-muted">{words.config.title}</span>
          {chosen && <Chip className="border-accent/40 text-accent">{chosen.path}</Chip>}
          {chosen?.dialect && <Chip>{chosen.dialect}</Chip>}
          {chosen?.schema.map((entry) => (
            <Chip key={entry}>
              {words.config.schema} {entry}
            </Chip>
          ))}
          {chosen?.out && (
            <Chip>
              {words.config.out} {chosen.out}
            </Chip>
          )}
          <span className="text-[12px] text-muted">{words.config.files(db.files.length)}</span>
          {db.configs.length > 1 && (
            <span className="text-[12px] text-muted">
              {words.config.others(db.configs.length - 1)}
            </span>
          )}
        </div>
        <p className="flex flex-wrap items-center gap-2 text-[12px] text-muted">
          {db.featuresSource === 'config'
            ? words.config.featuresConfig
            : words.config.featuresPrefix}
          <Link to={projectPath(root, 'config')} className="text-accent hover:underline">
            {words.config.openConfig} →
          </Link>
        </p>
      </div>
      <Warnings warnings={db.warnings} />
    </section>
  )
}

export const DatabaseTab = ({ analysis, root }: { analysis: Analysis; root: string }) => {
  const t = useT()
  const [view, setView] = useView()
  const db = analysis.database
  if (!db) return <EmptyState root={root} />
  return (
    <div className="flex flex-col gap-4 pb-10">
      <Header db={db} root={root} />
      <div className="inline-flex w-fit rounded-lg border border-line bg-panel p-0.5">
        {VIEWS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setView(value)}
            aria-pressed={view === value}
            className={cx(
              'rounded-md px-3 py-1',
              view === value ? 'bg-accent text-white' : 'text-muted hover:bg-hover hover:text-text',
            )}
          >
            {t.database.views[value]}
          </button>
        ))}
      </div>
      {view === 'schema' && <SchemaView db={db} />}
      {view === 'features' && <FeaturesView db={db} root={root} />}
      {view === 'migrations' && <MigrationsView db={db} root={root} />}
    </div>
  )
}
