import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { packageRules } from '../src/shared/packages'
import { ruleScore } from '../src/shared/score'
import { loadConfig } from '../src/server/config'
import { analyzeEngine } from '../src/server/engine'
import { detectWorkspaces, pnpmPackages, workspaceMembers } from '../src/server/engine/workspace'
import { evaluate, makeBaseline, runCheck } from '../src/server/rules'
import { parseCommandOutput } from '../src/server/rules/command'
import { writeBaseline } from '../src/server/rules/state'
import { isProject } from '../src/server/discover'
import { analyzeProject } from '../src/server/project'
import { scopeAnalysis } from '../src/client/util/scope'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'workspace')

// The package manager links a workspace package into node_modules; the fixture does the same.
const link = path.join(root, 'apps/web/node_modules/@ws/math')
rmSync(path.join(root, 'apps/web/node_modules'), { recursive: true, force: true })
mkdirSync(path.dirname(link), { recursive: true })
symlinkSync(path.join(root, 'packages/math'), link, 'dir')

const { config } = loadConfig(root)
const engine = analyzeEngine(root, config)
const stateDir = () => mkdtempSync(path.join(tmpdir(), 'atlas-ws-'))

test('reads the packages of pnpm-workspace.yaml by hand', () => {
  const yaml = [
    'nodeLinker: hoisted',
    'packages:',
    "  - 'apps/*'",
    '  - "packages/*" # shared code',
    '  - scripts',
    'allowBuilds:',
    '  - esbuild',
  ].join('\n')
  assert.deepEqual(pnpmPackages(yaml), ['apps/*', 'packages/*', 'scripts'])
})

test('a monorepo root is a project, its packages are those with a tsconfig', () => {
  assert.deepEqual(detectWorkspaces(root), ['apps/*', 'packages/*', '!packages/legacy'])
  assert.ok(isProject(root))
  const members = workspaceMembers(root, config.workspaces, 'tsconfig.json')
  assert.deepEqual(
    members.map((member) => [member.dir, member.name]),
    [
      ['apps/web', '@ws/web'],
      ['packages/math', '@ws/math'],
    ],
  )
  assert.deepEqual(workspaceMembers(root, ['apps/*', '!apps/web'], 'tsconfig.json'), [])
})

test('defaults look inside each package', () => {
  assert.deepEqual(config.include, ['apps/*/src/**', 'packages/*/src/**'])
  assert.deepEqual(config.features, ['apps/web/src/*', 'packages/math/src/*'])
})

test('one pass over every package, with the imports between them', () => {
  assert.deepEqual(engine.ts.projects, ['apps/web/tsconfig.json', 'packages/math/tsconfig.json'])
  assert.deepEqual(
    engine.packages.map((pkg) => pkg.dir),
    ['apps/web', 'packages/math'],
  )
  const main = engine.files.find((file) => file.path === 'apps/web/src/main.ts')
  assert.equal(main?.package, 'apps/web')
  assert.ok(
    engine.imports.some(
      (edge) => edge.from === 'apps/web/src/main.ts' && edge.to === 'packages/math/src/index.ts',
    ),
    'the import through node_modules lands on the package source',
  )
  assert.ok(
    engine.imports.some(
      (edge) => edge.from === 'apps/web/src/main.ts' && edge.to === 'apps/web/src/views/home.ts',
    ),
    'each package keeps its own paths',
  )
  assert.deepEqual(engine.warnings, [])
})

test('each package is scored on its own violations', () => {
  const { rules, scores, packages } = evaluate({
    root,
    config,
    engine,
    stateDir: stateDir(),
    git: { commit: null, dirty: false },
  })
  const any = rules.find((rule) => rule.id === 'CC-ANY')
  assert.equal(any?.count, 1)
  assert.deepEqual(any?.packages, { 'apps/web': 1, 'packages/math': 0 })
  assert.equal(any?.unattributed, 0)
  assert.equal(any?.violations[0]?.package, 'apps/web')

  const web = packageRules(rules, 'apps/web').find((rule) => rule.id === 'CC-ANY')
  const math = packageRules(rules, 'packages/math').find((rule) => rule.id === 'CC-ANY')
  assert.equal(web?.status, 'fail')
  assert.equal(web?.score, ruleScore('high', 1))
  assert.equal(math?.status, 'pass')
  assert.deepEqual(math?.violations, [])

  const byDir = new Map(packages.map((entry) => [entry.dir, entry.scores]))
  const cleanCode = (dir: string) =>
    byDir.get(dir)?.families.find((family) => family.family === 'clean-code')?.score
  assert.ok((cleanCode('apps/web') ?? 100) < 100)
  assert.equal(cleanCode('packages/math'), 100)

  // The repository's score of the rule sits between its packages', weighted by their lines.
  assert.ok((any?.score ?? 0) > ruleScore('high', 1) && (any?.score ?? 100) < 100)
  assert.ok(scores.overall !== null)
})

test('a rule narrowed to some files leaves the other packages out', () => {
  const narrowed = {
    ...config,
    rules: [
      {
        id: 'WEB-ANY',
        family: 'clean-code',
        severity: 'high' as const,
        kind: 'pattern' as const,
        pattern: 'any',
        files: 'apps/web/**',
      },
    ],
  }
  const { rules } = evaluate({
    root,
    config: narrowed,
    engine,
    stateDir: stateDir(),
    git: { commit: null, dirty: false },
  })
  assert.deepEqual(rules[0]?.packages, { 'apps/web': 1 })
  assert.deepEqual(packageRules(rules, 'packages/math'), [])
})

test('a command run in a monorepo is read package by package', () => {
  const packages = engine.packages
  const lines = [
    '@ws/web:type-check: src/views/home.ts(3,22): error TS7006',
    '@ws/math:lint: ',
    `@ws/math:lint: ${path.join(root, 'packages/math/src/index.ts')}`,
    '@ws/math:lint:   1:14  error  Missing return type  explicit-function-return-type',
    '@ws/math:lint: ',
    'packages/math lint: src/index.ts:1:1 warning',
    'src/index.ts:1 unknown package, nothing to read',
  ]
  assert.deepEqual(
    parseCommandOutput(root, lines, packages).map((v) => `${v.file}:${v.line}`),
    ['apps/web/src/views/home.ts:3', 'packages/math/src/index.ts:1'],
  )
})

test('--check fails when one package gets worse, even if the total does not', async () => {
  const state = stateDir()
  const rules = [
    {
      id: 'ANY',
      family: 'clean-code',
      severity: 'high' as const,
      kind: 'pattern' as const,
      pattern: 'any|=>',
    },
  ]
  const checked = { ...config, rules }
  const log: string[] = []
  const first = await runCheck({
    root,
    config: checked,
    engine,
    stateDir: state,
    git: { commit: null, dirty: false },
    skipCommands: true,
    recording: true,
    log: (line) => log.push(line),
  })
  assert.ok(log.some((line) => line.includes('@ws/web (apps/web)')))
  const baseline = makeBaseline(first.rules, first.scores, null, first.packages)
  const web = baseline.packages?.['apps/web']?.violations.ANY ?? 0
  const math = baseline.packages?.['packages/math']?.violations.ANY ?? 0
  assert.ok(web > 0 && math > 0)
  // Pretend math used to have one more and web one fewer: same total, web regressed.
  writeBaseline(state, {
    ...baseline,
    packages: {
      'apps/web': { scores: first.scores, violations: { ANY: web - 1 } },
      'packages/math': { scores: first.scores, violations: { ANY: math + 1 } },
    },
  })
  const second = await runCheck({
    root,
    config: checked,
    engine,
    stateDir: state,
    git: { commit: null, dirty: false },
    skipCommands: true,
    log: () => {},
  })
  assert.equal(second.ok, false)
  assert.deepEqual(second.regressions, [
    { id: 'ANY', package: 'apps/web', before: web - 1, after: web },
  ])
})

test('the page scopes one analysis to a package, or draws the packages', () => {
  const analysis = analyzeProject(root, { root: null, config: null, state: stateDir() })
  assert.deepEqual(
    analysis.workspace?.graph.edges.map((edge) => [edge.from, edge.to, edge.weight]),
    [['apps/web', 'packages/math', 1]],
  )
  const whole = scopeAnalysis(analysis, null)
  assert.equal(whole.graph, analysis.workspace?.graph)
  assert.equal(whole.rules, analysis.rules)

  const web = scopeAnalysis(analysis, 'apps/web')
  assert.ok(web.files.every((file) => file.package === 'apps/web'))
  assert.ok(web.graph.features.every((feature) => feature.id.startsWith('apps/web/')))
  assert.ok(web.graph.edges.every((edge) => edge.to.startsWith('apps/web/')))
  assert.equal(web.scores, analysis.workspace?.packages[0]?.scores)
  assert.equal(web.stats.files, 2)
  assert.equal(web.rules.find((rule) => rule.id === 'CC-ANY')?.count, 1)

  assert.equal(scopeAnalysis(analysis, 'nowhere').graph, analysis.workspace?.graph)
})
