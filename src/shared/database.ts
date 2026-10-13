import type { Graph } from './types'

/** What the database analysis produces: the Drizzle schema as source, grouped into features. */

/** A column as the schema declares it; `sqlName` is the explicit SQL name when one is given. */
export type DbColumn = {
  name: string
  sqlName: string | null
  type: string
  primaryKey: boolean
  notNull: boolean
  unique: boolean
  references: DbRef | null
  line: number
}

/** The target of a `.references()`: the table's id when it resolved, the symbol as written otherwise. */
export type DbRef = { table: string; column: string; resolved: boolean }

export type DbForeignKey = {
  name: string | null
  columns: string[]
  table: string
  targetColumns: string[]
  resolved: boolean
  line: number
}

export type DbTable = {
  /** The SQL name, prefixed by its schema when that is not the default one: `backoffice.orders`. */
  id: string
  name: string
  schema: string | null
  symbol: string
  file: string
  line: number
  kind: 'table' | 'view'
  feature: string
  junction: boolean
  columns: DbColumn[]
  primaryKey: string[]
  uniques: string[][]
  foreignKeys: DbForeignKey[]
}

export type DbEnum = { name: string; symbol: string; values: string[]; file: string; line: number }

export type DrizzleConfigInfo = {
  path: string
  schema: string[]
  out: string | null
  dialect: string | null
  casing: string | null
  chosen: boolean
}

/** The migrations folder a config points at: v1 holds one folder per migration, v0 a `meta/` journal. */
export type DbMigrationsInfo = { dir: string; count: number; layout: 'v1' | 'v0' }

export type DbStats = {
  tables: number
  views: number
  columns: number
  foreignKeys: number
  features: number
  junctions: number
  enums: number
}

export type DatabaseResult = {
  configs: DrizzleConfigInfo[]
  files: string[]
  tables: DbTable[]
  enums: DbEnum[]
  graph: Graph
  featuresSource: 'config' | 'prefix'
  migrations: DbMigrationsInfo | null
  stats: DbStats
  warnings: string[]
}
