import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import type { EngineResult } from '../src/shared/types'
import { ConfigError, defaultRules, draftConfig, draftText, loadConfig } from '../src/server/config'

const project = (files: Record<string, string> = {}, dirs: string[] = []) => {
  const root = mkdtempSync(join(tmpdir(), 'atlas-config-'))
  for (const dir of dirs) mkdirSync(join(root, dir), { recursive: true })
  for (const [name, text] of Object.entries(files)) writeFileSync(join(root, name), text)
  return root
}

const issuesOf = (config: unknown) => {
  const root = project({ 'code-atlas.json': JSON.stringify(config) })
  try {
    loadConfig(root)
  } catch (error) {
    assert.ok(error instanceof ConfigError)
    return error.issues
  }
  return []
}

test('defaults without a file', () => {
  const root = project({}, ['src'])
  const { config, source, path } = loadConfig(root)
  assert.equal(source, 'default')
  assert.equal(path, null)
  assert.deepEqual(config.include, ['src/**'])
  assert.deepEqual(config.features, ['src/*'])
  assert.equal(config.tsconfig, 'tsconfig.json')
  assert.deepEqual(config.ai, { model: 'sonnet', budgetUsd: 1, language: 'English' })
  assert.ok(config.rules.some((rule) => rule.id === 'CC-ANY'))
})

test('default features split a folder with three subfolders or more', () => {
  const root = project({}, [
    'src/components/a',
    'src/components/b',
    'src/components/c',
    'src/hooks/queries',
    'src/hooks/mutations',
  ])
  assert.deepEqual(loadConfig(root).config.features, ['src/components/*', 'src/*'])
})

test('no src directory', () => {
  const { config } = loadConfig(project())
  assert.deepEqual(config.include, ['**'])
  assert.deepEqual(config.features, ['*'])
})

test('file and cli sources', () => {
  const root = project({
    'code-atlas.json': JSON.stringify({ $schema: 'x', ai: { language: 'French' } }),
    'other.json': '{}',
  })
  const file = loadConfig(root)
  assert.equal(file.source, 'file')
  assert.deepEqual(file.config.ai, { model: 'sonnet', budgetUsd: 1, language: 'French' })
  assert.equal(loadConfig(root, join(root, 'other.json')).source, 'cli')
})

test('collects every issue', () => {
  const issues = issuesOf({
    nope: 1,
    include: 'src',
    allow: [['a']],
    rules: [
      { id: 'A', family: 'f', severity: 'huge', kind: 'layers' },
      { id: 'A', family: 'f', severity: 'low', kind: 'max-lines' },
      { id: 'B', family: 'f', severity: 'low', kind: 'pattern', pattern: '(' },
      { id: 'C', family: 'f', severity: 'low', kind: 'command' },
    ],
  })
  const text = issues.join('\n')
  for (const part of [
    'unknown key nope',
    'include must be',
    'allow must be',
    'severity',
    'duplicate rule id A',
    'missing field max',
    'does not compile',
    'missing field run',
  ])
    assert.match(text, new RegExp(part))
})

test('invalid json is a config error', () => {
  const root = project({ 'code-atlas.json': '{' })
  assert.throws(() => loadConfig(root), ConfigError)
})

test('default rules read the package manager and scripts', () => {
  const root = project({
    'package.json': JSON.stringify({ scripts: { lint: 'x', 'type-check': 'x', knip: 'x' } }),
    'yarn.lock': '',
  })
  const rules = defaultRules(root, [])
  const lint = rules.find((rule) => rule.id === 'TL-LINT')
  assert.equal(lint?.kind === 'command' && lint.run, 'yarn run lint')
  assert.equal(rules.find((rule) => rule.id === 'TL-KNIP')?.severity, 'medium')
  assert.ok(rules.some((rule) => rule.id === 'TL-TYPES'))
  assert.ok(!rules.some((rule) => rule.id === 'TL-TEST'))
  assert.ok(!rules.some((rule) => rule.id === 'ARCH-LAYERS'))
  assert.equal(rules.filter((rule) => rule.kind === 'ai').length, 2)
})

test('layer rules appear with layers', () => {
  const ids = (siblings: boolean) =>
    defaultRules(project(), [{ name: 'L', features: ['a'], siblings }]).map((rule) => rule.id)
  assert.ok(ids(false).includes('ARCH-LAYERS'))
  assert.ok(!ids(false).includes('ARCH-SIBLINGS'))
  assert.ok(ids(true).includes('ARCH-SIBLINGS'))
})

const engine = (
  files: string[],
  imports: [string, string, ('static' | 'type')?][],
): EngineResult => ({
  ts: { version: '5', projects: [] },
  files: files.map((path) => ({ path, feature: '', lines: 10 })),
  imports: imports.map(([from, to, kind]) => ({ from, to, line: 1, kind: kind ?? 'static' })),
  graph: { layers: [], features: [], edges: [], cycles: [] },
  functions: [],
  stats: { files: files.length, lines: 0, imports: 0, typeImports: 0, features: 0, functions: 0 },
  warnings: [],
})

test('draft config layers features by longest path', () => {
  const root = project({}, ['src'])
  const result = draftConfig(
    root,
    engine(
      ['app', 'ui', 'core', 'util', 'a', 'b'].map((name) => `src/${name}/index.ts`),
      [
        ['src/app/index.ts', 'src/ui/index.ts'],
        ['src/app/index.ts', 'src/core/index.ts'],
        ['src/ui/index.ts', 'src/core/index.ts'],
        ['src/core/index.ts', 'src/util/index.ts'],
        ['src/a/index.ts', 'src/b/index.ts'],
        ['src/b/index.ts', 'src/a/index.ts'],
        ['src/util/index.ts', 'src/app/index.ts', 'type'],
      ],
    ),
  )
  assert.deepEqual(result.features, ['src/*'])
  assert.deepEqual(
    result.layers?.map((layer) => [layer.name, layer.features]),
    [
      ['Layer 1', ['src/a', 'src/app', 'src/b']],
      ['Layer 2', ['src/ui']],
      ['Layer 3', ['src/core']],
      ['Layer 4', ['src/util']],
    ],
  )
  assert.equal(result.layers?.[0]?.siblings, true)
  assert.equal(result.layers?.[1]?.siblings, undefined)
  assert.ok(result.rules?.some((rule) => rule.id === 'ARCH-LAYERS'))
})

test('draft nests directories with several subdirectories', () => {
  const root = project({}, ['src'])
  const result = draftConfig(
    root,
    engine(
      ['src/features/a/x.ts', 'src/features/b/x.ts', 'src/features/c/x.ts', 'src/lib/x.ts'],
      [],
    ),
  )
  assert.deepEqual(result.features, ['src/features/*', 'src/*'])
})

test('draft text starts with the schema', () => {
  const text = draftText({ features: ['src/*'] })
  assert.ok(
    text.startsWith(
      '{\n  "$schema": "https://raw.githubusercontent.com/Vincweb/code-atlas/main/schema.json"',
    ),
  )
  assert.ok(text.endsWith('}\n'))
})
