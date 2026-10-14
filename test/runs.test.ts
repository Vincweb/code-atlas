import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import type { CommandRuleConfig, ResolvedConfig } from '../src/shared/config'
import type { RuleResult } from '../src/shared/types'
import { runRule } from '../src/server/rules'
import { readRun, writeRun } from '../src/server/rules/state'
import { createRuns, RunError } from '../src/server/runs'

const command = (id: string, run = 'true'): CommandRuleConfig => ({
  id,
  family: 'tooling',
  severity: 'high',
  kind: 'command',
  run,
})

const config: ResolvedConfig = {
  include: [],
  exclude: [],
  tsconfig: 'tsconfig.json',
  workspaces: [],
  features: [],
  docs: [],
  layers: [],
  allow: [],
  rules: [
    command('A'),
    command('B'),
    command('C'),
    { id: 'LINES', family: 'f', severity: 'low', kind: 'max-lines', max: 1 },
  ],
  ai: { model: 'sonnet', language: 'English' },
  database: { config: null, features: null, layers: [], allow: [], junctions: [] },
}

const resultOf = (id: string, status: RuleResult['status'] = 'pass'): RuleResult => ({
  id,
  family: 'tooling',
  severity: 'high',
  kind: 'command',
  title: id,
  status,
  count: 0,
  score: 100,
  violations: [],
  ranAt: null,
  commit: null,
  stale: false,
  error: status === 'error' ? 'cancelled' : null,
})

/** A run function the test ends by hand: each call waits until `finish(id)`, or its abort. */
const fakeRuns = () => {
  const started: string[] = []
  const finishers = new Map<string, () => void>()
  const run: typeof runRule = (opts) =>
    new Promise((resolve) => {
      started.push(opts.rule.id)
      opts.onEvent({ type: 'progress', message: `${opts.rule.id} works` })
      finishers.set(opts.rule.id, () => resolve(resultOf(opts.rule.id)))
      opts.signal?.addEventListener('abort', () => resolve(resultOf(opts.rule.id, 'error')))
    })
  const finish = (id: string) => finishers.get(id)?.()
  return { started, finish, run }
}

const tick = () => new Promise((resolve) => setImmediate(resolve))

const statusOf = (runs: ReturnType<typeof createRuns>, id: string) =>
  runs.list('/proj').find((run) => run.rule === id)?.status

const project = { config, stateDir: '/state' }

test('runs wait their turn, one at a time per project, and keep their output once done', async () => {
  const fake = fakeRuns()
  const runs = createRuns({ run: fake.run })
  runs.start('/proj', project, ['A', 'B'])
  await tick()
  assert.deepEqual(fake.started, ['A'])
  assert.equal(statusOf(runs, 'B'), 'queued')

  runs.start('/proj', project, ['A'])
  assert.equal(statusOf(runs, 'A'), 'running', 'starting a running rule again changes nothing')

  fake.finish('A')
  await tick()
  assert.equal(statusOf(runs, 'A'), 'done')
  assert.deepEqual(fake.started, ['A', 'B'])
  fake.finish('B')
  await tick()
  const done = runs.list('/proj').find((run) => run.rule === 'B')
  assert.equal(done?.status, 'done')
  assert.deepEqual(done?.lines, ['B works'])
  assert.ok(done?.endedAt)
})

test('cancelling a waiting rule skips it; cancelling the running one aborts it and goes on', async () => {
  const fake = fakeRuns()
  const runs = createRuns({ run: fake.run })
  runs.start('/proj', project, ['A', 'B', 'C'])
  await tick()
  runs.cancel('/proj', 'B')
  assert.equal(statusOf(runs, 'B'), 'cancelled')

  runs.cancel('/proj', 'A')
  await tick()
  assert.equal(statusOf(runs, 'A'), 'cancelled', 'the aborted run is not reported as failed')
  assert.deepEqual(fake.started, ['A', 'C'])
  fake.finish('C')
  await tick()
  assert.equal(statusOf(runs, 'C'), 'done')
})

test('stopping the server cancels every project’s runs', async () => {
  const fake = fakeRuns()
  const runs = createRuns({ run: fake.run })
  runs.start('/proj', project, ['A', 'B'])
  await tick()
  runs.stopAll()
  await tick()
  assert.deepEqual(
    runs.list('/proj').map((run) => run.status),
    ['cancelled', 'cancelled'],
  )
  assert.deepEqual(fake.started, ['A'])
})

test('only a rule of the config that runs something can be started', () => {
  const runs = createRuns({ run: fakeRuns().run })
  assert.throws(
    () => runs.start('/proj', project, ['NOPE']),
    (error: unknown) => error instanceof RunError && error.status === 404,
  )
  assert.throws(
    () => runs.start('/proj', project, ['LINES']),
    (error: unknown) => error instanceof RunError && error.status === 400,
  )
  assert.deepEqual(runs.list('/proj'), [])
})

test('a cancelled run leaves the previous result in place', async () => {
  const stateDir = mkdtempSync(join(tmpdir(), 'atlas-runs-'))
  const rule = command('SLOW', 'node -e "setTimeout(() => {}, 5000)"')
  writeRun(stateDir, rule, resultOf('SLOW'))
  const controller = new AbortController()
  const running = runRule({
    root: tmpdir(),
    config,
    rule,
    stateDir,
    commit: 'c',
    onEvent: () => {},
    signal: controller.signal,
  })
  setTimeout(() => controller.abort(), 100)
  assert.equal((await running).status, 'error')
  assert.equal(readRun(stateDir, rule)?.status, 'pass')
})
