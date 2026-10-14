import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import type { HistoryEntry, RuleResult, Scores } from '../src/shared/types'
import { historyOf } from '../src/shared/scope'
import {
  MAX_HISTORY,
  historyEntry,
  historyPath,
  readHistory,
  recordHistory,
} from '../src/server/rules/history'

const scores: Scores = {
  overall: 80,
  families: [
    { family: 'architecture', score: 70, rules: 1, failing: 1, pending: 0, beta: false },
    { family: 'tooling', score: null, rules: 1, failing: 0, pending: 1, beta: false },
  ],
}

const rule = (id: string, status: RuleResult['status'], count: number): RuleResult => ({
  id,
  family: 'architecture',
  severity: 'high',
  kind: 'layers',
  title: id,
  status,
  count,
  score: null,
  violations: [],
  ranAt: null,
  commit: null,
  stale: false,
  error: null,
})

const entry = (commit: string | null, overall = 80): HistoryEntry => ({
  ...historyEntry({ ...scores, overall }, [rule('A', 'fail', 3), rule('B', 'not-run', 0)], [], {
    commit,
    dirty: false,
  }),
})

const state = () => mkdtempSync(join(tmpdir(), 'atlas-history-'))

test('an entry keeps the scores, the counts of the rules that ran, and the packages', () => {
  const made = historyEntry(
    scores,
    [rule('A', 'fail', 3), rule('B', 'not-run', 0)],
    [{ dir: 'apps/web', scores: { overall: 55, families: [] } }],
    { commit: 'abc', dirty: true },
  )
  assert.equal(made.overall, 80)
  assert.deepEqual(made.families, { architecture: 70, tooling: null })
  assert.deepEqual(made.violations, { A: 3 })
  assert.deepEqual(made.packages, { 'apps/web': 55 })
  assert.equal(made.dirty, true)
  assert.equal(historyEntry(scores, [], [], { commit: null, dirty: false }).packages, undefined)
})

test('one point per commit: the same commit replaces the last entry, a new one appends', () => {
  const dir = state()
  assert.deepEqual(readHistory(dir), [])
  recordHistory(dir, entry('one', 70))
  recordHistory(dir, entry('one', 72))
  const two = recordHistory(dir, entry('two', 75))
  assert.deepEqual(
    two.map((item) => [item.commit, item.overall]),
    [
      ['one', 72],
      ['two', 75],
    ],
  )
  assert.deepEqual(readHistory(dir), two)
  assert.ok(historyPath(dir).endsWith(join('runs', 'history.jsonl')))
  // Written as JSON lines, one per entry.
  assert.equal(readFileSync(historyPath(dir), 'utf8').trim().split('\n').length, 2)
})

test('a line that is not an entry is skipped, and the file is capped', () => {
  const dir = state()
  mkdirSync(join(dir, 'runs'), { recursive: true })
  writeFileSync(historyPath(dir), `not json\n{"other":1}\n${JSON.stringify(entry('x'))}\n`)
  assert.equal(readHistory(dir).length, 1)
  for (let index = 0; index < MAX_HISTORY + 5; index++) recordHistory(dir, entry(`c${index}`))
  const kept = readHistory(dir)
  assert.equal(kept.length, MAX_HISTORY)
  assert.equal(kept[kept.length - 1]?.commit, `c${MAX_HISTORY + 4}`)
})

test('a package reads the history through its own score', () => {
  const history: HistoryEntry[] = [
    { ...entry('one'), packages: { 'apps/web': 40 } },
    { ...entry('two'), packages: { 'packages/math': 90 } },
  ]
  assert.deepEqual(
    historyOf(history, 'apps/web').map((item) => item.overall),
    [40, null],
  )
})
