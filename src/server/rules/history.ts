import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { HistoryEntry, RuleResult, Scores } from '../../shared/types'
import type { PackageScores } from './index'

/** Under `runs/`, the folder the README says to ignore: a history is per machine, like a run. */
const HISTORY_FILE = join('runs', 'history.jsonl')

export const MAX_HISTORY = 500

type Git = { commit: string | null; dirty: boolean }

export const historyPath = (stateDir: string) => join(stateDir, HISTORY_FILE)

const isEntry = (value: unknown): value is HistoryEntry =>
  typeof value === 'object' &&
  value !== null &&
  'at' in value &&
  typeof value.at === 'string' &&
  'violations' in value &&
  typeof value.violations === 'object'

/** The recorded analyses, oldest first; a line that is not one is skipped. */
export const readHistory = (stateDir: string): HistoryEntry[] => {
  let text: string
  try {
    text = readFileSync(historyPath(stateDir), 'utf8')
  } catch {
    return []
  }
  return text.split('\n').flatMap((line) => {
    if (!line.trim()) return []
    try {
      const parsed: unknown = JSON.parse(line)
      return isEntry(parsed) ? [parsed] : []
    } catch {
      return []
    }
  })
}

export const historyEntry = (
  scores: Scores,
  rules: RuleResult[],
  packages: PackageScores[],
  git: Git,
): HistoryEntry => ({
  at: new Date().toISOString(),
  commit: git.commit,
  dirty: git.dirty,
  overall: scores.overall,
  families: Object.fromEntries(scores.families.map((family) => [family.family, family.score])),
  violations: Object.fromEntries(
    rules
      .filter((rule) => rule.status === 'pass' || rule.status === 'fail')
      .map((rule) => [rule.id, rule.count]),
  ),
  ...(packages.length
    ? { packages: Object.fromEntries(packages.map(({ dir, scores: own }) => [dir, own.overall])) }
    : {}),
})

/**
 * Records an analysis: one entry per commit, the latest state of it, so a day of re-analyses on
 * one commit is one point. Returns the history with the entry in, oldest first.
 */
export const recordHistory = (stateDir: string, entry: HistoryEntry): HistoryEntry[] => {
  const file = historyPath(stateDir)
  const previous = readHistory(stateDir)
  const last = previous[previous.length - 1]
  const line = `${JSON.stringify(entry)}\n`
  mkdirSync(dirname(file), { recursive: true })
  if (last && last.commit === entry.commit) {
    const kept = [...previous.slice(0, -1), entry].slice(-MAX_HISTORY)
    writeFileSync(file, kept.map((item) => JSON.stringify(item)).join('\n') + '\n')
    return kept
  }
  if (previous.length >= MAX_HISTORY) {
    const kept = [...previous, entry].slice(-MAX_HISTORY)
    writeFileSync(file, kept.map((item) => JSON.stringify(item)).join('\n') + '\n')
    return kept
  }
  appendFileSync(file, line)
  return [...previous, entry]
}
