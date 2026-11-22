import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
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

const writeJson = (path: string, value: unknown, flag = 'w') => {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { flag })
}

const runPath = (stateDir: string, rule: RuleConfig) => join(stateDir, 'runs', `${rule.id}.json`)

export const readRun = (stateDir: string, rule: RuleConfig): RuleResult | null => {
  const stored = readJson(runPath(stateDir, rule)) as {
    hash?: string
    result?: RuleResult & { costUsd?: unknown }
  } | null
  if (stored?.hash !== ruleHash(rule) || !stored.result) return null
  // Runs recorded before 0.6 carry the cost Claude estimated at API prices; it is no longer shown.
  const result = { ...stored.result }
  delete result.costUsd
  return result
}

export const writeRun = (stateDir: string, rule: RuleConfig, result: RuleResult) =>
  writeJson(runPath(stateDir, rule), { hash: ruleHash(rule), result })

const baselinePath = (stateDir: string) => join(stateDir, 'baseline.json')

export const readBaseline = (stateDir: string): Baseline | null =>
  readJson(baselinePath(stateDir)) as Baseline | null

export const writeBaseline = (stateDir: string, baseline: Baseline) =>
  writeJson(baselinePath(stateDir), baseline)

/**
 * Writes the baseline only where there is none, and says whether it did. A file already there is
 * never replaced, even one that does not parse: it may be a committed baseline mid-merge.
 */
export const createBaseline = (stateDir: string, baseline: Baseline): boolean => {
  const path = baselinePath(stateDir)
  if (existsSync(path)) return false
  writeJson(path, baseline, 'wx')
  return true
}
