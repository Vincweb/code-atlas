import { createRequire } from 'node:module'
import path from 'node:path'
import type * as TS from 'typescript'
import { EngineError } from './errors'

export type TsApi = typeof TS

export const loadTypeScript = (root: string): TsApi => {
  let loaded: unknown
  try {
    loaded = createRequire(path.join(root, 'package.json'))('typescript')
  } catch {
    throw new EngineError('typescript-missing', `typescript is not installed in ${root}`)
  }
  const api = ((loaded as { default?: unknown } | null)?.default ?? loaded) as TsApi
  if (typeof api?.createSourceFile !== 'function') {
    throw new EngineError(
      'typescript-no-api',
      'the installed typescript has no compiler API (TypeScript 7 ships none)',
    )
  }
  return api
}
