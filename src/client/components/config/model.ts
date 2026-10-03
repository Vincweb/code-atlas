import type { Graph } from '../../../shared/types'
import type { StackLayer } from './parts'

const matches = (id: string, pattern: string) => {
  const clean = pattern.replace(/\/+$/, '')
  const segments = clean.split('/')
  if (!segments.includes('*')) return id === clean
  const parts = id.split('/')
  return (
    parts.length === segments.length &&
    segments.every((segment, index) => segment === '*' || segment === parts[index])
  )
}

export type PatternGroup = { pattern: string | null; ids: string[] }

export const groupByPattern = (patterns: string[], ids: string[]): PatternGroup[] => {
  const groups: PatternGroup[] = patterns.map((pattern) => ({ pattern, ids: [] }))
  const fallback: PatternGroup = { pattern: null, ids: [] }
  for (const id of [...ids].sort()) {
    const target =
      groups.find((candidate) => candidate.pattern && matches(id, candidate.pattern)) ?? fallback
    target.ids.push(id)
  }
  return fallback.ids.length ? [...groups, fallback] : groups
}

export const stackOf = (graph: Graph): { layers: StackLayer[]; unlayered: string[] } => ({
  layers: graph.layers.map((layer, index) => ({
    name: layer.name,
    siblings: layer.siblings,
    features: graph.features.filter((f) => f.layer === index).map((f) => f.id),
  })),
  unlayered: graph.layers.length
    ? graph.features.filter((f) => f.layer === null).map((f) => f.id)
    : [],
})
