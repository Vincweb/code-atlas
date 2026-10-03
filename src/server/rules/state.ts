import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { RuleConfig } from '../../shared/config'
import type { Baseline, RuleResult } from '../../shared/types'

const sortKeys = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (typeof value === 'object' && value !== null)
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, entry]) => [key, sortKeys(entry)]),
    )
  return value
}

export const ruleHash = (rule: RuleConfig) =>
  createHash('sha1')
    .update(JSON.stringify(sortKeys(rule)))
    .digest('hex')
    .slice(0, 12)

const readJson = (path: string): unknown => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

const writeJson = (path: string, value: unknown) => {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

const runPath = (stateDir: string, rule: RuleConfig) => join(stateDir, 'runs', `${rule.id}.json`)

export const readRun = (stateDir: string, rule: RuleConfig): RuleResult | null => {
  const stored = readJson(runPath(stateDir, rule)) as { hash?: string; result?: RuleResult } | null
  return stored?.hash === ruleHash(rule) && stored.result ? stored.result : null
}

export const writeRun = (stateDir: string, rule: RuleConfig, result: RuleResult) =>
  writeJson(runPath(stateDir, rule), { hash: ruleHash(rule), result })

export const readBaseline = (stateDir: string): Baseline | null =>
  readJson(join(stateDir, 'baseline.json')) as Baseline | null

export const writeBaseline = (stateDir: string, baseline: Baseline) =>
  writeJson(join(stateDir, 'baseline.json'), baseline)
