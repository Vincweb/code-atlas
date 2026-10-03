import { matchAny, matchGlob } from '../glob'
import type { ResolvedConfig } from '../../shared/config'
import type {
  EdgeClass,
  FeatureEdge,
  FeatureNode,
  FileNode,
  Graph,
  ImportEdge,
} from '../../shared/types'
import { findCycles } from './cycles'

const round = (value: number) => Math.round(value * 100) / 100

export const buildGraph = (
  files: FileNode[],
  imports: ImportEdge[],
  config: ResolvedConfig,
): Graph => {
  const featureOfFile = new Map(files.map((file) => [file.path, file.feature]))
  const layerOf = (feature: string) => {
    const index = config.layers.findIndex((layer) => matchAny(feature, layer.features))
    return index === -1 ? null : index
  }

  const nodes = new Map<string, FeatureNode>()
  for (const file of files) {
    let node = nodes.get(file.feature)
    if (!node) {
      node = {
        id: file.feature,
        layer: layerOf(file.feature),
        files: 0,
        lines: 0,
        ca: 0,
        ce: 0,
        instability: 0,
      }
      nodes.set(file.feature, node)
    }
    node.files++
    node.lines += file.lines
  }

  const edgeMap = new Map<string, FeatureEdge>()
  const fileEdges = new Map<string, Set<string>>(files.map((file) => [file.path, new Set()]))
  for (const edge of imports) {
    if (edge.kind === 'type') continue
    if (edge.kind !== 'dynamic') fileEdges.get(edge.from)?.add(edge.to)
    const from = featureOfFile.get(edge.from)
    const to = featureOfFile.get(edge.to)
    if (from === undefined || to === undefined || from === to) continue
    const key = `${from}\0${to}`
    let featureEdge = edgeMap.get(key)
    if (!featureEdge) {
      featureEdge = { from, to, weight: 0, class: 'lateral', imports: [] }
      edgeMap.set(key, featureEdge)
    }
    featureEdge.weight++
    featureEdge.imports.push({ file: edge.from, line: edge.line, target: edge.to })
  }

  const outgoing = new Map<string, Set<string>>()
  const incoming = new Map<string, Set<string>>()
  for (const edge of edgeMap.values()) {
    if (!outgoing.has(edge.from)) outgoing.set(edge.from, new Set())
    if (!incoming.has(edge.to)) incoming.set(edge.to, new Set())
    outgoing.get(edge.from)?.add(edge.to)
    incoming.get(edge.to)?.add(edge.from)
  }
  for (const node of nodes.values()) {
    node.ca = incoming.get(node.id)?.size ?? 0
    node.ce = outgoing.get(node.id)?.size ?? 0
    node.instability = node.ca + node.ce === 0 ? 0 : round(node.ce / (node.ca + node.ce))
  }

  const classify = (edge: FeatureEdge): EdgeClass => {
    if (config.allow.some(([from, to]) => matchGlob(edge.from, from) && matchGlob(edge.to, to))) {
      return 'allowed'
    }
    const from = nodes.get(edge.from)?.layer ?? null
    const to = nodes.get(edge.to)?.layer ?? null
    const reverse = outgoing.get(edge.to)?.has(edge.from) ?? false
    if (from === null || to === null) {
      if (reverse) return 'mutual'
      return config.layers.length ? 'unlayered' : 'down'
    }
    if (to > from) return 'down'
    if (to < from) return 'up'
    if (reverse) return 'mutual'
    return config.layers[from]?.siblings ? 'sibling' : 'lateral'
  }

  const edges = [...edgeMap.values()]
  for (const edge of edges) {
    edge.class = classify(edge)
    edge.imports.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)
  }
  edges.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to))

  return {
    layers: config.layers.map((layer) => ({ name: layer.name, siblings: !!layer.siblings })),
    features: [...nodes.values()].sort((a, b) => a.id.localeCompare(b.id)),
    edges,
    cycles: findCycles(fileEdges),
  }
}
