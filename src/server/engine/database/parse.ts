import type * as TS from 'typescript'
import type { DbColumn } from '../../../shared/types'
import type { TsApi } from '../typescript'

export type RawRef = { tableSymbol: string; column: string }

export type RawColumn = Omit<DbColumn, 'references'> & { references: RawRef | null }

export type RawForeignKey = {
  name: string | null
  columns: string[]
  tableSymbol: string
  targetColumns: string[]
  line: number
}

export type RawTable = {
  symbol: string
  name: string
  schemaSymbol: string | null
  kind: 'table' | 'view'
  line: number
  columns: RawColumn[]
  /** Symbols spread into the columns (`...timestamps`), resolved once every file is parsed. */
  spreads: string[]
  primaryKey: string[]
  uniques: string[][]
  foreignKeys: RawForeignKey[]
}

export type RawEnum = { symbol: string; name: string; values: string[]; line: number }

/** What one schema file declares, before symbols are matched across files. */
export type ParsedFile = {
  file: string
  tables: RawTable[]
  enums: RawEnum[]
  /** `const app = pgSchema('app')`: symbol → schema name. */
  schemas: Map<string, string>
  /** Exported object literals a table can spread into its columns. */
  spreads: Map<string, { columns: RawColumn[]; spreads: string[] }>
  /** Named imports from relative modules: local name → specifier and imported name. */
  imports: Map<string, { specifier: string; name: string }>
  /** Every relative module the file imports or re-exports, to follow. */
  modules: string[]
}

const TABLE_FNS = new Set(['pgTable', 'mysqlTable', 'sqliteTable', 'singlestoreTable', 'table'])
const VIEW_FNS = new Set([
  'pgView',
  'pgMaterializedView',
  'mysqlView',
  'sqliteView',
  'view',
  'materializedView',
])
const ENUM_FNS = new Set(['pgEnum', 'mysqlEnum', 'enum'])
const SCHEMA_FNS = new Set(['pgSchema', 'mysqlSchema'])

type Call = { name: string; node: TS.CallExpression }

/**
 * A chain of calls read from the inside out: `varchar('x').notNull().unique()` gives `varchar`,
 * `notNull`, `unique`, with `root` the expression the innermost call hangs from (`t` in
 * `t.varchar()`, `app` in `app.table()`), or null for a bare identifier.
 */
const chainOf = (ts: TsApi, expression: TS.Expression) => {
  const calls: Call[] = []
  let current: TS.Expression = expression
  let root: TS.Expression | null = null
  while (ts.isCallExpression(current)) {
    const callee = current.expression
    if (ts.isIdentifier(callee)) {
      calls.push({ name: callee.text, node: current })
      break
    }
    if (!ts.isPropertyAccessExpression(callee)) break
    calls.push({ name: callee.name.text, node: current })
    if (!ts.isCallExpression(callee.expression)) {
      root = callee.expression
      break
    }
    current = callee.expression
  }
  return { calls: calls.reverse(), root }
}

const stringOf = (ts: TsApi, node: TS.Node | undefined) =>
  node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : null

const unwrap = (ts: TsApi, node: TS.Expression): TS.Expression =>
  ts.isParenthesizedExpression(node) || ts.isAsExpression(node) ? unwrap(ts, node.expression) : node

/** `table.customerId` — possibly wrapped in `.asc().op()` — gives `customerId` and `table`. */
const columnRef = (ts: TsApi, node: TS.Expression): { owner: string; column: string } | null => {
  let current = unwrap(ts, node)
  while (ts.isCallExpression(current) && ts.isPropertyAccessExpression(current.expression))
    current = current.expression.expression
  if (!ts.isPropertyAccessExpression(current) || !ts.isIdentifier(current.expression)) return null
  return { owner: current.expression.text, column: current.name.text }
}

const columnRefs = (ts: TsApi, nodes: readonly TS.Expression[]) =>
  nodes.flatMap((node) => {
    const ref = columnRef(ts, node)
    return ref ? [ref] : []
  })

const propertyOf = (ts: TsApi, object: TS.ObjectLiteralExpression, key: string) => {
  for (const property of object.properties)
    if (
      ts.isPropertyAssignment(property) &&
      ts.isIdentifier(property.name) &&
      property.name.text === key
    )
      return unwrap(ts, property.initializer)
  return undefined
}

const arrayItems = (ts: TsApi, node: TS.Expression | undefined) =>
  node && ts.isArrayLiteralExpression(node) ? node.elements : []

const lineOf = (sourceFile: TS.SourceFile, node: TS.Node) =>
  sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1

const referenceOf = (ts: TsApi, call: TS.CallExpression): RawRef | null => {
  const [target] = call.arguments
  if (!target || !(ts.isArrowFunction(target) || ts.isFunctionExpression(target))) return null
  const body = ts.isBlock(target.body)
    ? target.body.statements.find(ts.isReturnStatement)?.expression
    : target.body
  const ref = body ? columnRef(ts, body) : null
  return ref ? { tableSymbol: ref.owner, column: ref.column } : null
}

const parseColumn = (
  ts: TsApi,
  sourceFile: TS.SourceFile,
  name: string,
  initializer: TS.Expression,
): RawColumn => {
  const { calls } = chainOf(ts, unwrap(ts, initializer))
  const [type, ...methods] = calls
  const column: RawColumn = {
    name,
    sqlName: type ? stringOf(ts, type.node.arguments[0]) : null,
    type: type?.name ?? '?',
    primaryKey: false,
    notNull: false,
    unique: false,
    references: null,
    line: lineOf(sourceFile, initializer),
  }
  for (const method of methods) {
    if (method.name === 'primaryKey') column.primaryKey = true
    else if (method.name === 'notNull') column.notNull = true
    else if (method.name === 'unique') column.unique = true
    else if (method.name === 'array') column.type += '[]'
    else if (method.name === 'references') column.references = referenceOf(ts, method.node)
  }
  if (column.primaryKey) column.notNull = true
  return column
}

const parseColumns = (ts: TsApi, sourceFile: TS.SourceFile, object: TS.ObjectLiteralExpression) => {
  const columns: RawColumn[] = []
  const spreads: string[] = []
  for (const property of object.properties) {
    if (ts.isSpreadAssignment(property)) {
      if (ts.isIdentifier(property.expression)) spreads.push(property.expression.text)
    } else if (ts.isPropertyAssignment(property)) {
      const key = ts.isIdentifier(property.name) ? property.name.text : stringOf(ts, property.name)
      if (key !== null) columns.push(parseColumn(ts, sourceFile, key, property.initializer))
    } else if (ts.isShorthandPropertyAssignment(property)) {
      columns.push(parseColumn(ts, sourceFile, property.name.text, property.name))
    }
  }
  return { columns, spreads }
}

type ConstraintSource = { nodes: TS.Expression[]; param: string | null }

/**
 * The constraints a table's third argument returns, as an array or as an object, and the name
 * the function gives the table (`(table) => [...]`), which a self-reference uses.
 */
const constraintNodes = (ts: TsApi, argument: TS.Expression | undefined): ConstraintSource => {
  const empty: ConstraintSource = { nodes: [], param: null }
  if (!argument || !(ts.isArrowFunction(argument) || ts.isFunctionExpression(argument)))
    return empty
  const first = argument.parameters[0]?.name
  const param = first && ts.isIdentifier(first) ? first.text : null
  const body = ts.isBlock(argument.body)
    ? argument.body.statements.find(ts.isReturnStatement)?.expression
    : argument.body
  const value = body ? unwrap(ts, body) : undefined
  if (!value) return empty
  if (ts.isArrayLiteralExpression(value))
    return { nodes: value.elements.map((node) => unwrap(ts, node)), param }
  if (ts.isObjectLiteralExpression(value))
    return {
      nodes: value.properties.flatMap((property) =>
        ts.isPropertyAssignment(property) ? [unwrap(ts, property.initializer)] : [],
      ),
      param,
    }
  return empty
}

type Constraints = Pick<RawTable, 'primaryKey' | 'uniques' | 'foreignKeys'>

const foreignKeyOf = (
  ts: TsApi,
  sourceFile: TS.SourceFile,
  call: TS.CallExpression,
): RawForeignKey | null => {
  const [spec] = call.arguments
  if (!spec || !ts.isObjectLiteralExpression(spec)) return null
  const columns = columnRefs(ts, arrayItems(ts, propertyOf(ts, spec, 'columns')))
  const targets = columnRefs(ts, arrayItems(ts, propertyOf(ts, spec, 'foreignColumns')))
  const target = targets[0]
  if (!target || columns.length === 0) return null
  return {
    name: stringOf(ts, propertyOf(ts, spec, 'name')),
    columns: columns.map((ref) => ref.column),
    tableSymbol: target.owner,
    targetColumns: targets.map((ref) => ref.column),
    line: lineOf(sourceFile, call),
  }
}

const primaryKeyOf = (ts: TsApi, call: TS.CallExpression) => {
  const [spec] = call.arguments
  const items =
    spec && ts.isObjectLiteralExpression(spec)
      ? arrayItems(ts, propertyOf(ts, spec, 'columns'))
      : call.arguments
  return columnRefs(ts, items).map((ref) => ref.column)
}

const parseConstraints = (
  ts: TsApi,
  sourceFile: TS.SourceFile,
  argument: TS.Expression | undefined,
  symbol: string,
): Constraints => {
  const result: Constraints = { primaryKey: [], uniques: [], foreignKeys: [] }
  const { nodes, param } = constraintNodes(ts, argument)
  for (const node of nodes) {
    const { calls } = chainOf(ts, node)
    const [first] = calls
    if (!first) continue
    if (first.name === 'foreignKey') {
      const key = foreignKeyOf(ts, sourceFile, first.node)
      // `foreignColumns: [table.id]` names the table itself through the function's parameter.
      if (key)
        result.foreignKeys.push(key.tableSymbol === param ? { ...key, tableSymbol: symbol } : key)
    } else if (first.name === 'primaryKey') {
      result.primaryKey = primaryKeyOf(ts, first.node)
    } else if (first.name === 'unique' || first.name === 'uniqueIndex') {
      const on = calls.find((call) => call.name === 'on')
      const columns = on ? columnRefs(ts, on.node.arguments).map((ref) => ref.column) : []
      if (columns.length) result.uniques.push(columns)
    }
  }
  return result
}

const parseTable = (
  ts: TsApi,
  sourceFile: TS.SourceFile,
  declaration: { symbol: string; call: TS.CallExpression; root: TS.Expression | null },
  kind: 'table' | 'view',
): RawTable | null => {
  const { symbol, call, root } = declaration
  const [nameNode, columnsNode, extra] = call.arguments
  const name = stringOf(ts, nameNode)
  if (name === null) return null
  const columns =
    columnsNode && ts.isObjectLiteralExpression(columnsNode)
      ? parseColumns(ts, sourceFile, columnsNode)
      : { columns: [], spreads: [] }
  const constraints =
    kind === 'table'
      ? parseConstraints(ts, sourceFile, extra, symbol)
      : { primaryKey: [], uniques: [], foreignKeys: [] }
  const inline = columns.columns.filter((column) => column.primaryKey).map((column) => column.name)
  return {
    symbol,
    name,
    schemaSymbol: root && ts.isIdentifier(root) ? root.text : null,
    kind,
    line: lineOf(sourceFile, call),
    ...columns,
    ...constraints,
    primaryKey: constraints.primaryKey.length ? constraints.primaryKey : inline,
  }
}

const parseEnum = (
  ts: TsApi,
  sourceFile: TS.SourceFile,
  symbol: string,
  call: TS.CallExpression,
) => {
  const name = stringOf(ts, call.arguments[0])
  if (name === null) return null
  const values = arrayItems(ts, call.arguments[1]).flatMap((item) => {
    const value = stringOf(ts, item)
    return value === null ? [] : [value]
  })
  return { symbol, name, values, line: lineOf(sourceFile, call) }
}

const isRelative = (specifier: string) => specifier.startsWith('.')

const readImports = (ts: TsApi, sourceFile: TS.SourceFile, parsed: ParsedFile) => {
  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement)) {
      const specifier = stringOf(ts, statement.moduleSpecifier)
      if (specifier === null || !isRelative(specifier)) continue
      parsed.modules.push(specifier)
      const bindings = statement.importClause?.namedBindings
      if (bindings && ts.isNamedImports(bindings))
        for (const element of bindings.elements)
          parsed.imports.set(element.name.text, {
            specifier,
            name: element.propertyName?.text ?? element.name.text,
          })
    } else if (ts.isExportDeclaration(statement)) {
      const specifier = stringOf(ts, statement.moduleSpecifier)
      if (specifier !== null && isRelative(specifier)) parsed.modules.push(specifier)
    }
  }
}

const readDeclaration = (
  ts: TsApi,
  sourceFile: TS.SourceFile,
  node: TS.VariableDeclaration,
  parsed: ParsedFile,
) => {
  if (!ts.isIdentifier(node.name) || !node.initializer) return
  const symbol = node.name.text
  const initializer = unwrap(ts, node.initializer)
  if (ts.isObjectLiteralExpression(initializer)) {
    parsed.spreads.set(symbol, parseColumns(ts, sourceFile, initializer))
    return
  }
  const { calls, root } = chainOf(ts, initializer)
  const [first] = calls
  if (!first) return
  const declaration = { symbol, call: first.node, root }
  if (TABLE_FNS.has(first.name)) {
    const table = parseTable(ts, sourceFile, declaration, 'table')
    if (table) parsed.tables.push(table)
  } else if (VIEW_FNS.has(first.name)) {
    const view = parseTable(ts, sourceFile, declaration, 'view')
    if (view) parsed.tables.push(view)
  } else if (ENUM_FNS.has(first.name)) {
    const item = parseEnum(ts, sourceFile, symbol, first.node)
    if (item) parsed.enums.push(item)
  } else if (SCHEMA_FNS.has(first.name)) {
    const name = stringOf(ts, first.node.arguments[0])
    if (name !== null) parsed.schemas.set(symbol, name)
  }
}

/** Reads one schema file: no type information, only the shapes Drizzle's builders are called in. */
export const parseSchemaFile = (ts: TsApi, file: string, text: string): ParsedFile => {
  const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const parsed: ParsedFile = {
    file,
    tables: [],
    enums: [],
    schemas: new Map(),
    spreads: new Map(),
    imports: new Map(),
    modules: [],
  }
  readImports(ts, sourceFile, parsed)
  const visit = (node: TS.Node) => {
    if (ts.isVariableDeclaration(node)) readDeclaration(ts, sourceFile, node, parsed)
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return parsed
}
