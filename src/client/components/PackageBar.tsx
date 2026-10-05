import { projectPath } from '../../shared/routes'
import type { Tab } from '../../shared/routes'
import type { Analysis } from '../../shared/types'
import { useT } from '../i18n'
import { navigate } from '../state/router'
import { cx } from '../util/cx'
import { packageIn } from '../util/scope'
import { BAND_BOX, BAND_TEXT, bandOf } from '../util/score'
import { Link } from './Link'

/** Picks the package of a monorepo the whole page is scoped to. */
export const PackageBar = ({
  analysis,
  root,
  tab,
  pkg,
}: {
  analysis: Analysis
  root: string
  tab: Tab
  pkg: string | null
}) => {
  const t = useT()
  const { workspace } = analysis
  if (!workspace) return null
  const info = packageIn(analysis, pkg)
  const score = info ? info.scores.overall : analysis.scores.overall
  const band = bandOf(score)
  const scoped = (dir: string | null) =>
    projectPath(root, tab === 'config' || tab === 'security' ? 'overview' : tab, null, dir)
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor="atlas-package" className="text-muted">
        {t.packages.scope}
      </label>
      <select
        id="atlas-package"
        value={info?.dir ?? ''}
        onChange={(event) => navigate(scoped(event.target.value || null))}
        className="max-w-full min-w-0 rounded-lg border border-line bg-panel px-2 py-1 font-mono text-[12px] hover:bg-hover"
      >
        <option value="">{t.packages.whole(workspace.packages.length)}</option>
        {workspace.packages.map((entry) => (
          <option key={entry.dir} value={entry.dir}>
            {entry.name}
            {entry.name === entry.dir ? '' : ` · ${entry.dir}`}
          </option>
        ))}
      </select>
      {score !== null && (
        <span
          className={cx(
            'rounded-full border px-1.5 text-[11px] leading-4 font-semibold tabular-nums',
            BAND_BOX[band],
            BAND_TEXT[band],
          )}
        >
          {score}
        </span>
      )}
      {info && (
        <Link to={scoped(null)} className="text-accent hover:underline">
          {t.packages.back}
        </Link>
      )}
    </div>
  )
}
