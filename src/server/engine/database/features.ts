import type { ResolvedDatabaseConfig } from '../../../shared/config'
import type { DbTable, FeatureEdge, FeatureNode, Graph } from '../../../shared/types'
import { matchAny } from '../glob'
import { classify, layerIndex, neighbours } from '../graph'

const round = (value: number) => Math.round(value * 100) / 100

/** `customer_calls` → `customer`, `chatArtifacts` → `chat`: the first word of the name. */
export const prefixOf = (name: string) =>
  name
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .split(/[_-]+/)
    .filter(Boolean)[0] ?? name

/**
 * The feature each table belongs to. Config patterns first, over the table's name and its
 * schema-qualified id; the rest is grouped by the first word of the name, `customers` and
 * `customer_calls` landing together.
 */
export const assignFeatures = (tables: DbTable[], config: ResolvedDatabaseConfig) => {
  const prefixes = new Map(tables.map((table) => [table.id, prefixOf(table.name)]))
  const known = new Set(prefixes.values())
  const singular = (prefix: string) =>
    prefix.endsWith('s') && known.has(prefix.slice(0, -1)) ? prefix.slice(0, -1) : prefix
  const features = new Map<string, string>()
  for (const table of tables) {
    const configured = (config.features ?? []).find(
      (feature) => matchAny(table.name, feature.tables) || matchAny(table.id, feature.tables),
    )
    features.set(table.id, configured?.name ?? singular(prefixes.get(table.id) ?? table.name))
  }
  return features
}

/**
 * A junction table links two tables of other features: at least two foreign keys to distinct
 * tables, and a composite primary key or unique constraint covering two of them — or a name the
 * config lists.
 */
export const isJunction = (table: DbTable, junctions: string[]) => {
  if (matchAny(table.name, junctions) || matchAny(table.id, junctions)) return true
  const keys = table.foreignKeys.filter((key) => key.resolved && key.table !== table.id)
  if (new Set(keys.map((key) => key.table)).size < 2) return false
  return [table.primaryKey, ...table.uniques]
    .filter((set) => set.length >= 2)
    .some((set) => {
      const covered = keys.filter((key) => key.columns.every((column) => set.includes(column)))
      return new Set(covered.map((key) => key.table)).size >= 2
    })
}

const featureNodes = (tables: DbTable[], config: ResolvedDatabaseConfig) => {
  const nodes = new Map<string, FeatureNode>()
  for (const table of tables) {
    const node = nodes.get(table.feature) ?? {
      id: table.feature,
      layer: layerIndex(table.feature, config.layers),
      files: 0,
      lines: 0,
      ca: 0,
      ce: 0,
      instability: 0,
    }
    nodes.set(table.feature, node)
    node.files++
    node.lines += table.columns.length
  }
  return nodes
}

/** One edge per pair of features a foreign key crosses; `direct` when a non-junction table holds one. */
const featureEdges = (tables: DbTable[]) => {
  const byId = new Map(tables.map((table) => [table.id, table]))
  const edges = new Map<string, FeatureEdge & { direct: boolean }>()
  for (const table of tables) {
    if (table.kind !== 'table') continue
    for (const key of table.foreignKeys) {
      const target = byId.get(key.table)
      if (!target || target.feature === table.feature) continue
      const id = `${table.feature}\0${target.feature}`
      const edge = edges.get(id) ?? {
        from: table.feature,
        to: target.feature,
        weight: 0,
        class: 'lateral',
        imports: [],
        direct: false,
      }
      edges.set(id, edge)
      edge.weight++
      edge.direct ||= !table.junction
      edge.imports.push({
        file: table.file,
        line: key.line,
        target: `${table.name}.${key.columns.join(', ')} → ${target.name}.${key.targetColumns.join(', ')}`,
      })
    }
  }
  return [...edges.values()]
}

/** The feature graph of the database, classified like the import graph; junction edges never go red. */
export const buildDatabaseGraph = (tables: DbTable[], config: ResolvedDatabaseConfig): Graph => {
  const nodes = featureNodes(tables, config)
  const edges = featureEdges(tables)
  const direct = edges.filter((edge) => edge.direct)
  const outgoing = neighbours(direct, 'from')
  const all = { from: neighbours(edges, 'from'), to: neighbours(edges, 'to') }
  for (const node of nodes.values()) {
    node.ca = all.to.get(node.id)?.size ?? 0
    node.ce = all.from.get(node.id)?.size ?? 0
    node.instability = node.ca + node.ce === 0 ? 0 : round(node.ce / (node.ca + node.ce))
  }
  const classified: FeatureEdge[] = edges.map(({ direct: isDirect, ...edge }) => ({
    ...edge,
    class: isDirect ? classify(edge, config, nodes, outgoing) : 'junction',
    imports: [...edge.imports].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line),
  }))
  classified.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to))
  return {
    layers: config.layers.map((layer) => ({ name: layer.name, siblings: !!layer.siblings })),
    features: [...nodes.values()].sort((a, b) => a.id.localeCompare(b.id)),
    edges: classified,
    cycles: [],
  }
}
