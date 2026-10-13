import { packageRules } from './packages'
import type { Analysis, Baseline, HistoryEntry, PackageInfo } from './types'

export const packageIn = (analysis: Analysis, pkg: string | null): PackageInfo | null =>
  (pkg && analysis.workspace?.packages.find((info) => info.dir === pkg)) || null

/** Whether the page shows a monorepo as a whole, one node per package. */
export const isWholeWorkspace = (analysis: Analysis, pkg: string | null) =>
  !!analysis.workspace && !packageIn(analysis, pkg)

/** The history as one package lived it: its own overall score at each recorded analysis. */
export const historyOf = (history: HistoryEntry[], dir: string): HistoryEntry[] =>
  history.map((entry) => ({ ...entry, overall: entry.packages?.[dir] ?? null, families: {} }))

const baselineOf = (baseline: Baseline | null, dir: string): Baseline | null => {
  if (!baseline) return null
  const own = baseline.packages?.[dir]
  return { ...baseline, ...(own ?? { scores: { overall: null, families: [] }, violations: {} }) }
}

/**
 * The analysis as the page shows it. A monorepo's whole view draws one node per package; a
 * package's view keeps its own files, features, rules and scores, as if analyzed alone, except
 * that its features still count the imports they make into other packages.
 */
export const scopeAnalysis = (analysis: Analysis, pkg: string | null): Analysis => {
  const { workspace } = analysis
  if (!workspace) return analysis
  const info = packageIn(analysis, pkg)
  if (!info) return { ...analysis, graph: workspace.graph }
  const files = analysis.files.filter((file) => file.package === info.dir)
  const own = new Set(files.map((file) => file.path))
  const features = new Set(files.map((file) => file.feature))
  const { graph } = analysis
  return {
    ...analysis,
    files,
    functions: analysis.functions.filter((fn) => own.has(fn.file)),
    graph: {
      layers: graph.layers,
      features: graph.features.filter((feature) => features.has(feature.id)),
      edges: graph.edges.filter((edge) => features.has(edge.from) && features.has(edge.to)),
      cycles: graph.cycles.filter((cycle) => cycle.every((file) => own.has(file))),
    },
    rules: packageRules(analysis.rules, info.dir),
    scores: info.scores,
    stats: info.stats,
    distribution: info.distribution,
    baseline: baselineOf(analysis.baseline, info.dir),
    history: historyOf(analysis.history, info.dir),
  }
}
