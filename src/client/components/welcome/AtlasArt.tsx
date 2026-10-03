import { useT } from '../../i18n'

const NODE_W = 100
const NODE_H = 26

const NODES = [
  { id: 'routes', x: 24, y: 70 },
  { id: 'pages', x: 24, y: 130 },
  { id: 'catalog', x: 170, y: 40 },
  { id: 'cart', x: 170, y: 100 },
  { id: 'checkout', x: 170, y: 160 },
  { id: 'state', x: 170, y: 220 },
  { id: 'lib', x: 316, y: 70 },
  { id: 'api', x: 316, y: 130 },
  { id: 'i18n', x: 316, y: 190 },
]

const GREY = [
  'M124 83 C147 83 147 53 170 53',
  'M124 83 C147 83 147 113 170 113',
  'M124 143 C147 143 147 53 170 53',
  'M124 143 C147 143 147 173 170 173',
  'M270 53 C293 53 293 83 316 83',
  'M270 53 C293 53 293 143 316 143',
  'M270 113 C293 113 293 83 316 83',
  'M270 173 C293 173 293 203 316 203',
  'M270 233 C293 233 293 143 316 143',
]

const FILL = { grey: 'fill-edge-grey', amber: 'fill-edge-amber', red: 'fill-edge-red' }

const AMBER = 'M170 233 C146 233 146 173 170 173'
const RED = 'M316 83 C286 83 300 233 270 233'

export const AtlasArt = () => {
  const t = useT()
  return (
    <svg viewBox="0 0 440 270" className="h-auto w-full" role="img" aria-label={t.landing.art}>
      <defs>
        {(['grey', 'amber', 'red'] as const).map((tone) => (
          <marker
            key={tone}
            id={`art-${tone}`}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            markerUnits="userSpaceOnUse"
            orient="auto"
          >
            <path d="M0 0 L10 5 L0 10 z" className={FILL[tone]} />
          </marker>
        ))}
      </defs>
      {GREY.map((d) => (
        <path
          key={d}
          d={d}
          fill="none"
          strokeWidth={1.4}
          markerEnd="url(#art-grey)"
          className="stroke-edge-grey opacity-70"
        />
      ))}
      <path
        d={AMBER}
        fill="none"
        strokeWidth={1.8}
        markerEnd="url(#art-amber)"
        className="stroke-edge-amber"
      />
      <path
        d={RED}
        fill="none"
        strokeWidth={2.2}
        strokeDasharray="6 5"
        markerEnd="url(#art-red)"
        className="atlas-flow stroke-edge-red"
      />
      {NODES.map((node) => {
        const flagged = node.id === 'state' || node.id === 'lib'
        return (
          <g key={node.id} transform={`translate(${node.x} ${node.y})`}>
            <rect
              width={NODE_W}
              height={NODE_H}
              rx={7}
              strokeWidth={flagged ? 1.5 : 1}
              className={flagged ? 'fill-panel stroke-edge-red' : 'fill-panel stroke-line'}
            />
            <text
              x={NODE_W / 2}
              y={NODE_H / 2 + 4}
              textAnchor="middle"
              className="fill-text font-mono text-[11px]"
            >
              {node.id}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
