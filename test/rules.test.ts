import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import type { ResolvedConfig, RuleConfig } from '../src/shared/config'
import type { EngineResult, RuleResult } from '../src/shared/types'
import { evaluate, makeBaseline, runCheck } from '../src/server/rules'
import { readBaseline, readRun, ruleHash, writeBaseline, writeRun } from '../src/server/rules/state'
import { defaultTitle, evaluateStatic } from '../src/server/rules/static'

const engine: EngineResult = {
  ts: { version: '5', projects: [] },
  files: [
    { path: 'src/a/big.ts', feature: 'src/a', lines: 412 },
    { path: 'src/b/small.ts', feature: 'src/b', lines: 20 },
  ],
  imports: [
    { from: 'src/a/big.ts', to: 'src/b/small.ts', line: 3, kind: 'static' },
    { from: 'src/a/big.ts', to: 'src/b/types.ts', line: 4, kind: 'type' },
  ],
  graph: {
    layers: [],
    features: [],
    edges: [
      {
        from: 'src/b',
        to: 'src/a',
        weight: 2,
        class: 'up',
        imports: [
          { file: 'src/b/small.ts', line: 9, target: 'src/a/big.ts' },
          { file: 'src/b/small.ts', line: 2, target: 'src/a/big.ts' },
        ],
      },
      {
        from: 'src/a',
        to: 'src/c',
        weight: 1,
        class: 'sibling',
        imports: [{ file: 'src/a/big.ts', line: 1, target: 'x' }],
      },
      {
        from: 'src/a',
        to: 'src/b',
        weight: 1,
        class: 'down',
        imports: [{ file: 'src/a/big.ts', line: 3, target: 'x' }],
      },
    ],
    cycles: [['src/a', 'src/b']],
  },
  functions: [
    { file: 'src/a/big.ts', line: 5, name: 'useBoard', complexity: 23, params: 6, lines: 40 },
    { file: 'src/b/small.ts', line: 1, name: 'ok', complexity: 2, params: 1, lines: 3 },
  ],
  stats: { files: 2, lines: 432, imports: 2, typeImports: 1, features: 2, functions: 2 },
  warnings: [],
}

const project = () => {
  const root = mkdtempSync(join(tmpdir(), 'atlas-rules-'))
  mkdirSync(join(root, 'src/a'), { recursive: true })
  mkdirSync(join(root, 'src/b'), { recursive: true })
  writeFileSync(join(root, 'src/a/big.ts'), 'const a: any = 1\nconst ok = 2\nconst b = a as any\n')
  writeFileSync(join(root, 'src/b/small.ts'), 'export const x = 1\n')
  return root
}

const configOf = (rules: RuleConfig[]): ResolvedConfig => ({
  include: [],
  exclude: [],
  tsconfig: 'tsconfig.json',
  features: [],
  layers: [],
  allow: [],
  rules,
  ai: { model: 'sonnet', budgetUsd: 1, language: 'English' },
})

const base = { family: 'f', severity: 'high' } as const

const run = (rules: RuleConfig[]) => evaluateStatic(project(), configOf(rules), engine, 'abc')

test('graph rules report one violation per import statement', () => {
  const [layers, siblings, cycles] = run([
    { ...base, id: 'L', kind: 'layers' },
    { ...base, id: 'S', kind: 'siblings' },
    { ...base, id: 'C', kind: 'no-cycle' },
  ])
  assert.equal(layers?.count, 2)
  assert.deepEqual(layers?.violations[0], {
    file: 'src/b/small.ts',
    line: 2,
    message: 'src/b → src/a (up)',
  })
  assert.equal(siblings?.violations[0]?.message, 'src/a → src/c (sibling)')
  assert.equal(cycles?.violations[0]?.message, 'cycle: src/a → src/b → src/a')
  assert.equal(cycles?.violations[0]?.line, null)
  assert.equal(layers?.status, 'fail')
  assert.equal(layers?.commit, 'abc')
  assert.equal(layers?.title, 'Layering')
})

test('forbid-import ignores type imports unless asked', () => {
  const [plain, typed, none] = run([
    { ...base, id: 'A', kind: 'forbid-import', from: 'src/a/**', to: 'src/b/**' },
    { ...base, id: 'B', kind: 'forbid-import', from: 'src/a/**', to: 'src/b/**', types: true },
    { ...base, id: 'C', kind: 'forbid-import', from: 'src/b/**', to: 'src/a/**' },
  ])
  assert.equal(plain?.count, 1)
  assert.equal(typed?.count, 2)
  assert.equal(none?.status, 'pass')
})

test('metric rules', () => {
  const [lines, complexity, params, scoped] = run([
    { ...base, id: 'A', kind: 'max-lines', max: 400 },
    { ...base, id: 'B', kind: 'complexity', max: 15 },
    { ...base, id: 'C', kind: 'max-params', max: 4 },
    { ...base, id: 'D', kind: 'max-lines', max: 5, files: 'src/b/**' },
  ])
  assert.equal(lines?.violations[0]?.message, '412 lines (max 400)')
  assert.equal(complexity?.violations[0]?.message, 'useBoard: complexity 23 (max 15)')
  assert.equal(params?.count, 1)
  assert.equal(scoped?.violations[0]?.file, 'src/b/small.ts')
})

test('pattern reports lines and honours exclude', () => {
  const [found, excluded] = run([
    {
      ...base,
      id: 'A',
      kind: 'pattern',
      pattern: String.raw`:\s*any\b|\bas\s+any\b`,
      files: '**/*.ts',
    },
    { ...base, id: 'B', kind: 'pattern', pattern: 'any', exclude: 'src/a/**' },
  ])
  assert.deepEqual(
    found?.violations.map((v) => [v.file, v.line, v.message]),
    [
      ['src/a/big.ts', 1, 'const a: any = 1'],
      ['src/a/big.ts', 3, 'const b = a as any'],
    ],
  )
  assert.equal(excluded?.count, 0)
})

test('violations are capped, count is not', () => {
  const many = {
    ...engine,
    functions: Array.from({ length: 600 }, (_, i) => ({
      file: 'f.ts',
      line: i + 1,
      name: 'f',
      complexity: 99,
      params: 0,
      lines: 1,
    })),
  }
  const [result] = evaluateStatic(
    project(),
    configOf([{ ...base, id: 'A', kind: 'complexity', max: 1 }]),
    many,
    null,
  )
  assert.equal(result?.count, 600)
  assert.equal(result?.violations.length, 500)
})

test('default titles', () => {
  assert.equal(defaultTitle({ ...base, id: 'x', kind: 'command', run: 'pnpm lint' }), '`pnpm lint`')
  assert.equal(defaultTitle({ ...base, id: 'x', kind: 'ai', prompt: 'p'.repeat(100) }).length, 60)
})

test('state hashes are key-order independent and runs are rule-keyed', () => {
  const a: RuleConfig = { id: 'X', family: 'f', severity: 'low', kind: 'command', run: 'x' }
  const b: RuleConfig = { run: 'x', kind: 'command', severity: 'low', family: 'f', id: 'X' }
  assert.equal(ruleHash(a), ruleHash(b))
  assert.match(ruleHash(a), /^[0-9a-f]{12}$/)
  const stateDir = join(mkdtempSync(join(tmpdir(), 'atlas-state-')), '.code-atlas')
  assert.equal(readRun(stateDir, a), null)
  assert.equal(readBaseline(stateDir), null)
  const result = { id: 'X', count: 1 } as RuleResult
  writeRun(stateDir, a, result)
  assert.equal(readRun(stateDir, a)?.count, 1)
  assert.equal(readRun(stateDir, { ...a, run: 'y' }), null)
  const baseline = makeBaseline([], { overall: null, families: [] }, 'abc')
  writeBaseline(stateDir, baseline)
  assert.equal(readBaseline(stateDir)?.commit, 'abc')
})

test('evaluate merges stored runs, marks stale, and placeholders', () => {
  const root = project()
  const stateDir = join(root, '.code-atlas')
  const command: RuleConfig = { ...base, id: 'CMD', kind: 'command', run: 'x' }
  const ai: RuleConfig = { ...base, id: 'AI', family: 'ai', kind: 'ai', prompt: 'p' }
  const config = configOf([command, { ...base, id: 'LINES', kind: 'max-lines', max: 400 }, ai])
  writeRun(stateDir, command, {
    id: 'CMD',
    family: 'f',
    severity: 'high',
    kind: 'command',
    title: 't',
    status: 'pass',
    count: 0,
    violations: [],
    ranAt: 'x',
    commit: 'old',
    stale: false,
    costUsd: null,
    error: null,
  })
  const out = evaluate({ root, config, engine, stateDir, git: { commit: 'new', dirty: false } })
  assert.deepEqual(
    out.rules.map((r) => [r.id, r.status, r.stale]),
    [
      ['CMD', 'pass', true],
      ['LINES', 'fail', false],
      ['AI', 'not-run', false],
    ],
  )
  assert.equal(out.baseline, null)
  assert.equal(out.scores.families.find((f) => f.family === 'ai')?.pending, 1)
})

test('runCheck ratchets against the baseline', async () => {
  const root = project()
  const stateDir = join(root, '.code-atlas')
  const config = configOf([
    { ...base, id: 'LINES', kind: 'max-lines', max: 400 },
    { ...base, id: 'AI', kind: 'ai', prompt: 'p' },
  ])
  const lines: string[] = []
  const opts = {
    root,
    config,
    engine,
    stateDir,
    git: { commit: 'c', dirty: false },
    skipCommands: true,
    log: (l: string) => lines.push(l),
  }
  const first = await runCheck(opts)
  assert.equal(first.ok, false)
  assert.deepEqual(first.regressions, [{ id: 'LINES', before: 0, after: 1 }])
  assert.ok(lines.some((l) => l.includes('✗ LINES')))
  const baseline = makeBaseline(first.rules, first.scores, 'c')
  assert.deepEqual(baseline.violations, { LINES: 1 })
  writeBaseline(stateDir, baseline)
  const second = await runCheck(opts)
  assert.equal(second.ok, true)
  assert.equal(second.rules.length, 1)
})

test('runCheck recording a baseline reports the counts without a verdict', async () => {
  const lines: string[] = []
  await runCheck({
    root: project(),
    config: configOf([{ ...base, id: 'LINES', kind: 'max-lines', max: 400 }]),
    engine,
    stateDir: join(project(), '.code-atlas'),
    git: { commit: 'c', dirty: false },
    skipCommands: true,
    recording: true,
    log: (l: string) => lines.push(l),
  })
  assert.ok(lines.some((l) => l.endsWith('✗ LINES Files over 400 lines — 1')))
  assert.ok(lines.every((l) => !l.includes('regression') && !l.includes('baseline')))
})

test('runCheck runs command rules and fails on an error', async () => {
  const root = project()
  const stateDir = join(root, '.code-atlas')
  const config = configOf([{ ...base, id: 'CMD', kind: 'command', run: 'echo hi' }])
  const out = await runCheck({
    root,
    config,
    engine,
    stateDir,
    git: { commit: null, dirty: false },
    skipCommands: false,
    log: () => {},
  })
  assert.equal(out.ok, true)
  assert.equal(readRun(stateDir, config.rules[0] as RuleConfig)?.status, 'pass')
})

test('mutual rule reports mutual edges only', () => {
  const mutual = {
    ...engine,
    graph: {
      ...engine.graph,
      edges: [
        {
          from: 'src/a',
          to: 'src/b',
          weight: 1,
          class: 'mutual' as const,
          imports: [{ file: 'src/a/big.ts', line: 3, target: 'src/b/small.ts' }],
        },
      ],
    },
  }
  const [layers, result] = evaluateStatic(
    project(),
    configOf([
      { ...base, id: 'L', kind: 'layers' },
      { ...base, id: 'M', kind: 'mutual' },
    ]),
    mutual,
    null,
  )
  assert.equal(layers?.count, 0)
  assert.equal(result?.violations[0]?.message, 'src/a → src/b (mutual)')
  assert.equal(result?.title, 'Mutual dependencies')
})
