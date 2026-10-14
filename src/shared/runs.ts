export type RunStatus = 'queued' | 'running' | 'done' | 'failed' | 'cancelled'

/** A command or AI rule run, as the server drives it whether or not a page watches it. */
export type RuleRun = {
  rule: string
  status: RunStatus
  /** What the run printed, the last lines only. */
  lines: string[]
  error: string | null
  startedAt: string | null
  endedAt: string | null
}

export type RunsPayload = { runs: RuleRun[] }

export const isActive = (run: RuleRun) => run.status === 'queued' || run.status === 'running'
