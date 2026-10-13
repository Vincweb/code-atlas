import fs from 'node:fs'
import path from 'node:path'
import type { ResolvedConfig, ResolvedDatabaseConfig } from '../../../shared/config'
import type { DatabaseResult, DrizzleConfigInfo } from '../../../shared/types'
import type { TsApi } from '../typescript'
import { findDrizzleConfigs, readDrizzleConfig, schemaFiles } from './discover'
import { assignFeatures, buildDatabaseGraph, isJunction } from './features'
import { migrationsInfo } from './migrations'
import { parseSchemaFile } from './parse'
import type { ParsedFile } from './parse'
import { resolveModule, resolveTables } from './resolve'

const MAX_FILES = 3000

/**
 * The Drizzle configs the project can see, the one the analysis reads marked: the config's
 * `database.config` when it names a file, otherwise the first found.
 */
export const drizzleConfigs = (
  root: string,
  config: ResolvedDatabaseConfig,
): { configs: DrizzleConfigInfo[]; warnings: string[] } => {
  const warnings: string[] = []
  const found = findDrizzleConfigs(root)
  const explicit = config.config ? path.resolve(root, config.config) : null
  if (explicit && !fs.existsSync(explicit))
    warnings.push(`database.config names ${config.config}, which does not exist`)
  const chosen = explicit && fs.existsSync(explicit) ? explicit : found[0]
  const files = chosen && !found.includes(chosen) ? [chosen, ...found] : found
  return {
    configs: files.map((file) => ({ ...readDrizzleConfig(file), chosen: file === chosen })),
    warnings,
  }
}

const relativeTo = (root: string, file: string) =>
  path.relative(root, file).split(path.sep).join('/')

/** The schema files and everything they import or re-export relatively, parsed once each. */
const loadFiles = (ts: TsApi, seeds: string[]) => {
  const files = new Map<string, ParsedFile>()
  const queue = [...seeds]
  while (queue.length > 0 && files.size < MAX_FILES) {
    const file = queue.shift() as string
    if (files.has(file)) continue
    let text: string
    try {
      text = fs.readFileSync(file, 'utf8')
    } catch {
      continue
    }
    const parsed = parseSchemaFile(ts, file, text)
    files.set(file, parsed)
    for (const specifier of parsed.modules) {
      const target = resolveModule(file, specifier)
      if (target && !files.has(target)) queue.push(target)
    }
  }
  return files
}

export const migrationsDirOf = (chosen: DrizzleConfigInfo) =>
  chosen.out ? path.resolve(path.dirname(chosen.path), chosen.out) : null

/**
 * Reads the database schema a Drizzle config points at, as source: tables, columns, foreign
 * keys, grouped into features and classified like the import graph. Null without a config.
 */
export const analyzeDatabase = (
  root: string,
  config: ResolvedConfig,
  ts: TsApi,
): DatabaseResult | null => {
  const { configs, warnings } = drizzleConfigs(root, config.database)
  const chosen = configs.find((candidate) => candidate.chosen)
  if (!chosen) return null

  const seeds = chosen.schema.flatMap((entry) => schemaFiles(chosen.path, entry))
  if (chosen.schema.length === 0)
    warnings.push(`${relativeTo(root, chosen.path)} declares no schema`)
  else if (seeds.length === 0)
    warnings.push(
      `${relativeTo(root, chosen.path)}: schema ${chosen.schema.join(', ')} names no file`,
    )

  const files = loadFiles(ts, seeds)
  const resolved = resolveTables(files, root)
  warnings.push(...resolved.warnings)

  const features = assignFeatures(resolved.tables, config.database)
  const tables = resolved.tables.map((table) => ({
    ...table,
    feature: features.get(table.id) ?? table.name,
  }))
  for (const table of tables) table.junction = isJunction(table, config.database.junctions)
  const graph = buildDatabaseGraph(tables, config.database)

  const migrationsDir = migrationsDirOf(chosen)
  return {
    configs: configs.map((info) => ({ ...info, path: relativeTo(root, info.path) })),
    files: [...files.keys()].map((file) => relativeTo(root, file)).sort(),
    tables,
    enums: resolved.enums,
    graph,
    featuresSource: config.database.features ? 'config' : 'prefix',
    migrations: migrationsDir ? migrationsInfo(migrationsDir) : null,
    stats: {
      tables: tables.filter((table) => table.kind === 'table').length,
      views: tables.filter((table) => table.kind === 'view').length,
      columns: tables.reduce((sum, table) => sum + table.columns.length, 0),
      foreignKeys: tables.reduce((sum, table) => sum + table.foreignKeys.length, 0),
      features: graph.features.length,
      junctions: tables.filter((table) => table.junction).length,
      enums: resolved.enums.length,
    },
    warnings,
  }
}
