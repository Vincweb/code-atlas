import type { FeatureEdge, FeatureNode, Graph } from '../../../shared/types'

export const NODE_W = 140
export const NODE_H = 32
const MIN_GAP = 18
const MAX_GAP = 90
const LINE_PITCH = 80
const BAND_LABEL = 26
const BAND_PAD = 14
const BAND_GAP = 44
const PAD_X = 16
const PAD_TOP = 8
const SWEEPS = 4

export type Column =
  { kind: 'layer'; name: string } | { kind: 'unlayered' } | { kind: 'depth'; depth: number }

export type Placed = { id: string; label: string; band: number; x: number; y: number }

export type Band = { column: Column; y: number; height: number }

export type Layout = {
  bands: Band[]
  placed: Map<string, Placed>
  width: number
  height: number
  byDepth: boolean
}

export const depthsOf = (features: FeatureNode[], edges: FeatureEdge[]) => {
  const out = new Map<string, string[]>()
  for (const feature of features) out.set(feature.id, [])
  for (const edge of edges) if (edge.from !== edge.to) out.get(edge.from)?.push(edge.to)

  let counter = 0
  const index = new Map<string, number>()
  const low = new Map<string, number>()
  const stack: string[] = []
  const onStack = new Set<string>()
  const component = new Map<string, number>()
  let components = 0

  const visit = (id: string) => {
    index.set(id, counter)
    low.set(id, counter)
    counter++
    stack.push(id)
    onStack.add(id)
    for (const next of out.get(id) ?? []) {
      if (!index.has(next)) {
        visit(next)
        low.set(id, Math.min(low.get(id) ?? 0, low.get(next) ?? 0))
      } else if (onStack.has(next)) {
        low.set(id, Math.min(low.get(id) ?? 0, index.get(next) ?? 0))
      }
    }
    if (low.get(id) === index.get(id)) {
      for (let member = stack.pop(); member !== undefined; member = stack.pop()) {
        onStack.delete(member)
        component.set(member, components)
        if (member === id) break
      }
      components++
    }
  }
  for (const feature of features) if (!index.has(feature.id)) visit(feature.id)

  const next = Array.from({ length: components }, () => new Set<number>())
  const incoming = new Array<number>(components).fill(0)
  for (const [from, targets] of out) {
    const a = component.get(from) ?? 0
    for (const target of targets) {
      const b = component.get(target) ?? 0
      if (a !== b && !next[a]?.has(b)) {
        next[a]?.add(b)
        incoming[b] = (incoming[b] ?? 0) + 1
      }
    }
  }

  const depth = new Array<number>(components).fill(0)
  const ready = incoming.flatMap((count, id) => (count === 0 ? [id] : []))
  for (let id = ready.pop(); id !== undefined; id = ready.pop()) {
    for (const target of next[id] ?? []) {
      depth[target] = Math.max(depth[target] ?? 0, (depth[id] ?? 0) + 1)
      incoming[target] = (incoming[target] ?? 0) - 1
      if (incoming[target] === 0) ready.push(target)
    }
  }
  return new Map(features.map((f) => [f.id, depth[component.get(f.id) ?? 0] ?? 0]))
}

const sharedParent = (ids: string[]) => {
  const parents = ids.map((id) => id.split('/').slice(0, -1))
  const first = parents[0] ?? []
  let length = 0
  while (length < first.length && parents.every((parent) => parent[length] === first[length]))
    length++
  return first.slice(0, length).join('/')
}

const labelIn = (id: string, parent: string) =>
  parent && id.startsWith(`${parent}/`) ? id.slice(parent.length + 1) : id

const reduceCrossings = (groups: string[][], edges: FeatureEdge[]) => {
  const neighbours = new Map<string, string[]>()
  const link = (a: string, b: string) => neighbours.set(a, [...(neighbours.get(a) ?? []), b])
  for (const edge of edges) {
    link(edge.from, edge.to)
    link(edge.to, edge.from)
  }
  const columnOf = new Map<string, number>()
  groups.forEach((group, col) => group.forEach((id) => columnOf.set(id, col)))
  const rank = new Map<string, number>()
  const rerank = () =>
    groups.forEach((group) =>
      group.forEach((id, row) => rank.set(id, (row + 0.5) / Math.max(1, group.length))),
    )
  rerank()

  const sweep = (col: number, before: boolean) => {
    const group = groups[col]
    if (!group || group.length < 2) return
    const centre = (id: string) => {
      const ranks = (neighbours.get(id) ?? [])
        .filter((other) => {
          const otherCol = columnOf.get(other) ?? col
          return before ? otherCol < col : otherCol > col
        })
        .map((other) => rank.get(other) ?? 0.5)
      return ranks.length ? ranks.reduce((sum, value) => sum + value, 0) / ranks.length : null
    }
    const keyed = group.map((id) => ({ id, key: centre(id) ?? rank.get(id) ?? 0.5 }))
    keyed.sort((a, b) => a.key - b.key)
    groups[col] = keyed.map((entry) => entry.id)
    rerank()
  }

  for (let pass = 0; pass < SWEEPS; pass++) {
    if (pass % 2 === 0) for (let col = 1; col < groups.length; col++) sweep(col, true)
    else for (let col = groups.length - 2; col >= 0; col--) sweep(col, false)
  }
  return groups
}

export const layoutGraph = (graph: Graph, available: number): Layout => {
  const byDepth = graph.layers.length === 0
  let columns: Column[]
  let columnOf: (feature: FeatureNode) => number

  if (byDepth) {
    const depths = depthsOf(graph.features, graph.edges)
    const max = Math.max(0, ...depths.values())
    columns = Array.from({ length: max + 1 }, (_, depth) => ({ kind: 'depth', depth }))
    columnOf = (feature) => depths.get(feature.id) ?? 0
  } else {
    columns = graph.layers.map((layer) => ({ kind: 'layer', name: layer.name }))
    if (graph.features.some((f) => f.layer === null)) columns.push({ kind: 'unlayered' })
    const last = columns.length - 1
    columnOf = (feature) => feature.layer ?? last
  }

  const initial: string[][] = columns.map(() => [])
  for (const feature of [...graph.features].sort((a, b) => a.id.localeCompare(b.id)))
    initial[columnOf(feature)]?.push(feature.id)
  const groups = reduceCrossings(initial, graph.edges)

  const inner = Math.max(NODE_W, available - PAD_X * 2)
  const perLine = Math.max(1, Math.floor((inner + MIN_GAP) / (NODE_W + MIN_GAP)))
  const width = Math.max(available, PAD_X * 2 + NODE_W)

  const placed = new Map<string, Placed>()
  const bands: Band[] = []
  let y = PAD_TOP
  groups.forEach((group, band) => {
    const lines = Math.max(1, Math.ceil(group.length / perLine))
    const height = BAND_LABEL + lines * LINE_PITCH - (LINE_PITCH - NODE_H) + BAND_PAD
    const parent = sharedParent(group)
    for (let line = 0; line < lines; line++) {
      const row = group.slice(line * perLine, (line + 1) * perLine)
      const gap =
        row.length > 1
          ? Math.min(MAX_GAP, Math.max(MIN_GAP, (inner - row.length * NODE_W) / (row.length - 1)))
          : 0
      const rowWidth = row.length * NODE_W + (row.length - 1) * gap
      const left = (width - rowWidth) / 2
      row.forEach((id, index) => {
        placed.set(id, {
          id,
          label: labelIn(id, parent),
          band,
          x: left + index * (NODE_W + gap),
          y: y + BAND_LABEL + line * LINE_PITCH,
        })
      })
    }
    bands.push({ column: columns[band] ?? { kind: 'unlayered' }, y, height })
    y += height + BAND_GAP
  })

  return { bands, placed, width, height: y - BAND_GAP + PAD_TOP, byDepth }
}

type Point = readonly [number, number]

const SHIFT = 8

export const edgeGeometry = (from: Placed, to: Placed) => {
  const fx = from.x + NODE_W / 2
  const tx = to.x + NODE_W / 2
  let p0: Point
  let p1: Point
  let p2: Point
  let p3: Point
  if (to.y > from.y) {
    const sy = from.y + NODE_H
    const dy = Math.max(26, (to.y - sy) / 2)
    p0 = [fx - SHIFT, sy]
    p1 = [fx - SHIFT, sy + dy]
    p2 = [tx - SHIFT, to.y - dy]
    p3 = [tx - SHIFT, to.y]
  } else if (to.y < from.y) {
    const ty = to.y + NODE_H
    const dy = Math.max(26, (from.y - ty) / 2)
    p0 = [fx + SHIFT, from.y]
    p1 = [fx + SHIFT, from.y - dy]
    p2 = [tx + SHIFT, ty + dy]
    p3 = [tx + SHIFT, ty]
  } else {
    const rightward = tx > fx
    const bulge = Math.min(22, 12 + Math.abs(tx - fx) * 0.02)
    const edgeY = rightward ? from.y + NODE_H : from.y
    const dir = rightward ? 1 : -1
    p0 = [fx, edgeY]
    p1 = [fx, edgeY + dir * bulge]
    p2 = [tx, edgeY + dir * bulge]
    p3 = [tx, edgeY]
  }
  return {
    d: `M ${p0[0]} ${p0[1]} C ${p1[0]} ${p1[1]} ${p2[0]} ${p2[1]} ${p3[0]} ${p3[1]}`,
    mid: [
      (p0[0] + 3 * p1[0] + 3 * p2[0] + p3[0]) / 8,
      (p0[1] + 3 * p1[1] + 3 * p2[1] + p3[1]) / 8,
    ] as const,
  }
}
