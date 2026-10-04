import assert from 'node:assert/strict'
import { test } from 'node:test'
import ts from 'typescript'
import { measureFunctions } from '../src/server/engine/complexity'
import { extractImports, parseFile } from '../src/server/engine/imports'
import type { SourceFile } from '../src/server/engine/project'
import { condensedDepths, stronglyConnected } from '../src/shared/graph'

const parse = (path: string, text: string) => parseFile(ts, { path, text } as SourceFile)

const graph = (pairs: [string, string][]) => {
  const edges = new Map<string, Set<string>>()
  for (const [from, to] of pairs) edges.set(from, (edges.get(from) ?? new Set()).add(to))
  return edges
}

test('reads every form of import with its kind', () => {
  const source = parse(
    'src/a.ts',
    [
      "import a from './static'",
      "import type { T } from './type-clause'",
      "import { type U, type V } from './type-names'",
      "import { type W, x } from './mixed'",
      "export { y } from './reexport'",
      "export type { Z } from './type-reexport'",
      "export * from './star'",
      'export { local }',
      "import fs = require('./equals')",
      "const lazy = () => import('./dynamic')",
      "const old = require('./require')",
      "type Q = import('./import-type').Q",
      'const notAnImport = require(name)',
    ].join('\n'),
  )
  assert.deepEqual(
    extractImports(ts, source).map(({ specifier, kind, line }) => [specifier, kind, line]),
    [
      ['./static', 'static', 1],
      ['./type-clause', 'type', 2],
      ['./type-names', 'type', 3],
      ['./mixed', 'static', 4],
      ['./reexport', 'reexport', 5],
      ['./type-reexport', 'type', 6],
      ['./star', 'reexport', 7],
      ['./equals', 'static', 9],
      ['./dynamic', 'dynamic', 10],
      ['./require', 'static', 11],
      ['./import-type', 'type', 12],
    ],
  )
})

test('counts branches and logical operators, not the functions nested inside', () => {
  const source = parse(
    'src/b.ts',
    [
      'export const f = (a: number, b?: number) => {',
      '  let c = b ?? 0',
      '  c ||= 1',
      '  if (a > 1 && c) return 1',
      '  for (const d of [a]) c += d',
      '  switch (a) { case 1: return 2; case 2: return 3; default: return c > 0 ? 4 : 5 }',
      '  const inner = () => (a ? 1 : 2)',
      '}',
    ].join('\n'),
  )
  const [outer, inner] = measureFunctions(ts, source, 'src/b.ts')
  assert.equal(outer?.complexity, 9)
  assert.equal(outer?.params, 2)
  assert.equal(inner?.name, 'inner')
  assert.equal(inner?.complexity, 2)
})

test('stronglyConnected groups a cycle, keeps a self-loop alone, and walks deep chains', () => {
  const components = stronglyConnected(
    ['a', 'd', 'e'],
    graph([
      ['a', 'b'],
      ['b', 'c'],
      ['c', 'a'],
      ['c', 'd'],
      ['e', 'e'],
    ]),
  )
  assert.deepEqual(components.map((component) => component.sort()).sort(), [
    ['a', 'b', 'c'],
    ['d'],
    ['e'],
  ])

  const deep = Array.from({ length: 100_000 }, (_, index): [string, string] => [
    `n${index}`,
    `n${index + 1}`,
  ])
  assert.equal(stronglyConnected(['n0'], graph(deep)).length, 100_001)
})

test('condensedDepths takes the longest path through the components', () => {
  const depths = condensedDepths(
    ['top', 'mid', 'loop1', 'loop2', 'base', 'alone'],
    graph([
      ['top', 'mid'],
      ['top', 'base'],
      ['mid', 'loop1'],
      ['loop1', 'loop2'],
      ['loop2', 'loop1'],
      ['loop2', 'base'],
    ]),
  )
  assert.deepEqual(Object.fromEntries(depths), {
    top: 0,
    mid: 1,
    loop1: 2,
    loop2: 2,
    base: 3,
    alone: 0,
  })
})
