import type { Analysis } from '../../../shared/types'
import { cx } from '../../util/cx'
import { useT } from '../../i18n'
import { BAND_BOX, BAND_TEXT, bandOf } from '../../util/score'
import type { Band } from '../../util/score'
import { extremesOf } from './model'

const RING: Record<Band, string> = {
  good: 'stroke-good',
  warn: 'stroke-warn',
  bad: 'stroke-bad',
  none: 'stroke-none',
}

const RADIUS = 52
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

const ScoreRing = ({ score }: { score: number | null }) => {
  const band = bandOf(score)
  const filled = ((score ?? 0) / 100) * CIRCUMFERENCE
  return (
    <svg viewBox="0 0 128 128" className="size-32 shrink-0" aria-hidden="true">
      <circle cx="64" cy="64" r={RADIUS} fill="none" strokeWidth="10" className="stroke-line" />
      <circle
        cx="64"
        cy="64"
        r={RADIUS}
        fill="none"
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${CIRCUMFERENCE}`}
        transform="rotate(-90 64 64)"
        className={RING[band]}
      />
      <text
        x="64"
        y="72"
        textAnchor="middle"
        className={cx('text-[30px] font-semibold', `fill-current ${BAND_TEXT[band]}`)}
      >
        {score ?? '–'}
      </text>
    </svg>
  )
}

const SEVERITY_ROWS = [
  ['critical', 1, 8],
  ['high', 3, 4],
  ['medium', 6, 2],
  ['low', 12, 1],
] as const

export const Summary = ({ analysis }: { analysis: Analysis }) => {
  const t = useT()
  const { scores, baseline, rules } = analysis
  const band = bandOf(scores.overall)
  const extremes = extremesOf(scores.families)
  const failing = rules.filter((rule) => rule.status === 'fail').length
  const pending = rules.filter((rule) => rule.status === 'not-run').length
  const familyName = (family: string) => t.families[family] ?? family
  const before = baseline?.scores.overall ?? null

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-line bg-panel p-5 sm:flex-row sm:items-center sm:gap-6">
      <ScoreRing score={scores.overall} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <span
          className={cx(
            'w-fit rounded-full border px-2.5 py-0.5 text-[12px] font-medium',
            BAND_BOX[band],
            BAND_TEXT[band],
          )}
        >
          {t.overview.overall} · {t.learn.bands[band]}
        </span>
        <h2 className="text-[20px] font-semibold tracking-tight">{t.learn.verdict[band]}</h2>
        <p className="text-[14px] leading-relaxed text-muted">
          {extremes && (
            <>
              {t.learn.strongest(familyName(extremes.best.family), extremes.best.score)}{' '}
              {t.learn.weakest(familyName(extremes.worst.family), extremes.worst.score)}{' '}
            </>
          )}
          {t.learn.tally(failing, rules.length, pending)}
          {scores.overall !== null && before !== null && (
            <> {t.learn.sinceBaseline(scores.overall - before)}</>
          )}
        </p>
        <details className="group mt-1">
          <summary className="w-fit cursor-pointer text-accent hover:underline">
            {t.learn.howTitle}
          </summary>
          <div className="mt-3 flex flex-col gap-3 rounded-xl border border-line bg-bg p-4 leading-relaxed">
            {t.learn.how.map((line) => (
              <p key={line}>{line}</p>
            ))}
            <table className="w-fit text-[12px]">
              <thead>
                <tr className="text-left text-muted">
                  {t.learn.tableHead.map((label) => (
                    <th key={label} className="pr-6 pb-1 font-medium">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SEVERITY_ROWS.map(([severity, half, weight]) => (
                  <tr key={severity}>
                    <td className="pr-6 font-medium">{t.severity[severity]}</td>
                    <td className="pr-6 tabular-nums">{t.learn.problems(half)}</td>
                    <td className="tabular-nums">×{weight}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-muted">{t.learn.scale}</p>
          </div>
        </details>
      </div>
    </section>
  )
}
