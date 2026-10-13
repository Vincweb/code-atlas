import fs from 'node:fs'
import path from 'node:path'
import type { DbColumn, DbEnum, DbForeignKey, DbTable } from '../../../shared/types'
import type { ParsedFile, RawColumn, RawTable } from './parse'

const EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.mjs', '.cjs']
const MAX_SPREAD_DEPTH = 3

const isFile = (file: string) => {
  try {
    return fs.statSync(file).isFile()
  } catch {
    return false
  }
}

/** A relative specifier to the file it names, trying the extensions TypeScript would. */
export const resolveModule = (from: string, specifier: string): string | null => {
  const base = path.resolve(path.dirname(from), specifier)
  const candidates = [
    base,
    base.replace(/\.([cm]?)js$/, '.$1ts'),
    ...EXTENSIONS.map((extension) => base + extension),
    ...EXTENSIONS.map((extension) => path.join(base, `index${extension}`)),
  ]
  return candidates.find(isFile) ?? null
}

type Files = Map<string, ParsedFile>

type Pick<T> = (file: ParsedFile, name: string) => T | undefined

/** A symbol as one file sees it: declared there, imported by name, or unique across the schema. */
const resolveSymbol = <T>(files: Files, from: ParsedFile, symbol: string, pick: Pick<T>) => {
  const own = pick(from, symbol)
  if (own !== undefined) return own
  const imported = from.imports.get(symbol)
  if (imported) {
    const target = resolveModule(from.file, imported.specifier)
    const file = target ? files.get(target) : undefined
    const found = file ? pick(file, imported.name) : undefined
    if (found !== undefined) return found
  }
  const matches = [...files.values()].flatMap((file) => {
    const found = pick(file, symbol)
    return found === undefined ? [] : [found]
  })
  return matches.length === 1 ? matches[0] : undefined
}

const pickTable: Pick<{ file: ParsedFile; table: RawTable }> = (file, name) => {
  const table = file.tables.find((candidate) => candidate.symbol === name)
  return table ? { file, table } : undefined
}

const pickSchema: Pick<string> = (file, name) => file.schemas.get(name)

const pickSpread: Pick<{ columns: RawColumn[]; spreads: string[] }> = (file, name) =>
  file.spreads.get(name)

const expandSpreads = (
  files: Files,
  from: ParsedFile,
  spreads: string[],
  depth = 0,
): RawColumn[] =>
  depth >= MAX_SPREAD_DEPTH
    ? []
    : spreads.flatMap((symbol) => {
        const found = resolveSymbol(files, from, symbol, pickSpread)
        return found
          ? [...found.columns, ...expandSpreads(files, from, found.spreads, depth + 1)]
          : []
      })

const relativeTo = (root: string, file: string) =>
  path.relative(root, file).split(path.sep).join('/')

type Context = { files: Files; root: string; idOf: Map<RawTable, string>; warnings: string[] }

const tableId = (files: Files, file: ParsedFile, table: RawTable) => {
  const schema = table.schemaSymbol
    ? resolveSymbol(files, file, table.schemaSymbol, pickSchema)
    : undefined
  return schema && schema !== 'public' ? `${schema}.${table.name}` : table.name
}

/** Every foreign key of a table, the inline `.references()` ones included, with targets as ids. */
const foreignKeysOf = (
  context: Context,
  file: ParsedFile,
  table: RawTable,
  columns: RawColumn[],
) => {
  const resolve = (symbol: string) => {
    const found = resolveSymbol(context.files, file, symbol, pickTable)
    const id = found ? context.idOf.get(found.table) : undefined
    if (id === undefined)
      context.warnings.push(
        `${relativeTo(context.root, file.file)}: ${table.name} references ${symbol}, which is not a table of this schema`,
      )
    return { table: id ?? symbol, resolved: id !== undefined }
  }
  const explicit: DbForeignKey[] = table.foreignKeys.map((key) => ({
    name: key.name,
    columns: key.columns,
    targetColumns: key.targetColumns,
    line: key.line,
    ...resolve(key.tableSymbol),
  }))
  const inline: DbForeignKey[] = columns.flatMap((column) =>
    column.references
      ? [
          {
            name: null,
            columns: [column.name],
            targetColumns: [column.references.column],
            line: column.line,
            ...resolve(column.references.tableSymbol),
          },
        ]
      : [],
  )
  return [...explicit, ...inline]
}

const toTable = (context: Context, file: ParsedFile, table: RawTable): DbTable => {
  const spread = expandSpreads(context.files, file, table.spreads).map((column) => ({
    ...column,
    line: table.line,
  }))
  const raw = [...table.columns, ...spread]
  const foreignKeys = foreignKeysOf(context, file, table, raw)
  const columns: DbColumn[] = raw.map((column) => {
    const key = foreignKeys.find(
      (candidate) => candidate.columns.length === 1 && candidate.columns[0] === column.name,
    )
    return {
      ...column,
      references:
        key && key.targetColumns[0] !== undefined
          ? { table: key.table, column: key.targetColumns[0], resolved: key.resolved }
          : null,
    }
  })
  const schema = context.idOf.get(table) ?? table.name
  return {
    id: schema,
    name: table.name,
    schema: schema.includes('.') ? schema.slice(0, schema.indexOf('.')) : null,
    symbol: table.symbol,
    file: relativeTo(context.root, file.file),
    line: table.line,
    kind: table.kind,
    feature: '',
    junction: false,
    columns,
    primaryKey: table.primaryKey,
    uniques: table.uniques,
    foreignKeys,
  }
}

/** Matches the symbols every file declares across the whole schema, and names each table. */
export const resolveTables = (files: Files, root: string) => {
  const warnings: string[] = []
  const idOf = new Map<RawTable, string>()
  for (const file of files.values())
    for (const table of file.tables) idOf.set(table, tableId(files, file, table))
  const context: Context = { files, root, idOf, warnings }
  const tables = new Map<string, DbTable>()
  const enums: DbEnum[] = []
  for (const file of files.values()) {
    for (const raw of file.tables) {
      const table = toTable(context, file, raw)
      const seen = tables.get(table.id)
      if (seen) warnings.push(`${table.id} is declared twice: ${seen.file} and ${table.file}`)
      else tables.set(table.id, table)
    }
    for (const item of file.enums) enums.push({ ...item, file: relativeTo(root, file.file) })
  }
  return {
    tables: [...tables.values()].sort((a, b) => a.id.localeCompare(b.id)),
    enums: enums.sort((a, b) => a.name.localeCompare(b.name)),
    warnings,
  }
}
