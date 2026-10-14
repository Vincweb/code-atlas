import assert from 'node:assert/strict'
import path from 'node:path'
import { test } from 'node:test'
import type { CheckReport, EngineResult, RuleResult } from '../src/shared/types'
import {
  checkReport,
  githubAnnotations,
  isFormat,
  sarifReport,
  summaryMarkdown,
} from '../src/server/report'

const engine = {
  packages: [{ dir: 'apps/web', name: '@acme/web' }],
} as EngineResult

const rule = (id: string, count: number, violations: RuleResult['violations']): RuleResult => ({
  id,
  family: 'architecture',
  severity: id === 'LOW' ? 'low' : 'high',
  kind: 'layers',
  title: `Rule ${id}`,
  status: count ? 'fail' : 'pass',
  count,
  score: 50,
  violations,
  ranAt: null,
  commit: null,
  stale: false,
  error: null,
})

const rules = [
  rule('UP', 2, [
    { file: 'src/a.ts', line: 3, message: 'src/a → src/b (up)' },
    { file: 'src/c.ts', line: null, message: 'cycle: a → b, c' },
  ]),
  rule('LOW', 1, [{ file: null, line: null, message: 'nowhere\nsecond line 100%' }]),
  rule('OK', 0, []),
]

const report = (): CheckReport =>
  checkReport({
    root: '/repo/apps/web',
    engine,
    git: { commit: 'abc', dirty: false },
    recording: false,
    result: {
      ok: false,
      rules,
      scores: {
        overall: 60,
        families: [
          { family: 'architecture', score: 60, rules: 3, failing: 2, pending: 0, beta: false },
        ],
      },
      packages: [{ dir: 'apps/web', scores: { overall: 60, families: [] } }],
      regressions: [{ id: 'UP', before: 1, after: 2 }],
      baseline: {
        commit: 'old',
        savedAt: 'yesterday',
        scores: { overall: 70, families: [] },
        violations: { UP: 1, LOW: 1, OK: 0 },
      },
    },
  })

const withWorkspace = <T>(workspace: string, run: () => T): T => {
  const previous = process.env.GITHUB_WORKSPACE
  process.env.GITHUB_WORKSPACE = workspace
  try {
    return run()
  } finally {
    if (previous === undefined) delete process.env.GITHUB_WORKSPACE
    else process.env.GITHUB_WORKSPACE = previous
  }
}

test('the report names the packages and keeps the baseline’s stamp', () => {
  const made = report()
  assert.deepEqual(made.packages, [
    { dir: 'apps/web', name: '@acme/web', scores: { overall: 60, families: [] } },
  ])
  assert.deepEqual(made.baseline, { commit: 'old', savedAt: 'yesterday' })
  assert.equal(made.ok, false)
  assert.ok(isFormat('github') && !isFormat('xml'))
})

test('GitHub annotations cover the regressed rules, on paths relative to the checkout', () => {
  const lines = withWorkspace('/repo', () => githubAnnotations(report()))
  assert.deepEqual(lines, [
    '::error title=code-atlas%3A UP regressed::2 violations (baseline 1)',
    '::error file=apps/web/src/a.ts,line=3,title=code-atlas%3A UP::src/a → src/b (up)',
    '::error file=apps/web/src/c.ts,title=code-atlas%3A UP::cycle: a → b, c',
  ])
})

test('annotations escape what the runner would misread, and stop at ten', () => {
  const many = checkReport({
    root: '/repo',
    engine,
    git: { commit: null, dirty: false },
    recording: false,
    result: {
      ok: false,
      rules: [
        rule(
          'MANY',
          12,
          Array.from({ length: 12 }, (_, index) => ({
            file: `src/${index}.ts`,
            line: 1,
            message: '50% done\nnext',
          })),
        ),
      ],
      scores: { overall: 10, families: [] },
      packages: [],
      regressions: [{ id: 'MANY', before: 0, after: 12 }],
      baseline: null,
    },
  })
  const lines = withWorkspace('/repo', () => githubAnnotations(many))
  assert.equal(lines.length, 11)
  assert.equal(lines[1], '::error file=src/0.ts,line=1,title=code-atlas%3A MANY::50%25 done%0Anext')
})

test('a rule the baseline never counted is a warning, in the report, the annotations and the summary', () => {
  const result = {
    ok: true,
    rules: [rule('DOCS', 3, []), rule('OK', 0, [])],
    scores: { overall: 90, families: [] },
    packages: [],
    regressions: [],
    baseline: {
      commit: 'old',
      savedAt: 'then',
      scores: { overall: 90, families: [] },
      violations: { OK: 0 },
    },
  }
  const reportOf = (recording: boolean) =>
    checkReport({ root: '/repo', engine, git: { commit: 'abc', dirty: false }, recording, result })
  const made = reportOf(false)
  assert.deepEqual(made.newRules, [{ id: 'DOCS', count: 3 }])
  assert.deepEqual(
    withWorkspace('/repo', () => githubAnnotations(made)),
    [
      '::warning title=code-atlas%3A DOCS is not in the baseline::3 violations, not checked until the baseline is recorded again (--update-baseline)',
    ],
  )
  assert.match(
    summaryMarkdown(made),
    /### Not in the baseline\n\n- \*\*DOCS\*\* Rule DOCS: 3 — not checked/,
  )
  assert.deepEqual(reportOf(true).newRules, [])
})

test('the job summary tables the families and lists the regressions with their cases', () => {
  const text = summaryMarkdown(report())
  assert.match(text, /^## code-atlas: 60 — ✗ 1 regression\n/)
  assert.match(text, /\| architecture \| 60 \| 2 \/ 3 \|/)
  assert.match(text, /\| @acme\/web \(`apps\/web`\) \| 60 \|/)
  assert.match(
    text,
    /- \*\*UP\*\* Rule UP: 2 \(baseline 1\)\n {2}- `src\/a\.ts:3` — src\/a → src\/b \(up\)/,
  )
  assert.match(summaryMarkdown({ ...report(), recording: true }), /baseline recorded/)
})

test('SARIF lists every violation of the rules that ran, without a region when no line', () => {
  const sarif = withWorkspace('/repo', () => sarifReport(report(), '1.2.3'))
  const run = sarif.runs[0]
  assert.ok(run)
  assert.equal(run.tool.driver.version, '1.2.3')
  assert.deepEqual(
    run.tool.driver.rules.map((item) => [item.id, item.defaultConfiguration.level]),
    [
      ['UP', 'error'],
      ['LOW', 'note'],
      ['OK', 'error'],
    ],
  )
  assert.equal(run.results.length, 3)
  const [first, second, third] = run.results
  assert.equal(first?.locations?.[0]?.physicalLocation.artifactLocation.uri, 'apps/web/src/a.ts')
  assert.deepEqual(first?.locations?.[0]?.physicalLocation.region, { startLine: 3 })
  assert.equal('region' in (second?.locations?.[0]?.physicalLocation ?? {}), false)
  assert.equal(third?.locations, undefined)
  assert.equal(run.originalUriBaseIds.SRCROOT.uri, `file://${path.resolve('/repo')}/`)
})
