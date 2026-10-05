import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import type { StrixScan } from '../src/shared/types'
import { securityPayload } from '../src/server/security'
import {
  projectRelative,
  readRunSummaries,
  readStrixRun,
  strixRunsDir,
} from '../src/server/strixReport'
import {
  copyProject,
  createScans,
  parseScanRequest,
  ScanError,
  strixArgs,
} from '../src/server/strixScan'
import { ciFileOf, scanStepsIn } from '../src/server/strixTooling'

const tempDir = (prefix: string) => fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)))

const write = (file: string, content: string) => {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
}

const project = () => {
  const root = tempDir('atlas-strix-')
  write(path.join(root, 'src/a.ts'), 'export const a = 1\n')
  write(path.join(root, 'node_modules/dep/index.js'), 'x')
  write(path.join(root, '.code-atlas/baseline.json'), '{}')
  return { root, stateDir: path.join(root, '.code-atlas') }
}

const VULNERABILITIES = (name: string) => [
  {
    id: 'vuln-0002',
    title: 'Reflected XSS',
    severity: 'medium',
    code_locations: [{ file: `${name}/src/a.ts`, start_line: 1, end_line: 1 }],
  },
  {
    id: 'vuln-0001',
    title: 'SQL injection',
    severity: 'CRITICAL',
    cwe: 'CWE-89',
    cvss: 9.8,
    endpoint: '/api/users',
    code_locations: [
      { file: '/workspace/app/src/a.ts', start_line: 1, end_line: 1, fix_after: 'safe()' },
      { file: 'src/gone.ts', start_line: 3, end_line: 3 },
      { file: 'src/a.ts', start_line: 0 },
    ],
  },
  { title: 'no id, skipped' },
]

const writeRun = (stateDir: string, name: string, root: string) => {
  const runDir = path.join(strixRunsDir(stateDir), name)
  write(
    path.join(runDir, 'run.json'),
    JSON.stringify({
      run_name: name,
      status: 'completed',
      scan_mode: 'quick',
      start_time: '2026-10-04T10:00:00Z',
      llm_usage: { cost: 0.42 },
    }),
  )
  write(
    path.join(runDir, 'vulnerabilities.json'),
    JSON.stringify(VULNERABILITIES(path.basename(root))),
  )
  write(path.join(runDir, 'penetration_test_report.md'), '# Report\n')
  return runDir
}

test('a reported path is read relative to the project, whatever the workspace prefix', () => {
  const { root } = project()
  const name = path.basename(root)
  for (const reported of [
    'src/a.ts',
    `${name}/src/a.ts`,
    `/workspace/${name}/src/a.ts`,
    './src/a.ts',
  ])
    assert.deepEqual(projectRelative(root, reported), { file: 'src/a.ts', exists: true }, reported)
  assert.deepEqual(projectRelative(root, 'src/gone.ts'), { file: 'src/gone.ts', exists: false })
  assert.equal(projectRelative(root, '../../etc/passwd').exists, false)
})

test('reads a run: findings by severity, locations in the project, the cost', () => {
  const { root, stateDir } = project()
  const runDir = writeRun(stateDir, 'app_1234', root)
  const run = readStrixRun(root, stateDir, 'app_1234')
  assert.ok(run)
  assert.equal(run.status, 'completed')
  assert.equal(run.costUsd, 0.42)
  assert.equal(run.report, '# Report\n')
  assert.deepEqual(
    run.findings.map((finding) => [finding.id, finding.severity]),
    [
      ['vuln-0001', 'critical'],
      ['vuln-0002', 'medium'],
    ],
  )
  const [sqli] = run.findings
  assert.equal(sqli?.reportPath, path.join(runDir, 'vulnerabilities', 'vuln-0001.md'))
  assert.deepEqual(
    sqli?.locations.map((location) => [location.file, location.line, location.exists]),
    [
      ['src/a.ts', 1, true],
      ['src/gone.ts', 3, false],
    ],
  )
  assert.equal(sqli?.locations[0]?.fixAfter, 'safe()')
  assert.deepEqual(readRunSummaries(root, stateDir)[0]?.bySeverity, {
    critical: 1,
    high: 0,
    medium: 1,
    low: 0,
    info: 0,
  })
  assert.equal(readStrixRun(root, stateDir, '../escape'), null)
  assert.equal(readStrixRun(root, stateDir, 'missing'), null)
})

test('finds the Strix steps of a CI file and how they are set up', () => {
  const workflow = [
    'on:',
    '  pull_request:',
    'jobs:',
    '  scan:',
    '    steps:',
    '      - uses: actions/checkout@v4',
    '        with:',
    '          fetch-depth: 0',
    '      - run: curl -sSL https://strix.ai/install | bash',
    '      - env:',
    '          STRIX_LLM: ${{ secrets.STRIX_LLM }}',
    '          LLM_API_KEY: ${{ secrets.LLM_API_KEY }}',
    '        run: strix -n -t ./ --scan-mode quick --fail-on high --max-budget-usd 5',
  ].join('\n')
  const ci = ciFileOf('.github/workflows/security.yml', 'github', workflow)
  assert.deepEqual(ci, {
    file: '.github/workflows/security.yml',
    provider: 'github',
    steps: [
      {
        file: '.github/workflows/security.yml',
        line: 13,
        headless: true,
        mode: 'quick',
        failOn: 'high',
        budget: '5',
      },
    ],
    cloud: false,
    secrets: true,
    pullRequests: true,
    fullHistory: true,
  })
  assert.deepEqual(
    scanStepsIn('x', 'strix view my-run\ncurl -sSL https://strix.ai/install | bash'),
    [],
  )
  assert.equal(scanStepsIn('x', '  script: strix --target ./app')[0]?.headless, false)
  assert.equal(ciFileOf('ci.yml', 'gitlab', 'script: npm test'), null)
})

test('the payload reports the tooling around the project', () => {
  const { root, stateDir } = project()
  write(path.join(root, '.github/workflows/sec.yaml'), 'run: strix -n -t . -m standard\n')
  write(path.join(root, '.claude/skills/penetration-testing-with-strix/SKILL.md'), '---\n')
  write(path.join(root, '.agents/skills/unrelated/SKILL.md'), 'nothing to see\n')
  const payload = securityPayload(root, stateDir, null, null)
  assert.deepEqual(
    payload.integration.ci.map((ci) => [ci.file, ci.steps[0]?.mode]),
    [['.github/workflows/sec.yaml', 'standard']],
  )
  assert.deepEqual(
    payload.integration.skills.filter((skill) => skill.scope === 'project').map((s) => s.name),
    ['penetration-testing-with-strix'],
  )
  assert.equal(payload.integration.reportsIgnored, null)
  assert.equal(payload.run, null)
})

test('a run left running by a killed Strix reads as interrupted, unless it is the live one', () => {
  const { root, stateDir } = project()
  write(path.join(strixRunsDir(stateDir), 'app_1', 'run.json'), '{"status":"running"}')
  const orphan = securityPayload(root, stateDir, null, null)
  assert.equal(orphan.run?.status, 'interrupted')
  assert.equal(orphan.runs[0]?.status, 'interrupted')
  const live = { running: true, run: 'app_1' } as StrixScan
  assert.equal(securityPayload(root, stateDir, live, null).run?.status, 'running')
  const starting = { running: true, run: null } as StrixScan
  assert.equal(securityPayload(root, stateDir, starting, null).run?.status, 'running')
  const other = { running: true, run: 'app_2' } as StrixScan
  assert.equal(securityPayload(root, stateDir, other, null).run?.status, 'interrupted')
})

test('a scan request is checked before anything runs', () => {
  assert.deepEqual(parseScanRequest({ mode: 'quick', budgetUsd: 5, instruction: ' Focus ' }), {
    mode: 'quick',
    budgetUsd: 5,
    instruction: 'Focus',
  })
  for (const body of [
    {},
    { mode: 'turbo', budgetUsd: 5 },
    { mode: 'quick', budgetUsd: 0 },
    { mode: 'quick', budgetUsd: 1000 },
    { mode: 'quick', budgetUsd: '5' },
    { mode: 'quick', budgetUsd: 5, instruction: 'x'.repeat(4001) },
  ])
    assert.throws(() => parseScanRequest(body), ScanError, JSON.stringify(body).slice(0, 60))
  assert.deepEqual(strixArgs('/tmp/copy', { mode: 'deep', budgetUsd: 2.5, instruction: '' }), [
    '-n',
    '-t',
    '/tmp/copy',
    '--scan-mode',
    'deep',
    '--scope-mode',
    'full',
    '--max-budget-usd',
    '2.5',
  ])
})

test('the copy holds what git would track, never state, dependencies or links', () => {
  const { root, stateDir } = project()
  const outside = tempDir('atlas-outside-')
  write(path.join(outside, 'secret.txt'), 'secret')
  fs.symlinkSync(outside, path.join(root, 'src/link'))
  write(path.join(root, '.gitignore'), 'node_modules\n.env\n')
  write(path.join(root, '.env'), 'TOKEN=1')
  write(path.join(root, 'untracked.ts'), 'x')
  execFileSync('git', ['init', '-q'], { cwd: root })
  const copy = copyProject(root, stateDir)
  try {
    const name = path.basename(root)
    assert.equal(copy.target, path.join(copy.temp, name))
    assert.ok(fs.existsSync(path.join(copy.target, 'src/a.ts')))
    assert.ok(fs.existsSync(path.join(copy.target, 'untracked.ts')))
    assert.ok(fs.existsSync(path.join(copy.target, '.gitignore')))
    for (const left of ['.env', 'node_modules', '.code-atlas', 'src/link'])
      assert.equal(fs.existsSync(path.join(copy.target, left)), false, left)
  } finally {
    fs.rmSync(copy.temp, { recursive: true, force: true })
  }
})

const fakeStrix = (body: string) => {
  const dir = tempDir('atlas-bin-')
  const bin = path.join(dir, 'strix')
  fs.writeFileSync(bin, `#!/bin/sh\n${body}\n`, { mode: 0o755 })
  return bin
}

const settled = async (get: () => StrixScan | null) => {
  for (let i = 0; i < 200; i++) {
    const scan = get()
    if (scan && !scan.running) return scan
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  throw new Error('the scan did not settle')
}

const REQUEST = { mode: 'quick', budgetUsd: 1, instruction: '' } as const

test('a scan runs Strix on the copy, picks up its run and cleans the copy', async () => {
  const { root, stateDir } = project()
  const bin = fakeStrix(
    [
      'target="$3"',
      'test -f "$target/src/a.ts" || exit 1',
      'test -e "$target/.code-atlas" && exit 1',
      'echo "╭── STRIX ──╮"',
      'echo "│ $STRIX_TELEMETRY │"',
      'mkdir -p strix_runs/app_1',
      `echo '{"status":"completed","llm_usage":{"cost":0.3}}' > strix_runs/app_1/run.json`,
      `echo '[{"id":"vuln-0001","title":"t","severity":"high"}]' > strix_runs/app_1/vulnerabilities.json`,
      'echo "$target" > strix_runs/target.txt',
      'exit 2',
    ].join('\n'),
  )
  const scans = createScans({ strixBin: bin })
  const started = scans.start(root, stateDir, REQUEST)
  assert.equal(started.running, true)
  assert.throws(() => scans.start(root, stateDir, REQUEST), /already running/)
  const scan = await settled(() => scans.get(root))
  assert.equal(scan.phase, 'done')
  assert.equal(scan.exitCode, 2)
  assert.equal(scan.run, 'app_1')
  assert.equal(scan.findings, 1)
  assert.equal(scan.costUsd, 0.3)
  assert.deepEqual(scan.log, ['STRIX', '0'])
  const target = fs.readFileSync(path.join(strixRunsDir(stateDir), 'target.txt'), 'utf8').trim()
  assert.equal(fs.existsSync(target), false)
})

test('a failing, missing or stopped Strix is reported as such', async () => {
  const { root, stateDir } = project()
  const failing = createScans({
    strixBin: fakeStrix('echo "Error: STRIX_LLM is not set" >&2\nexit 1'),
  })
  failing.start(root, stateDir, REQUEST)
  const failed = await settled(() => failing.get(root))
  assert.equal(failed.phase, 'failed')
  assert.match(failed.error ?? '', /STRIX_LLM is not set/)

  const missing = createScans({ strixBin: path.join(root, 'no-such-strix') })
  missing.start(root, stateDir, REQUEST)
  assert.equal((await settled(() => missing.get(root))).error, 'strix-not-found')

  const slow = createScans({ strixBin: fakeStrix('sleep 30') })
  slow.start(root, stateDir, REQUEST)
  assert.equal(slow.cancel(root), true)
  const stopped = await settled(() => slow.get(root))
  assert.equal(stopped.phase, 'cancelled')
  assert.equal(slow.cancel(root), false)
})
