import type { MigrationRow } from 'drizzle-graph'
import { cx } from '../../util/cx'
import { featureColor } from './erd'

/** Geometry shared by the lanes and the rows they line up with. */
export const ROW_HEIGHT = 38
const LANE_WIDTH = 16
const PADDING = 14

const laneX = (lane: number) => PADDING + lane * LANE_WIDTH

const lanesWidth = (laneCount: number) => PADDING * 2 + (laneCount - 1) * LANE_WIDTH

type Span = { fromY: number; toY: number; midY: number }

/** A lane crossing into another one, bent halfway through the row. */
const curve = (fromLane: number, toLane: number, { fromY, toY, midY }: Span) =>
  `M${laneX(fromLane)},${fromY}C${laneX(toLane)},${midY} ${laneX(toLane)},${midY} ${laneX(toLane)},${toY}`

type Props = {
  rows: MigrationRow[]
  laneCount: number
  selected: string | null
  onSelect: (folder: string) => void
}

/** The git-log-style lanes drizzle-graph rebuilds from each snapshot's prevIds, one row each. */
export const MigrationLanes = ({ rows, laneCount, selected, onSelect }: Props) => {
  const width = lanesWidth(laneCount)
  const height = rows.length * ROW_HEIGHT

  const edges = rows.flatMap((row, index) => {
    const top = index * ROW_HEIGHT
    const mid = top + ROW_HEIGHT / 2
    const bottom = top + ROW_HEIGHT
    return [
      ...row.passThrough.map((lane) => ({
        key: `${row.folder}-through-${lane}`,
        lane,
        d: `M${laneX(lane)},${top}V${bottom}`,
      })),
      ...row.incoming.map((lane) => ({
        key: `${row.folder}-in-${lane}`,
        lane,
        d:
          lane === row.lane
            ? `M${laneX(lane)},${top}V${mid}`
            : curve(lane, row.lane, { fromY: top, toY: mid, midY: mid }),
      })),
      ...row.outgoing.map((lane) => ({
        key: `${row.folder}-out-${lane}`,
        lane,
        d:
          lane === row.lane
            ? `M${laneX(lane)},${mid}V${bottom}`
            : curve(row.lane, lane, { fromY: mid, toY: bottom, midY: mid }),
      })),
    ]
  })

  return (
    <svg
      className="block shrink-0"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      {edges.map((edge) => (
        <path
          key={edge.key}
          d={edge.d}
          fill="none"
          strokeWidth={1.9}
          stroke={featureColor(edge.lane)}
        />
      ))}
      {rows.map((row, index) => (
        <circle
          key={row.folder}
          className={cx(
            'cursor-pointer stroke-bg',
            (row.isHead || row.folder === selected) && 'stroke-text',
          )}
          cx={laneX(row.lane)}
          cy={index * ROW_HEIGHT + ROW_HEIGHT / 2}
          r={row.isMerge ? 6 : 4.5}
          strokeWidth={2.5}
          fill={row.phantom ? 'var(--color-muted)' : featureColor(row.lane)}
          onClick={() => onSelect(row.folder)}
        />
      ))}
    </svg>
  )
}
