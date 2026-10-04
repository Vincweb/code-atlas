import path from 'node:path'
import type * as TS from 'typescript'
import type { ImportEdge, ImportKind } from '../../shared/types'
import type { Project, SourceFile } from './project'
import type { TsApi } from './typescript'
import { relativeTo } from './project'

export type RawImport = { specifier: string; line: number; kind: ImportKind }

const ASSET_EXTENSION = /\.(?:[a-z0-9]+)$/i
const CODE_EXTENSION = /\.(?:[cm]?[jt]s|[jt]sx)$/

const scriptKindFor = (ts: TsApi, file: string) => {
  const ext = path.extname(file)
  if (ext === '.tsx') return ts.ScriptKind.TSX
  if (ext === '.jsx') return ts.ScriptKind.JSX
  if (ext === '.js' || ext === '.mjs' || ext === '.cjs') return ts.ScriptKind.JS
  return ts.ScriptKind.TS
}

export const parseFile = (ts: TsApi, file: SourceFile) =>
  ts.createSourceFile(
    file.path,
    file.text,
    ts.ScriptTarget.Latest,
    true,
    scriptKindFor(ts, file.path),
  )

type ImportOf = [specifier: TS.Node | undefined, kind: ImportKind] | null

const allTypeOnly = (elements: readonly { isTypeOnly: boolean }[]) =>
  elements.length > 0 && elements.every((element) => element.isTypeOnly)

export const extractImports = (ts: TsApi, sourceFile: TS.SourceFile): RawImport[] => {
  const found: RawImport[] = []
  const add = (node: TS.Node, specifier: string, kind: ImportKind) => {
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
    found.push({ specifier, line: line + 1, kind })
  }
  const stringOf = (node: TS.Node | undefined) =>
    node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
      ? node.text
      : null

  const kindOfImport = (node: TS.ImportDeclaration): ImportKind => {
    const clause = node.importClause
    const bindings = clause?.namedBindings
    const onlyTypeNames =
      !!clause &&
      !clause.name &&
      !!bindings &&
      ts.isNamedImports(bindings) &&
      allTypeOnly(bindings.elements)
    return clause?.isTypeOnly || onlyTypeNames ? 'type' : 'static'
  }
  const kindOfExport = (node: TS.ExportDeclaration): ImportKind => {
    const clause = node.exportClause
    const onlyTypeNames = !!clause && ts.isNamedExports(clause) && allTypeOnly(clause.elements)
    return node.isTypeOnly || onlyTypeNames ? 'type' : 'reexport'
  }
  const callImportOf = (node: TS.CallExpression): ImportOf => {
    const [first] = node.arguments
    if (node.expression.kind === ts.SyntaxKind.ImportKeyword) return [first, 'dynamic']
    const isRequire =
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'require' &&
      node.arguments.length === 1
    return isRequire ? [first, 'static'] : null
  }
  /** The node naming the module a node imports, and how it imports it. */
  const importOf = (node: TS.Node): ImportOf => {
    if (ts.isImportDeclaration(node)) return [node.moduleSpecifier, kindOfImport(node)]
    if (ts.isExportDeclaration(node)) return [node.moduleSpecifier, kindOfExport(node)]
    if (ts.isCallExpression(node)) return callImportOf(node)
    if (ts.isImportEqualsDeclaration(node))
      return ts.isExternalModuleReference(node.moduleReference)
        ? [node.moduleReference.expression, node.isTypeOnly ? 'type' : 'static']
        : null
    if (ts.isImportTypeNode(node))
      return ts.isLiteralTypeNode(node.argument) ? [node.argument.literal, 'type'] : null
    return null
  }

  const visit = (node: TS.Node) => {
    const imported = importOf(node)
    const specifier = imported && stringOf(imported[0])
    if (imported && specifier !== null) add(node, specifier, imported[1])
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return found
}

const pathKeyMatches = (key: string, specifier: string) => {
  const star = key.indexOf('*')
  if (star === -1) return key === specifier
  return specifier.startsWith(key.slice(0, star)) && specifier.endsWith(key.slice(star + 1))
}

const worthWarning = (project: Project, specifier: string) => {
  const bare = specifier.split(/[?#]/)[0] ?? specifier
  const aliased = project.pathKeys.some((key) => pathKeyMatches(key, bare))
  if (!bare.startsWith('.') && !aliased) return false
  const extension = ASSET_EXTENSION.exec(path.posix.basename(bare))
  return !extension || CODE_EXTENSION.test(bare)
}

export type ResolvedImports = { edges: ImportEdge[]; unresolved: string[] }

export const resolveImports = (
  ts: TsApi,
  root: string,
  files: SourceFile[],
  raws: Map<string, RawImport[]>,
): ResolvedImports => {
  const known = new Set(files.map((file) => file.path))
  const caches = new Map<Project, TS.ModuleResolutionCache>()
  const canonical = (name: string) => (ts.sys.useCaseSensitiveFileNames ? name : name.toLowerCase())
  const edges: ImportEdge[] = []
  const unresolved: string[] = []
  for (const file of files) {
    let cache = caches.get(file.project)
    if (!cache) {
      cache = ts.createModuleResolutionCache(root, canonical, file.project.options)
      caches.set(file.project, cache)
    }
    for (const raw of raws.get(file.path) ?? []) {
      const { resolvedModule } = ts.resolveModuleName(
        raw.specifier,
        file.absolute,
        file.project.options,
        ts.sys,
        cache,
      )
      if (!resolvedModule) {
        if (worthWarning(file.project, raw.specifier)) {
          unresolved.push(`unresolved import '${raw.specifier}' in ${file.path}:${raw.line}`)
        }
        continue
      }
      if (resolvedModule.isExternalLibraryImport) continue
      const target = relativeTo(root, resolvedModule.resolvedFileName)
      if (!known.has(target)) continue
      edges.push({ from: file.path, to: target, line: raw.line, kind: raw.kind })
    }
  }
  return { edges, unresolved }
}
