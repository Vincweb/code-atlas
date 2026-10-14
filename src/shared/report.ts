import type { RuleResult, Scores } from './types'

/** One recorded analysis: the scores of a commit, kept under `.code-atlas/runs/history.jsonl`. */
export type HistoryEntry = {
  at: string
  commit: string | null
  dirty: boolean
  overall: number | null
  families: Record<string, number | null>
  violations: Record<string, number>
  /** In a monorepo, each package's overall score. */
  packages?: Record<string, number | null>
}

export type Regression = { id: string; package?: string; before: number; after: number }

/** A rule the baseline never counted: reported, not checked, until the baseline is recorded again. */
export type NewRule = { id: string; count: number }

/** What `--check` found, as `--format json` prints it and the `check` MCP tool returns it. */
export type CheckReport = {
  ok: boolean
  /** The run recorded the baseline instead of comparing with it. */
  recording: boolean
  root: string
  commit: string | null
  dirty: boolean
  at: string
  scores: Scores
  rules: RuleResult[]
  packages: { dir: string; name: string; scores: Scores }[]
  regressions: Regression[]
  newRules: NewRule[]
  baseline: { commit: string | null; savedAt: string } | null
}
