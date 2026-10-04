import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { projectPath } from '../../../shared/routes'
import type { Analysis } from '../../../shared/types'
import { cx } from '../../util/cx'
import { useT } from '../../i18n'
import { navigate } from '../../state/router'
import { Button } from '../ui'
import { ChevronIcon, SearchIcon } from '../welcome/icons'
import { GraphHelp, Legend } from './GraphHelp'
import { GraphSvg } from './GraphSvg'
import { NodePanel } from './NodePanel'
import { OverviewPanel } from './OverviewPanel'
import { drawOrder, isProblem, isRed } from './edges'
import { layoutGraph } from './layout'

type Mode = 'all' | 'problems'

const DEFAULT_MIN_WEIGHT = 5
const CROWDED_EDGES = 40
const MIN_SCALE = 0.7

const useWidth = () => {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    setWidth(element.clientWidth)
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.round(entry.contentRect.width))
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}

const PANEL_KEY = 'code-atlas.graph-panel'

const usePanelOpen = () => {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(PANEL_KEY) !== 'closed'
    } catch {
      return true
    }
  })
  const update = (next: boolean) => {
    setOpen(next)
    try {
      localStorage.setItem(PANEL_KEY, next ? 'open' : 'closed')
    } catch {
      return
    }
  }
  return [open, update] as const
}

export const GraphTab = ({ analysis, root }: { analysis: Analysis; root: string }) => {
  const t = useT()
  const { graph } = analysis
  const [focus, setFocus] = useState<string | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>('all')
  const [query, setQuery] = useState('')
  const [help, setHelp] = useState(false)
  const [panelOpen, setPanelOpen] = usePanelOpen()
  const [frame, width] = useWidth()

  const layout = useMemo(() => layoutGraph(graph, width), [graph, width])
  const scale = width ? Math.min(1, Math.max(MIN_SCALE, width / layout.width)) : 1
  const maxWeight = useMemo(
    () => Math.max(1, ...graph.edges.filter((e) => !isProblem(e.class)).map((e) => e.weight)),
    [graph],
  )
  const [minWeight, setMinWeight] = useState(() =>
    graph.edges.length > CROWDED_EDGES ? Math.min(DEFAULT_MIN_WEIGHT, maxWeight) : 1,
  )

  const edges = useMemo(
    () =>
      graph.edges
        .filter((edge) =>
          isProblem(edge.class) ? true : mode === 'all' && edge.weight >= minWeight,
        )
        .sort((a, b) => drawOrder(a.class, b.class)),
    [graph, mode, minWeight],
  )

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return null
    return new Set(
      graph.features.filter((f) => f.id.toLowerCase().includes(needle)).map((f) => f.id),
    )
  }, [graph, query])

  const focusOn = (id: string | null) => {
    setFocus(id)
    if (id !== null) setPanelOpen(true)
  }

  const onSearchKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && matches?.size) focusOn([...matches][0] ?? null)
    if (event.key === 'Escape') setQuery('')
  }

  const redCount = graph.edges.filter((edge) => isRed(edge.class)).length
  const selected = graph.features.find((feature) => feature.id === focus)
  const layerName =
    selected && selected.layer !== null ? (graph.layers[selected.layer]?.name ?? null) : null

  return (
    <div className="flex flex-col gap-3">
      {layout.byDepth && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-panel px-4 py-2.5">
          <span className="flex-1 text-muted">{t.graph.noLayersBanner}</span>
          <Button onClick={() => navigate(projectPath(root, 'config'))}>
            {t.graph.openConfig}
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-line bg-panel p-0.5">
          {(['all', 'problems'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              aria-pressed={mode === value}
              className={cx(
                'rounded-md px-2.5 py-1',
                mode === value
                  ? 'bg-accent text-white'
                  : 'text-muted hover:bg-hover hover:text-text',
              )}
            >
              {t.graph.modes[value]}
            </button>
          ))}
        </div>
        {mode === 'all' && maxWeight > 1 && (
          <label className="flex items-center gap-2 text-muted" title={t.graph.minWeightHelp}>
            {t.graph.minWeight(minWeight)}
            <input
              type="range"
              min={1}
              max={maxWeight}
              value={minWeight}
              onChange={(event) => setMinWeight(Number(event.target.value))}
            />
          </label>
        )}
        <label className="flex min-w-48 flex-1 items-center gap-2 rounded-lg border border-line bg-panel px-2.5 py-1 sm:max-w-64">
          <SearchIcon className="size-4 text-muted" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onSearchKey}
            placeholder={t.graph.search}
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent outline-none"
          />
          {matches && <span className="text-[11px] text-muted">{matches.size}</span>}
        </label>
        <span className="ml-auto flex gap-2">
          <Button onClick={() => setHelp((open) => !open)} aria-expanded={help}>
            {help ? t.graph.hideHelp : t.graph.showHelp}
          </Button>
        </span>
      </div>

      {help && <GraphHelp byDepth={layout.byDepth} />}
      <Legend />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
        <div
          ref={frame}
          className="min-w-0 flex-1 overflow-x-auto rounded-xl border border-line bg-panel"
        >
          {graph.features.length === 0 ? (
            <p className="p-4 text-muted">{t.graph.empty}</p>
          ) : (
            <GraphSvg
              graph={graph}
              layout={layout}
              edges={edges}
              focus={focus}
              hover={hover}
              matches={matches}
              scale={scale}
              onFocus={focusOn}
              onHover={setHover}
            />
          )}
        </div>
        {panelOpen ? (
          <aside className="flex flex-col gap-3 rounded-xl border border-line bg-panel p-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:w-96 lg:shrink-0 lg:overflow-y-auto">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold tracking-wide text-muted uppercase">
                {t.graph.panel}
              </span>
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                title={t.graph.collapsePanel}
                aria-label={t.graph.collapsePanel}
                className="flex size-7 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-text"
              >
                <ChevronIcon className="size-4" />
              </button>
            </div>
            {selected ? (
              <NodePanel
                feature={selected}
                edges={graph.edges}
                layerName={layerName}
                onFocus={focusOn}
                onClose={() => setFocus(null)}
              />
            ) : (
              <OverviewPanel graph={graph} onFocus={focusOn} />
            )}
          </aside>
        ) : (
          <button
            type="button"
            onClick={() => setPanelOpen(true)}
            title={t.graph.expandPanel}
            aria-label={t.graph.expandPanel}
            className="flex items-center justify-center gap-2 rounded-xl border border-line bg-panel px-3 py-2 text-muted hover:bg-hover hover:text-text lg:sticky lg:top-4 lg:w-11 lg:flex-col lg:py-4"
          >
            <ChevronIcon className="size-4 rotate-180" />
            <span className="text-[12px] lg:[writing-mode:vertical-rl]">{t.graph.panel}</span>
            {redCount > 0 && (
              <span className="rounded-full bg-edge-red px-1.5 text-[11px] font-semibold text-white">
                {redCount}
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
