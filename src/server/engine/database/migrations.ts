import fs from 'node:fs'
import path from 'node:path'
import { createScanner } from 'drizzle-graph'
import type { Graph as MigrationGraph } from 'drizzle-graph'
import type { DbMigrationsInfo } from '../../../shared/types'
import { entriesOf } from '../fs'

/** Drizzle Kit v1 keeps one folder per migration, each with a snapshot; v0 kept a journal. */
export const migrationsInfo = (dir: string): DbMigrationsInfo | null => {
  const entries = entriesOf(dir)
  const v1 = entries.filter(
    (entry) => entry.isDirectory() && fs.existsSync(path.join(dir, entry.name, 'snapshot.json')),
  ).length
  if (v1 > 0) return { dir, count: v1, layout: 'v1' }
  if (fs.existsSync(path.join(dir, 'meta', '_journal.json'))) {
    const count = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.sql')).length
    return { dir, count, layout: 'v0' }
  }
  return null
}

/**
 * The migration graph drizzle-graph draws: lanes rebuilt from each snapshot's `prevIds`, the
 * commit that added each folder. Reads the folder and runs `git log`; never drizzle-kit.
 */
export const buildMigrationGraph = (dir: string): MigrationGraph =>
  createScanner({ migrationsDir: dir }).buildGraph()

export const readMigrationSql = (dir: string, folder: string): string | null =>
  createScanner({ migrationsDir: dir }).readMigrationSql(folder)
