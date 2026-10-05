import { createRequire } from 'node:module'
import path from 'node:path'
import type * as TS from 'typescript'
import { EngineError } from './errors'

export type TsApi = typeof TS

/** The project's own compiler; in a monorepo, the root's or else the first package's that has one. */
export const loadTypeScript = (root: string, packages: string[] = []): TsApi => {
  let loaded: unknown
  let found = false
  for (const dir of [root, ...packages.map((member) => path.join(root, member))]) {
    try {
      loaded = createRequire(path.join(dir, 'package.json'))('typescript')
      found = true
      break
    } catch {
      // not installed here
    }
  }
  if (!found) throw new EngineError('typescript-missing', `typescript is not installed in ${root}`)
  const api = ((loaded as { default?: unknown } | null)?.default ?? loaded) as TsApi
  if (typeof api?.createSourceFile !== 'function') {
    throw new EngineError(
      'typescript-no-api',
      'the installed typescript has no compiler API (TypeScript 7 ships none)',
    )
  }
  return api
}
