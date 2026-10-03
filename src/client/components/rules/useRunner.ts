import { useCallback, useEffect, useRef, useState } from 'react'
import type { RunEvent } from '../../../shared/types'
import { runUrl } from '../../api'
import { useT } from '../../i18n'

export type RunState = { running: boolean; lines: string[]; error: string | null }

const MAX_LINES = 200
const IDLE: RunState = { running: false, lines: [], error: null }

const parse = (data: string): RunEvent | null => {
  try {
    return JSON.parse(data) as RunEvent
  } catch {
    return null
  }
}

/**
 * Opens one EventSource per running rule. Closing it is what cancels: the browser would
 * otherwise reconnect on its own and start the rule again.
 */
export const useRunner = (root: string, onDone: () => void) => {
  const t = useT()
  const [states, setStates] = useState<Record<string, RunState>>({})
  const [queue, setQueue] = useState<string[]>([])
  const active = useRef(new Map<string, (error: string | null) => void>())
  const batch = useRef<{ cancelled: boolean } | null>(null)
  const onDoneRef = useRef(onDone)
  useEffect(() => {
    onDoneRef.current = onDone
  })

  const patch = useCallback((id: string, change: (state: RunState) => RunState) => {
    setStates((all) => ({ ...all, [id]: change(all[id] ?? IDLE) }))
  }, [])

  const append = useCallback(
    (id: string, line: string) =>
      patch(id, (s) => ({ ...s, lines: [...s.lines, line].slice(-MAX_LINES) })),
    [patch],
  )

  const runOne = useCallback(
    (id: string) =>
      new Promise<void>((resolve) => {
        if (active.current.has(id)) return resolve()
        const source = new EventSource(runUrl(root, id))
        const finish = (error: string | null) => {
          source.close()
          active.current.delete(id)
          patch(id, (s) => ({ ...s, running: false, error }))
          resolve()
        }
        active.current.set(id, finish)
        patch(id, () => ({ running: true, lines: [], error: null }))
        source.onmessage = (message: MessageEvent<string>) => {
          const event = parse(message.data)
          if (!event) return
          if (event.type === 'start') append(id, event.at)
          else if (event.type === 'progress') append(id, event.message)
          else if (event.type === 'done') {
            finish(null)
            onDoneRef.current()
          } else finish(event.message)
        }
        source.onerror = () => finish(t.rules.connectionLost)
      }),
    [root, patch, append, t],
  )

  const cancel = useCallback(
    (id: string) => {
      active.current.get(id)?.(null)
      append(id, t.rules.cancelled)
    },
    [append, t],
  )

  const runAll = useCallback(
    async (ids: string[]) => {
      if (batch.current) return
      const token = { cancelled: false }
      batch.current = token
      for (const [index, id] of ids.entries()) {
        if (token.cancelled) break
        setQueue(ids.slice(index))
        await runOne(id)
      }
      batch.current = null
      setQueue([])
    },
    [runOne],
  )

  const cancelAll = useCallback(() => {
    if (batch.current) batch.current.cancelled = true
    for (const finish of [...active.current.values()]) finish(null)
  }, [])

  useEffect(() => {
    const running = active.current
    return () => {
      if (batch.current) batch.current.cancelled = true
      for (const finish of [...running.values()]) finish(null)
    }
  }, [])

  return { states, queue, runOne, runAll, cancel, cancelAll, busy: queue.length > 0 }
}

export type Runner = ReturnType<typeof useRunner>
