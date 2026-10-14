import type { DatabaseResult, DbTable } from '../../../shared/types'

export const CARD_W = 224
export const HEADER_H = 30
export const ROW_H = 20
const CARD_PAD = 6
const GAP_X = 56
const GAP_Y = 28
const PAD = 16
const LOOP = 40

/** One hue per feature, in the order the features come; the same palette drizzle-graph uses. */
const PALETTE = [
  '#3b82f6',
  '#f97316',
  '#10b981',
  '#a855f7',
  '#ef4444',
  '#0ea5e9',
  '#eab308',
  '#ec4899',
]

export const featureColor = (index: number) => PALETTE[index % PALETTE.length] ?? PALETTE[0]

export type Placed = { table: DbTable; x: number; y: number; height: number; own: boolean }

export type ErdEdge = {
  key: string
  source: string
  target: string
  resolved: boolean
  d: string
}

export type ErdLayout = {
  placed: Map<string, Placed>
  edges: ErdEdge[]
  width: number
  height: number
}

export const cardHeight = (table: DbTable) => HEADER_H + table.columns.length * ROW_H + CARD_PAD

/** Tables ordered so that linked ones come close: a breadth-first walk from the most linked one. */
const linkedOrder = (tables: DbTable[]) => {
  const ids = new Set(tables.map((table) => table.id))
  const links = new Map<string, Set<string>>(tables.map((table) => [table.id, new Set()]))
  for (const table of tables)
    for (const key of table.foreignKeys)
      if (ids.has(key.table) && key.table !== table.id) {
        links.get(table.id)?.add(key.table)
        links.get(key.table)?.add(table.id)
      }
  const byDegree = [...tables].sort(
    (a, b) =>
      (links.get(b.id)?.size ?? 0) - (links.get(a.id)?.size ?? 0) || a.id.localeCompare(b.id),
  )
  const seen = new Set<string>()
  const order: DbTable[] = []
  const byId = new Map(tables.map((table) => [table.id, table]))
  for (const start of byDegree) {
    if (seen.has(start.id)) continue
    const queue = [start.id]
    seen.add(start.id)
    for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
      const table = byId.get(id)
      if (table) order.push(table)
      for (const next of [...(links.get(id) ?? [])].sort())
        if (!seen.has(next)) {
          seen.add(next)
          queue.push(next)
        }
    }
  }
  return order
}

const rowY = (placed: Placed, column: string) => {
  const index = placed.table.columns.findIndex((candidate) => candidate.name === column)
  return index === -1 ? placed.y + HEADER_H / 2 : placed.y + HEADER_H + index * ROW_H + ROW_H / 2
}

/** A cubic from the key's row to the target, leaving by the side that faces it. */
const edgePath = (from: Placed, fromY: number, to: Placed, toY: number) => {
  const gap = to.x - (from.x + CARD_W)
  if (gap >= 0 || to.x + CARD_W <= from.x) {
    const [x0, x1] = gap >= 0 ? [from.x + CARD_W, to.x] : [from.x, to.x + CARD_W]
    const bend = Math.max(24, Math.abs(x1 - x0) / 2)
    const dir = gap >= 0 ? 1 : -1
    return `M ${x0} ${fromY} C ${x0 + dir * bend} ${fromY} ${x1 - dir * bend} ${toY} ${x1} ${toY}`
  }
  const x0 = from.x + CARD_W
  const x1 = to.x + CARD_W
  return `M ${x0} ${fromY} C ${x0 + LOOP} ${fromY} ${x1 + LOOP} ${toY} ${x1} ${toY}`
}

/**
 * Cards in as many columns as the width holds, each card in the shortest column, the feature's
 * own tables first and the linked tables of other features after them.
 */
export const layoutErd = (own: DbTable[], others: DbTable[], available: number): ErdLayout => {
  const columns = Math.max(1, Math.floor((available - PAD * 2 + GAP_X) / (CARD_W + GAP_X)))
  const heights = Array.from({ length: columns }, () => PAD)
  const placed = new Map<string, Placed>()
  const place = (table: DbTable, isOwn: boolean) => {
    const column = heights.indexOf(Math.min(...heights))
    const height = cardHeight(table)
    placed.set(table.id, {
      table,
      x: PAD + column * (CARD_W + GAP_X),
      y: heights[column] ?? PAD,
      height,
      own: isOwn,
    })
    heights[column] = (heights[column] ?? PAD) + height + GAP_Y
  }
  for (const table of linkedOrder(own)) place(table, true)
  for (const table of linkedOrder(others)) place(table, false)

  const edges: ErdEdge[] = []
  for (const from of placed.values())
    from.table.foreignKeys.forEach((key, index) => {
      const to = placed.get(key.table)
      if (!to || to === from) return
      const fromY = rowY(from, key.columns[0] ?? '')
      const toY = rowY(to, key.targetColumns[0] ?? '')
      edges.push({
        key: `${from.table.id}#${index}`,
        source: from.table.id,
        target: to.table.id,
        resolved: key.resolved,
        d: edgePath(from, fromY, to, toY),
      })
    })

  return {
    placed,
    edges,
    width: Math.max(available, PAD * 2 + columns * CARD_W + (columns - 1) * GAP_X),
    height: Math.max(...heights) - GAP_Y + PAD,
  }
}

/** The feature picker's choice that shows every table. */
export const ALL = '*'

/**
 * The tables a view of one feature shows: its own, and with `neighbours` those a foreign key links
 * to them either way. Every table under `ALL`.
 */
export const tablesInView = (db: DatabaseResult, feature: string, neighbours: boolean) => {
  if (feature === ALL) return { own: db.tables, others: [] }
  const own = db.tables.filter((table) => table.feature === feature)
  if (!neighbours) return { own, others: [] }
  const ownIds = new Set(own.map((table) => table.id))
  const linked = new Set<string>()
  for (const table of db.tables)
    for (const key of table.foreignKeys) {
      if (ownIds.has(table.id) && !ownIds.has(key.table)) linked.add(key.table)
      if (!ownIds.has(table.id) && ownIds.has(key.table)) linked.add(table.id)
    }
  return { own, others: db.tables.filter((table) => linked.has(table.id)) }
}

/** The active table and the tables one drawn foreign key away from it. */
export const relatedTables = (active: string | null, edges: ErdEdge[]) => {
  const related = new Set<string>()
  if (active === null) return related
  related.add(active)
  for (const edge of edges) {
    if (edge.source === active) related.add(edge.target)
    if (edge.target === active) related.add(edge.source)
  }
  return related
}
