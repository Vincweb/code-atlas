import type { HistoryEntry } from '../../../shared/types'
import { cx } from '../../util/cx'
import { useT } from '../../i18n'
import { BAND_TEXT, bandOf } from '../../util/score'
import type { Band } from '../../util/score'

const WIDTH = 220
const HEIGHT = 56
const PAD = 6
const MAX_POINTS = 30

const STROKE: Record<Band, string> = {
  good: 'stroke-good',
  warn: 'stroke-warn',
  bad: 'stroke-bad',
  none: 'stroke-muted',
}

const FILL: Record<Band, string> = {
  good: 'fill-good',
  warn: 'fill-warn',
  bad: 'fill-bad',
  none: 'fill-muted',
}

/** A score axis never narrower than this, so that noise of a point or two stays flat. */
const MIN_SPAN = 20
const MARGIN = 4

type Point = { x: number; y: number; entry: HistoryEntry; score: number }

/** The axis around the scores shown, within 0–100: a flat line at 79 would hide a drop to 72. */
const axisOf = (scores: number[]) => {
  const min = Math.min(...scores)
  const max = Math.max(...scores)
  const middle = (min + max) / 2
  const half = Math.max(MIN_SPAN, max - min + 2 * MARGIN) / 2
  const low = Math.max(0, Math.min(100 - 2 * half, middle - half))
  return { low, high: Math.min(100, low + 2 * half) }
}

const pointsOf = (entries: HistoryEntry[]): Point[] => {
  const scored = entries.filter(
    (entry): entry is HistoryEntry & { overall: number } => entry.overall !== null,
  )
  const { low, high } = axisOf(scored.map((entry) => entry.overall))
  const step = scored.length > 1 ? (WIDTH - 2 * PAD) / (scored.length - 1) : 0
  return scored.map((entry, index) => ({
    x: PAD + index * step,
    y: PAD + ((high - entry.overall) / (high - low)) * (HEIGHT - 2 * PAD),
    entry,
    score: entry.overall,
  }))
}

/**
 * The overall score at each recorded commit, oldest first: the direction the code takes, which
 * one number cannot show. The page records a point on every analysis, `--check` on every run.
 */
export const Trend = ({ history }: { history: HistoryEntry[] }) => {
  const t = useT()
  const words = t.learn.trend
  const points = pointsOf(history.slice(-MAX_POINTS))
  const last = points[points.length - 1]
  const previous = points[points.length - 2]
  if (!last || !previous)
    return (
      <p className="max-w-[220px] text-[12px] leading-relaxed text-muted sm:text-right">
        {words.noneYet}
      </p>
    )

  const band = bandOf(last.score)
  const line = points.map((point) => `${point.x},${point.y}`).join(' ')
  const area = `${line} ${last.x},${HEIGHT - PAD} ${points[0]?.x ?? PAD},${HEIGHT - PAD}`
  const diff = last.score - previous.score
  const scores = points.map((point) => point.score)
  const summary = words.label(points.length, Math.min(...scores), Math.max(...scores))

  return (
    <figure className="flex shrink-0 flex-col gap-1 sm:items-end">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width={WIDTH}
        height={HEIGHT}
        role="img"
        aria-label={summary}
        className="max-w-full"
      >
        <title>{summary}</title>
        <polygon points={area} className={cx(FILL[band], 'opacity-10')} />
        <polyline
          points={line}
          fill="none"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          className={STROKE[band]}
        />
        {points.map((point) => (
          <circle
            key={point.entry.at}
            cx={point.x}
            cy={point.y}
            r={point === last ? 3.5 : 2}
            className={cx(FILL[band], point === last ? '' : 'opacity-50')}
          >
            <title>{words.point(point.entry, point.score)}</title>
          </circle>
        ))}
      </svg>
      <figcaption className="flex flex-wrap gap-x-2 text-[12px] text-muted sm:justify-end">
        <span>{words.points(points.length)}</span>
        <span className={cx('font-medium', BAND_TEXT[band])}>
          {words.sincePrevious(diff, previous.entry.commit)}
        </span>
      </figcaption>
    </figure>
  )
}
