import type { FeatureEdge, Graph } from '../../../shared/types'
import { cx } from '../../cx'
import { useT } from '../../i18n'
import { DASHED, FILL, STROKE, TONE, isRed, strokeWidth } from './edges'
import type { Tone } from './edges'
import { NODE_H, NODE_W, edgeGeometry } from './layout'
import type { Layout } from './layout'

type Props = {
  graph: Graph
  layout: Layout
  edges: FeatureEdge[]
  focus: string | null
  hover: string | null
  matches: Set<string> | null
  scale: number
  onFocus: (id: string | null) => void
  onHover: (id: string | null) => void
}

const TONES: Tone[] = ['red', 'amber', 'grey', 'light']

const shorten = (label: string) => (label.length > 16 ? `…${label.slice(-15)}` : label)

export const GraphSvg = ({
  graph,
  layout,
  edges,
  focus,
  hover,
  matches,
  scale,
  onFocus,
  onHover,
}: Props) => {
  const t = useT()
  const active = hover ?? focus
  const neighbours = new Set<string>()
  if (active) {
    neighbours.add(active)
    for (const edge of graph.edges) {
      if (edge.from === active) neighbours.add(edge.to)
      if (edge.to === active) neighbours.add(edge.from)
    }
  }
  const flagged = new Set(
    graph.edges.filter((edge) => isRed(edge.class)).flatMap((edge) => [edge.from, edge.to]),
  )
  const filesOf = new Map(graph.features.map((feature) => [feature.id, feature.files]))

  const bandLabel = (index: number) => {
    const column = layout.bands[index]?.column
    if (!column) return ''
    if (column.kind === 'layer') return column.name
    if (column.kind === 'unlayered') return t.graph.unlayered
    return t.graph.depth(column.depth)
  }

  return (
    <svg
      width={layout.width * scale}
      height={layout.height * scale}
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      onClick={() => onFocus(null)}
      className="block select-none"
      role="img"
      aria-label={t.tabs.graph}
    >
      <defs>
        {TONES.map((tone) => (
          <marker
            key={tone}
            id={`arrow-${tone}`}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="8"
            markerHeight="8"
            markerUnits="userSpaceOnUse"
            orient="auto"
          >
            <path d="M0 0 L10 5 L0 10 z" className={FILL[tone]} />
          </marker>
        ))}
      </defs>

      {layout.bands.map((band, index) => (
        <g key={index}>
          <rect
            x={6}
            y={band.y}
            width={layout.width - 12}
            height={band.height}
            rx={12}
            className="fill-bg opacity-60"
          />
          <text
            x={18}
            y={band.y + 17}
            className="fill-muted text-[11px] font-semibold tracking-wide uppercase"
          >
            {bandLabel(index)}
          </text>
        </g>
      ))}

      {edges.map((edge) => {
        const from = layout.placed.get(edge.from)
        const to = layout.placed.get(edge.to)
        if (!from || !to) return null
        const tone = TONE[edge.class]
        const touched = active !== null && (edge.from === active || edge.to === active)
        const { d } = edgeGeometry(from, to)
        const opacity =
          active === null ? (tone === 'grey' || tone === 'light' ? 0.45 : 0.95) : touched ? 1 : 0.06
        return (
          <g key={`${edge.from}→${edge.to}`} opacity={opacity}>
            <title>{t.graph.edgeTitle(edge.from, edge.to, edge.weight)}</title>
            <path
              d={d}
              fill="none"
              strokeWidth={strokeWidth(edge.weight) + (touched ? 0.6 : 0)}
              strokeDasharray={DASHED[edge.class] ? '5 4' : undefined}
              markerEnd={`url(#arrow-${tone})`}
              className={STROKE[tone]}
            />
          </g>
        )
      })}

      {active !== null &&
        edges.map((edge) => {
          if (edge.from !== active && edge.to !== active) return null
          const from = layout.placed.get(edge.from)
          const to = layout.placed.get(edge.to)
          if (!from || !to) return null
          const [x, y] = edgeGeometry(from, to).mid
          const label = String(edge.weight)
          const width = 10 + label.length * 6.5
          return (
            <g key={`w-${edge.from}→${edge.to}`} pointerEvents="none">
              <rect
                x={x - width / 2}
                y={y - 8}
                width={width}
                height={16}
                rx={8}
                className={cx('fill-panel', STROKE[TONE[edge.class]])}
              />
              <text
                x={x}
                y={y + 4}
                textAnchor="middle"
                className="fill-text text-[10px] tabular-nums"
              >
                {label}
              </text>
            </g>
          )
        })}

      {graph.features.map((feature) => {
        const place = layout.placed.get(feature.id)
        if (!place) return null
        const dim =
          (active !== null && !neighbours.has(feature.id)) ||
          (active === null && matches !== null && !matches.has(feature.id))
        const isActive = feature.id === active
        const isFocus = feature.id === focus
        return (
          <g
            key={feature.id}
            transform={`translate(${place.x} ${place.y})`}
            onClick={(event) => {
              event.stopPropagation()
              onFocus(isFocus ? null : feature.id)
            }}
            onMouseEnter={() => onHover(feature.id)}
            onMouseLeave={() => onHover(null)}
            opacity={dim ? 0.25 : 1}
            className="cursor-pointer"
          >
            <title>{`${feature.id} · ${t.graph.files(filesOf.get(feature.id) ?? 0)}`}</title>
            <rect
              width={NODE_W}
              height={NODE_H}
              rx={9}
              className={cx(
                isFocus ? 'fill-accent/10 stroke-accent' : 'fill-panel',
                !isFocus && (isActive ? 'stroke-text' : 'stroke-line'),
              )}
              strokeWidth={isFocus || isActive ? 1.6 : 1}
            />
            <text x={10} y={NODE_H / 2 + 4} className="fill-text font-mono text-[11px]">
              {shorten(place.label)}
            </text>
            <text
              x={NODE_W - 9}
              y={NODE_H / 2 + 4}
              textAnchor="end"
              className="fill-muted text-[10px] tabular-nums"
            >
              {feature.files}
            </text>
            {flagged.has(feature.id) && (
              <circle
                cx={NODE_W - 3}
                cy={3}
                r={4.5}
                className="fill-edge-red stroke-panel"
                strokeWidth={2}
              />
            )}
          </g>
        )
      })}
    </svg>
  )
}
