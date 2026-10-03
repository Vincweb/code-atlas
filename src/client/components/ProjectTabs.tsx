import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { TABS, projectPath } from '../../shared/routes'
import type { Tab } from '../../shared/routes'
import type { Analysis } from '../../shared/types'
import { cx } from '../cx'
import { useT } from '../i18n'
import { BAND_BOX, BAND_TEXT, bandOf } from '../util/score'
import { Link } from './Link'
import { ProgressBar } from './skeletons'

const Svg = ({ children }: { children: ReactNode }) => (
  <svg
    viewBox="0 0 24 24"
    className="size-4 shrink-0"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
)

const ICONS: Record<Tab, ReactNode> = {
  overview: (
    <Svg>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </Svg>
  ),
  graph: (
    <Svg>
      <circle cx="12" cy="5" r="2.2" />
      <circle cx="6" cy="18" r="2.2" />
      <circle cx="18" cy="18" r="2.2" />
      <path d="M11 7 7 16M13 7l4 9" />
    </Svg>
  ),
  rules: (
    <Svg>
      <path d="M10 6h10M10 12h10M10 18h10" />
      <path d="m3.5 6 1.2 1.2L7 5M3.5 12l1.2 1.2L7 11M3.5 18l1.2 1.2L7 17" />
    </Svg>
  ),
  audits: (
    <Svg>
      <path d="M12 3.5 13.8 9l5.7.2-4.5 3.5 1.6 5.5L12 15l-4.6 3.2L9 12.7 4.5 9.2l5.7-.2L12 3.5Z" />
    </Svg>
  ),
  metrics: (
    <Svg>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </Svg>
  ),
  config: (
    <Svg>
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="18" cy="18" r="2" />
    </Svg>
  ),
}

const Count = ({ value, tone }: { value: number; tone: 'bad' | 'neutral' }) => (
  <span
    className={cx(
      'rounded-full px-1.5 text-[11px] leading-4 font-semibold tabular-nums',
      tone === 'bad' ? 'bg-bad-bg text-bad' : 'bg-hover text-muted',
    )}
  >
    {value}
  </span>
)

const badgeOf = (tab: Tab, analysis: Analysis | undefined): ReactNode => {
  if (!analysis) return null
  if (tab === 'overview') {
    const band = bandOf(analysis.scores.overall)
    return analysis.scores.overall === null ? null : (
      <span
        className={cx(
          'rounded-full border px-1.5 text-[11px] leading-4 font-semibold tabular-nums',
          BAND_BOX[band],
          BAND_TEXT[band],
        )}
      >
        {analysis.scores.overall}
      </span>
    )
  }
  if (tab === 'graph') {
    const red = analysis.graph.edges.filter((e) => e.class === 'up' || e.class === 'mutual').length
    return red ? <Count value={red} tone="bad" /> : null
  }
  if (tab === 'rules') {
    const failing = analysis.rules.filter((r) => r.status === 'fail' || r.status === 'error').length
    return failing ? <Count value={failing} tone="bad" /> : null
  }
  if (tab === 'audits') {
    const audits = analysis.audits.items.length
    return audits ? <Count value={audits} tone="neutral" /> : null
  }
  if (tab === 'config' && analysis.configSource === 'default')
    return <span className="size-2 rounded-full bg-warn" aria-hidden="true" />
  return null
}

export const ProjectTabs = ({
  root,
  tab,
  analysis,
  busy,
}: {
  root: string
  tab: Tab
  analysis: Analysis | undefined
  busy: boolean
}) => {
  const t = useT()
  const nav = useRef<HTMLElement>(null)
  useEffect(() => {
    const active = nav.current?.querySelector<HTMLElement>('[aria-current="page"]')
    if (nav.current && active) nav.current.scrollLeft = active.offsetLeft - 16
  }, [tab])
  return (
    <div className="sticky top-0 z-20 -mx-4 bg-bg px-4 sm:-mx-5 sm:px-5">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-bg to-transparent sm:hidden"
      />
      <nav
        ref={nav}
        aria-label={t.tabs.label}
        className="flex gap-1 overflow-x-auto border-b border-line [scrollbar-width:none]"
      >
        {TABS.map((id) => {
          const active = id === tab
          return (
            <Link
              key={id}
              to={projectPath(root, id)}
              aria-current={active ? 'page' : undefined}
              className={cx(
                'group relative flex shrink-0 items-center gap-2 px-3 py-2.5 whitespace-nowrap',
                active ? 'font-medium text-text' : 'text-muted hover:text-text',
              )}
            >
              <span
                className={cx(
                  'flex items-center gap-2 rounded-md px-1.5 py-1',
                  !active && 'group-hover:bg-hover',
                )}
              >
                <span className={active ? 'text-accent' : ''}>{ICONS[id]}</span>
                {t.tabs[id]}
                {badgeOf(id, analysis)}
              </span>
              {active && (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent" />
              )}
            </Link>
          )
        })}
      </nav>
      {analysis && busy && (
        <span className="absolute inset-x-0 -bottom-px">
          <ProgressBar />
        </span>
      )}
    </div>
  )
}
