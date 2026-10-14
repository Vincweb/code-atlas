import { useEffect, useState } from 'react'
import { isActive } from '../../shared/runs'
import type { RuleRun } from '../../shared/runs'
import { useInvalidateAnalysis, useRunActions, useRuns } from './queries'

export type RunState = {
  /** Waiting or running: the card offers to cancel it. */
  running: boolean
  /** Waiting for the run before it to end. */
  queued: boolean
  cancelled: boolean
  lines: string[]
  error: string | null
}

/** Whether a run has anything to show: it is waiting or running, printed something, or ended early. */
export const hasOutput = (state: RunState | undefined): state is RunState =>
  !!state && (state.running || state.cancelled || state.lines.length > 0 || state.error !== null)

const stateOf = (run: RuleRun): RunState => ({
  running: isActive(run),
  queued: run.status === 'queued',
  cancelled: run.status === 'cancelled',
  lines: run.lines,
  error: run.error,
})

/**
 * The runs of the project as the page shows them. The server drives them: leaving the tab, or
 * the page, leaves them running, and coming back shows where they are.
 */
export const useRunner = (root: string) => {
  const runs = useRuns(root).data?.runs ?? []
  const { start, cancel } = useRunActions(root)
  const [refused, setRefused] = useState<Record<string, string>>({})
  const states: Record<string, RunState> = Object.fromEntries(
    runs.map((run) => [run.rule, stateOf(run)]),
  )
  for (const [rule, error] of Object.entries(refused))
    states[rule] ??= { running: false, queued: false, cancelled: false, lines: [], error }
  const queue = runs.filter(isActive).map((run) => run.rule)

  const startAll = (ids: string[]) => {
    setRefused({})
    start.mutate(ids, {
      onError: (error) => setRefused(Object.fromEntries(ids.map((id) => [id, error.message]))),
    })
  }

  return {
    states,
    queue,
    runOne: (id: string) => startAll([id]),
    runAll: startAll,
    cancel: (id: string) => cancel.mutate(id),
    cancelAll: () => cancel.mutate(null),
    busy: queue.length > 0,
  }
}

export type Runner = ReturnType<typeof useRunner>

/** Each project's run ends the page has seen, to tell a new end from a known one. */
const seen = new Map<string, Set<string>>()

const endsOf = (runs: RuleRun[]) =>
  new Set(runs.flatMap((run) => (run.endedAt ? [`${run.rule}@${run.endedAt}`] : [])))

/**
 * Re-reads the analysis when a run ends, whichever tab is open: mounted once per project page.
 * The first look only takes note, since the analysis just read already holds what had ended.
 */
export const useRunsWatcher = (root: string) => {
  const runs = useRuns(root).data?.runs
  const invalidate = useInvalidateAnalysis(root)
  useEffect(() => {
    if (!runs) return
    const ends = endsOf(runs)
    const before = seen.get(root)
    seen.set(root, ends)
    if (before && [...ends].some((end) => !before.has(end))) void invalidate()
  }, [runs, root, invalidate])
}
