import { projectPath } from '../../../shared/routes'
import { cx } from '../../cx'
import { useT } from '../../i18n'
import { forgetProject, useRecentProjects } from '../../recent'
import { relativeTime } from '../../util/format'
import { BAND_BOX, BAND_TEXT, bandOf } from '../../util/score'
import { Link } from '../Link'

export const tildePath = (path: string, home: string | undefined) =>
  home && (path === home || path.startsWith(`${home}/`)) ? `~${path.slice(home.length)}` : path

export const RecentProjects = ({ home, wide }: { home: string | undefined; wide: boolean }) => {
  const t = useT()
  const recent = useRecentProjects()

  return (
    <section className="flex min-w-0 flex-col gap-3">
      <h3 className="text-[11px] font-semibold tracking-wide text-muted uppercase">
        {t.recent.title}
      </h3>
      {recent.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-muted">
          {t.recent.empty}
        </p>
      ) : (
        <ul className={cx('grid grid-cols-1 gap-2', wide && 'sm:grid-cols-2 lg:grid-cols-3')}>
          {recent.map((project) => {
            const band = bandOf(project.overall)
            return (
              <li key={project.root} className="group relative">
                <Link
                  to={projectPath(project.root)}
                  className="flex items-center gap-3 rounded-xl border border-line bg-bg px-3 py-2.5 pr-9 hover:border-accent"
                >
                  <span
                    title={t.recent.score}
                    className={cx(
                      'flex size-10 shrink-0 items-center justify-center rounded-lg border text-[14px] font-semibold tabular-nums',
                      BAND_BOX[band],
                      BAND_TEXT[band],
                    )}
                  >
                    {project.overall ?? '–'}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{project.label}</span>
                    <span className="block truncate font-mono text-[11px] text-muted">
                      {tildePath(project.root, home)}
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] text-muted">
                    {relativeTime(project.openedAt, t.locale)}
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => forgetProject(project.root)}
                  aria-label={t.recent.remove}
                  title={t.recent.remove}
                  className="absolute top-1.5 right-1.5 hidden size-6 items-center justify-center rounded-md text-muted group-hover:flex hover:bg-hover hover:text-text focus-visible:flex"
                >
                  ×
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
