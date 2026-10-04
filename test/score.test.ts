import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Severity } from '../src/shared/config'
import type { RuleResult, RuleStatus } from '../src/shared/types'
import { computeScores } from '../src/server/rules/score'
import { ruleScore } from '../src/shared/score'

const rule = (
  family: string,
  severity: Severity,
  status: RuleStatus,
  count: number,
): RuleResult => ({
  id: `${family}-${severity}-${count}`,
  family,
  severity,
  kind: 'max-lines',
  title: '',
  status,
  count,
  violations: [],
  ranAt: null,
  commit: null,
  stale: false,
  costUsd: null,
  error: null,
})

test('ruleScore halves at the half-life', () => {
  assert.equal(ruleScore('high', 0), 100)
  assert.equal(ruleScore('critical', 1), 50)
  assert.equal(ruleScore('high', 3), 50)
  assert.equal(ruleScore('medium', 6), 50)
  assert.equal(ruleScore('low', 12), 50)
  assert.ok(ruleScore('low', 1000) >= 0)
})

test('families are weighted and ordered', () => {
  const scores = computeScores([
    rule('zeta', 'low', 'pass', 0),
    rule('clean-code', 'critical', 'fail', 1),
    rule('clean-code', 'low', 'pass', 0),
    rule('architecture', 'high', 'pass', 0),
    rule('alpha', 'low', 'pass', 0),
  ])
  assert.deepEqual(
    scores.families.map((family) => family.family),
    ['architecture', 'clean-code', 'alpha', 'zeta'],
  )
  const clean = scores.families[1]
  assert.equal(clean?.score, Math.round((8 * 50 + 1 * 100) / 9))
  assert.equal(clean?.failing, 1)
  assert.equal(scores.overall, Math.round((100 + 56 + 100 + 100) / 4))
})

test('pending rules do not score', () => {
  const scores = computeScores([rule('ai', 'medium', 'not-run', 0), rule('ai', 'low', 'error', 0)])
  assert.deepEqual(scores.families, [
    { family: 'ai', score: null, rules: 2, failing: 0, pending: 2 },
  ])
  assert.equal(scores.overall, null)
  assert.equal(computeScores([]).overall, null)
})
