import assert from 'node:assert/strict'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import type { ResolvedConfig } from '../src/shared/config'
import { analyzeEngine, EngineError } from '../src/server/engine'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'layered')

const config: ResolvedConfig = {
  include: ['src/**'],
  exclude: [],
  tsconfig: 'tsconfig.json',
  features: ['src/components/*', 'src/lib/*'],
  layers: [
    { name: 'Entry', features: ['src', 'src/pages'] },
    { name: 'Features', siblings: true, features: ['src/components/*'] },
    { name: 'Core', features: ['src/lib'] },
  ],
  allow: [],
  rules: [],
  ai: { model: 'sonnet', budgetUsd: 1, language: 'English' },
}

const result = analyzeEngine(root, config)
const edge = (from: string, to: string) =>
  result.graph.edges.find((candidate) => candidate.from === from && candidate.to === to)

test('reads the referenced project with the project own TypeScript', () => {
  assert.deepEqual(result.ts.projects, ['tsconfig.json', 'tsconfig.app.json'])
  assert.ok(result.ts.version)
  assert.equal(result.stats.files, result.files.length)
})

test('falls back to the parent directory for a feature', () => {
  const main = result.files.find((file) => file.path === 'src/main.tsx')
  assert.equal(main?.feature, 'src')
})

test('classifies feature edges', () => {
  assert.equal(edge('src/components/a', 'src/components/b')?.class, 'mutual')
  assert.equal(edge('src/components/b', 'src/components/a')?.class, 'mutual')
  assert.equal(edge('src/lib', 'src/components/a')?.class, 'up')
  assert.equal(edge('src/pages', 'src/components/a')?.class, 'down')
  assert.equal(edge('src', 'src/pages')?.class, 'lateral')
  assert.deepEqual(edge('src/lib', 'src/components/a')?.imports, [
    { file: 'src/lib/db.ts', line: 1, target: 'src/components/a/A.tsx' },
  ])
})

test('a type import is counted but couples nothing', () => {
  assert.equal(edge('src/components/b', 'src/lib'), undefined)
  assert.ok(
    result.imports.some(
      (item) =>
        item.from === 'src/components/b/B.tsx' &&
        item.to === 'src/lib/db.ts' &&
        item.kind === 'type',
    ),
  )
  assert.equal(result.stats.typeImports, 1)
})

test('keeps re-exports and dynamic imports as edges', () => {
  const kinds = new Map(result.imports.map((item) => [`${item.from}>${item.to}`, item.kind]))
  assert.equal(kinds.get('src/pages/index.ts>src/pages/Home.tsx'), 'reexport')
  assert.equal(kinds.get('src/main.tsx>src/pages/Home.tsx'), 'dynamic')
  assert.equal(kinds.get('src/lib/lazy.ts>src/lib/x.ts'), 'dynamic')
})

test('finds the static cycle and ignores a dynamic back edge', () => {
  assert.deepEqual(result.graph.cycles, [
    ['src/components/a/A.tsx', 'src/components/b/B.tsx'],
    ['src/lib/x.ts', 'src/lib/y.ts'],
  ])
})

test('warns on an unresolved relative import, not on an asset', () => {
  assert.deepEqual(result.warnings, ["unresolved import './missing' in src/pages/Home.tsx:2"])
})

test('measures a function', () => {
  const pick = result.functions.find((item) => item.name === 'pick')
  assert.equal(pick?.complexity, 6)
  assert.equal(pick?.params, 3)
  assert.equal(pick?.line, 5)
  assert.equal(pick?.lines, 6)
})

test('computes coupling and instability', () => {
  const lib = result.graph.features.find((feature) => feature.id === 'src/lib')
  assert.equal(lib?.ce, 1)
  assert.equal(lib?.ca, 0)
  assert.equal(lib?.instability, 1)
})

test('names a project without TypeScript', () => {
  assert.throws(
    () => analyzeEngine('/', config),
    (error) => error instanceof EngineError && error.kind === 'typescript-missing',
  )
})

test('names a missing tsconfig', () => {
  assert.throws(
    () => analyzeEngine(root, { ...config, tsconfig: 'nope.json' }),
    (error) => error instanceof EngineError && error.kind === 'tsconfig-missing',
  )
})

test('without layers, a pair that imports both ways is mutual and the rest goes down', () => {
  const flat = analyzeEngine(root, { ...config, layers: [] })
  const flatEdge = (from: string, to: string) =>
    flat.graph.edges.find((candidate) => candidate.from === from && candidate.to === to)
  assert.equal(flatEdge('src/components/a', 'src/components/b')?.class, 'mutual')
  assert.equal(flatEdge('src/pages', 'src/components/a')?.class, 'down')
  assert.ok(flat.graph.edges.every((candidate) => candidate.class !== 'unlayered'))
})
