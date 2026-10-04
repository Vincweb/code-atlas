import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { AtlasConfig, LayerConfig } from '../../shared/config'
import type { EngineResult } from '../../shared/types'
import { condensedDepths } from '../../shared/graph'
import { featureOf } from '../engine/glob'
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
  const depths = condensedDepths(nodes, edges)
  const byDepth = new Map<number, string[]>()
  for (const node of nodes) {
    const level = depths.get(node) ?? 0
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
