import { useMemo, useState } from 'react'
import { projectPath } from '../../../shared/routes'
import type { Analysis, PackageInfo } from '../../../shared/types'
import { cx } from '../../util/cx'
import { useT } from '../../i18n'
import { BAND_BOX, BAND_TEXT, bandOf } from '../../util/score'
import { Link } from '../Link'
import { SearchIcon } from '../welcome/icons'

type SortKey = 'name' | 'files' | 'lines' | 'score' | `family:${string}`

const Score = ({ value, large = false }: { value: number | null; large?: boolean }) => {
  const band = bandOf(value)
  return large ? (
    <span
      className={cx(
        'inline-flex min-w-9 justify-center rounded-lg border px-1.5 py-0.5 font-semibold tabular-nums',
        BAND_BOX[band],
        BAND_TEXT[band],
      )}
    >
      {value ?? '–'}
    </span>
  ) : (
    <span className={cx('tabular-nums', BAND_TEXT[band])}>{value ?? '–'}</span>
  )
}

const familyScore = (pkg: PackageInfo, family: string) =>
  pkg.scores.families.find((entry) => entry.family === family)?.score ?? null

/** Every package of a monorepo with its scores, worst first, each one a way into its own page. */
export const Packages = ({ analysis, root }: { analysis: Analysis; root: string }) => {
  const t = useT()
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'score', desc: false })
  const [query, setQuery] = useState('')
  const families = analysis.scores.families.map((family) => family.family)
  const packages = analysis.workspace?.packages

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const value = (pkg: PackageInfo): string | number => {
      if (sort.key === 'name') return pkg.name
      if (sort.key === 'files') return pkg.stats.files
      if (sort.key === 'lines') return pkg.stats.lines
      const score = sort.key === 'score' ? pkg.scores.overall : familyScore(pkg, sort.key.slice(7))
      return score ?? Number.MAX_SAFE_INTEGER
    }
    const sign = sort.desc ? -1 : 1
    return (packages ?? [])
      .filter(
        (pkg) =>
          !needle ||
          pkg.name.toLowerCase().includes(needle) ||
          pkg.dir.toLowerCase().includes(needle),
      )
      .sort((a, b) => {
        const x = value(a)
        const y = value(b)
        const order =
          typeof x === 'number' && typeof y === 'number'
            ? x - y
            : String(x).localeCompare(String(y))
        return order * sign || b.stats.lines - a.stats.lines
      })
  }, [packages, sort, query])

  if (!packages) return null
  const columns: [SortKey, string, boolean][] = [
    ['name', t.packages.head.name, false],
    ['files', t.packages.head.files, true],
    ['lines', t.packages.head.lines, true],
    ...families.map((family): [SortKey, string, boolean] => [
      `family:${family}`,
      t.families[family] ?? family,
      true,
    ]),
    ['score', t.packages.head.score, true],
  ]
  const toggle = (key: SortKey) =>
    setSort({
      key,
      desc: sort.key === key ? !sort.desc : key === 'files' || key === 'lines',
    })
  const open = (pkg: PackageInfo) => projectPath(root, 'overview', null, pkg.dir)

  return (
    <section className="flex flex-col gap-3">
      <header className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[16px] font-semibold tracking-tight">{t.packages.title}</h2>
          <p className="max-w-3xl text-[12px] leading-relaxed text-muted">{t.packages.intro}</p>
        </div>
        <label className="flex w-full items-center gap-2 rounded-lg border border-line bg-panel px-2.5 py-1 sm:w-56">
          <SearchIcon className="size-4 text-muted" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.packages.search}
            aria-label={t.packages.search}
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent outline-none"
          />
        </label>
      </header>

      {rows.length === 0 && <p className="text-muted">{t.packages.noMatch}</p>}

      <div className="hidden overflow-x-auto rounded-xl border border-line bg-panel md:block">
        <table className="w-full text-left">
          <thead className="bg-bg">
            <tr>
              {columns.map(([key, label, right]) => (
                <th
                  key={key}
                  aria-sort={sort.key === key ? (sort.desc ? 'descending' : 'ascending') : 'none'}
                  className={cx('px-3 py-2', right && 'text-right')}
                >
                  <button
                    type="button"
                    onClick={() => toggle(key)}
                    className={cx(
                      'text-[12px] font-medium whitespace-nowrap hover:text-text',
                      sort.key === key ? 'text-text' : 'text-muted',
                    )}
                  >
                    {label}
                    {sort.key === key && (sort.desc ? ' ↓' : ' ↑')}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((pkg) => (
              <tr key={pkg.dir} className="border-t border-line hover:bg-hover">
                <td className="px-3 py-1.5">
                  <Link to={open(pkg)} className="flex flex-col hover:underline">
                    <span className="font-medium">{pkg.name}</span>
                    {pkg.name !== pkg.dir && (
                      <span className="font-mono text-[11px] text-muted">{pkg.dir}</span>
                    )}
                  </Link>
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">{pkg.stats.files}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {pkg.stats.lines.toLocaleString(t.locale)}
                </td>
                {families.map((family) => (
                  <td key={family} className="px-3 py-1.5 text-right">
                    <Score value={familyScore(pkg, family)} />
                  </td>
                ))}
                <td className="px-3 py-1.5 text-right">
                  <Score value={pkg.scores.overall} large />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-2 md:hidden">
        {rows.map((pkg) => (
          <li key={pkg.dir}>
            <Link
              to={open(pkg)}
              className="flex items-center gap-3 rounded-xl border border-line bg-panel px-3 py-2 hover:bg-hover"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium">{pkg.name}</span>
                <span className="flex flex-wrap gap-x-3 text-[12px] text-muted">
                  <span>
                    {t.packages.head.files} {pkg.stats.files}
                  </span>
                  <span>
                    {t.packages.head.lines} {pkg.stats.lines.toLocaleString(t.locale)}
                  </span>
                </span>
              </span>
              <Score value={pkg.scores.overall} large />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
