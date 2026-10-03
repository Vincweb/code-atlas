import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { AtlasConfig, LayerConfig } from '../../shared/config'
import type { EngineResult } from '../../shared/types'
import { featureOf } from '../glob'
import { defaultRules } from './defaults'

const SCHEMA_URL = 'https://raw.githubusercontent.com/Vincweb/code-atlas/main/schema.json'

const featurePatterns = (root: string, engine: EngineResult) => {
  const hasSrc = existsSync(join(root, 'src')) && statSync(join(root, 'src')).isDirectory()
  const base = hasSrc ? 'src/' : ''
  const children = new Map<string, Set<string>>()
  for (const file of engine.files) {
    if (!file.path.startsWith(base)) continue
    const parts = file.path.slice(base.length).split('/')
    if (parts.length < 3) continue
    const [dir, sub] = parts as [string, string]
    children.set(dir, (children.get(dir) ?? new Set()).add(sub))
  }
  const nested = [...children.entries()]
    .filter(([, subs]) => subs.size >= 3)
    .map(([dir]) => `${base}${dir}/*`)
    .sort()
  return [...nested, `${base}*`]
}

const components = (nodes: string[], edges: Map<string, Set<string>>) => {
  let counter = 0
  const index = new Map<string, number>()
  const low = new Map<string, number>()
  const onStack = new Set<string>()
  const stack: string[] = []
  const result: string[][] = []
  const visit = (node: string) => {
    index.set(node, counter)
    low.set(node, counter++)
    stack.push(node)
    onStack.add(node)
    for (const next of edges.get(node) ?? []) {
      if (!index.has(next)) {
        visit(next)
        low.set(node, Math.min(low.get(node)!, low.get(next)!))
      } else if (onStack.has(next)) low.set(node, Math.min(low.get(node)!, index.get(next)!))
    }
    if (low.get(node) === index.get(node)) {
      const group: string[] = []
      let member: string | undefined
      do {
        member = stack.pop()!
        onStack.delete(member)
        group.push(member)
      } while (member !== node)
      result.push(group)
    }
  }
  for (const node of nodes) if (!index.has(node)) visit(node)
  return result
}

export const draftConfig = (root: string, engine: EngineResult): AtlasConfig => {
  const features = featurePatterns(root, engine)
  const nodes = [...new Set(engine.files.map((file) => featureOf(file.path, features)))].sort()
  const edges = new Map<string, Set<string>>()
  for (const edge of engine.imports) {
    if (edge.kind === 'type') continue
    const from = featureOf(edge.from, features)
    const to = featureOf(edge.to, features)
    if (from !== to) edges.set(from, (edges.get(from) ?? new Set()).add(to))
  }
  const groups = components(nodes, edges)
  const groupOf = new Map<string, number>()
  groups.forEach((group, id) => group.forEach((node) => groupOf.set(node, id)))
  const importers = new Map<number, Set<number>>()
  for (const [from, targets] of edges)
    for (const to of targets) {
      const a = groupOf.get(from)!
      const b = groupOf.get(to)!
      if (a !== b) importers.set(b, (importers.get(b) ?? new Set()).add(a))
    }
  const depths = new Map<number, number>()
  const depth = (id: number): number => {
    const known = depths.get(id)
    if (known !== undefined) return known
    let value = 0
    for (const parent of importers.get(id) ?? []) value = Math.max(value, depth(parent) + 1)
    depths.set(id, value)
    return value
  }
  const byDepth = new Map<number, string[]>()
  for (const node of nodes) {
    const level = depth(groupOf.get(node)!)
    byDepth.set(level, [...(byDepth.get(level) ?? []), node])
  }
  const layers: LayerConfig[] = [...byDepth.keys()]
    .sort((a, b) => a - b)
    .map((level, position) => {
      const members = (byDepth.get(level) ?? []).sort()
      return {
        name: `Layer ${position + 1}`,
        features: members,
        ...(members.length >= 3 ? { siblings: true } : {}),
      }
    })
  return {
    features,
    layers,
    allow: [],
    rules: defaultRules(root, layers),
  }
}

export const draftText = (config: AtlasConfig) =>
  `${JSON.stringify({ $schema: SCHEMA_URL, ...config }, null, 2)}\n`
