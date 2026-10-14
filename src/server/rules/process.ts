import type { ChildProcess } from 'node:child_process'

export const spawnEnv = (drop: (key: string) => boolean): NodeJS.ProcessEnv =>
  Object.fromEntries(Object.entries(process.env).filter(([key]) => !drop(key)))

/** Kills a process and everything it started: a shell's children outlive a kill of the shell. */
export const killTree = (pid: number | undefined, fallback: () => void) => {
  if (pid !== undefined && process.platform !== 'win32') {
    try {
      process.kill(-pid, 'SIGKILL')
      return
    } catch {
      // the group is already gone
    }
  }
  fallback()
}

export type ProcessEnd = {
  code: number | null
  /** Why code-atlas stopped it: "cancelled" or "timeout". */
  failure: string | null
  /** Why it could not start or run. */
  spawnError: NodeJS.ErrnoException | null
}

/**
 * Follows a rule's process to its end: its output line by line as it comes, from stdout and
 * stderr, a kill of the whole tree on abort or past the timeout, and a single end however it
 * comes — exit, spawn error or kill. Spawned `detached` so the tree has a group of its own.
 */
export const followProcess = (
  child: ChildProcess,
  opts: {
    onLine: (line: string, source: 'out' | 'err') => void
    signal?: AbortSignal | undefined
    timeoutMs?: number
  },
): Promise<ProcessEnd> =>
  new Promise((resolve) => {
    const partial = { out: '', err: '' }
    let failure: string | null = null
    let settled = false

    const take = (source: 'out' | 'err', chunk: Buffer) => {
      const lines = (partial[source] + chunk.toString('utf8')).split(/\r?\n/)
      partial[source] = lines.pop() ?? ''
      for (const line of lines) opts.onLine(line, source)
    }
    const stop = (reason: string) => {
      failure ??= reason
      killTree(child.pid, () => child.kill('SIGKILL'))
    }
    const timeout =
      opts.timeoutMs === undefined ? null : setTimeout(() => stop('timeout'), opts.timeoutMs)
    const onAbort = () => stop('cancelled')
    if (opts.signal?.aborted) onAbort()
    else opts.signal?.addEventListener('abort', onAbort, { once: true })

    const finish = (code: number | null, spawnError: NodeJS.ErrnoException | null) => {
      if (settled) return
      settled = true
      if (timeout) clearTimeout(timeout)
      opts.signal?.removeEventListener('abort', onAbort)
      for (const source of ['out', 'err'] as const)
        if (partial[source]) opts.onLine(partial[source], source)
      resolve({ code, failure, spawnError })
    }

    child.stdout?.on('data', (chunk: Buffer) => take('out', chunk))
    child.stderr?.on('data', (chunk: Buffer) => take('err', chunk))
    child.on('error', (error: NodeJS.ErrnoException) => finish(null, error))
    child.on('close', (code) => finish(code, null))
  })
