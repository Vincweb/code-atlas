import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { AtlasConfig, LayerConfig, ResolvedConfig } from '../../shared/config'
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

/** Layers by dependency depth: level 1 holds what nothing depends on. */
const layersByDepth = (
  nodes: string[],
  edges: Map<string, Set<string>>,
  members: (node: string) => string[],
  siblings: boolean,
): LayerConfig[] => {
  const depths = condensedDepths(nodes, edges)
  const byDepth = new Map<number, string[]>()
  for (const node of nodes) {
    const level = depths.get(node) ?? 0
    byDepth.set(level, [...(byDepth.get(level) ?? []), node])
  }
  return [...byDepth.keys()]
    .sort((a, b) => a - b)
    .map((level, position) => {
      const group = (byDepth.get(level) ?? []).sort()
      return {
        name: `Layer ${position + 1}`,
        features: group.flatMap(members),
        ...(siblings && group.length >= 3 ? { siblings: true } : {}),
      }
    })
}

const edgesBetween = (engine: EngineResult, groupOf: (file: string) => string | null) => {
  const edges = new Map<string, Set<string>>()
  for (const edge of engine.imports) {
    if (edge.kind === 'type') continue
    const from = groupOf(edge.from)
    const to = groupOf(edge.to)
    if (from !== null && to !== null && from !== to)
      edges.set(from, (edges.get(from) ?? new Set()).add(to))
  }
  return edges
}

/**
 * A monorepo's draft keeps the features of each package and stacks the packages themselves by
 * dependency depth, so the first thing it reports is a package importing one above it. Layers
 * inside each package are left to the user, who knows which ones are worth drawing.
 */
const workspaceDraft = (root: string, engine: EngineResult, config: ResolvedConfig) => {
  const packageOfFile = new Map(engine.files.map((file) => [file.path, file.package]))
  const dirs = engine.packages.map((pkg) => pkg.dir).filter((dir) => dir !== '.')
  const edges = edgesBetween(engine, (file) => {
    const dir = packageOfFile.get(file) ?? null
    return dir === '.' ? null : dir
  })
  const layers = layersByDepth(dirs, edges, (dir) => [`${dir}/**`], false)
  return { features: config.features, layers, allow: [], rules: defaultRules(root, layers) }
}

export const draftConfig = (
  root: string,
  engine: EngineResult,
  config?: ResolvedConfig,
): AtlasConfig => {
  if (config && engine.packages.length) return workspaceDraft(root, engine, config)
  const features = featurePatterns(root, engine)
  const nodes = [...new Set(engine.files.map((file) => featureOf(file.path, features)))].sort()
  const edges = edgesBetween(engine, (file) => featureOf(file, features))
  const layers = layersByDepth(nodes, edges, (node) => [node], true)
  return {
    features,
    layers,
    allow: [],
    rules: defaultRules(root, layers),
  }
}

export const draftText = (config: AtlasConfig) =>
  `${JSON.stringify({ $schema: SCHEMA_URL, ...config }, null, 2)}\n`
