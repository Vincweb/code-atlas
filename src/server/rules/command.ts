import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { isAbsolute, join, relative } from 'node:path'
import type { CommandRuleConfig } from '../../shared/config'
import type { RuleResult, RunEvent, Violation } from '../../shared/types'
import { finishRun, killTree } from './result'

const ANSI = new RegExp(String.raw`\u001b\[[0-9;?]*[ -/]*[@-~]|\u001b\][^\u0007]*\u0007`, 'g')
const LOCATION = /(?:^|\s)((?:\/|\.{0,2}\/)?[\w@.\-/]+\.[a-z]{1,4})[:(](\d+)/i
const KEEP_LINES = 400

export const parseCommandOutput = (root: string, lines: string[]): Violation[] => {
  const seen = new Set<string>()
  const violations: Violation[] = []
  for (const line of lines) {
    const match = LOCATION.exec(line)
    if (!match) continue
    let file = match[1] ?? ''
    if (isAbsolute(file)) {
      const rel = relative(root, file)
      if (rel.startsWith('..')) continue
      file = rel
    }
    file = file.replace(/^\.\//, '')
    const key = `${file}:${match[2]}`
    if (seen.has(key) || !existsSync(join(root, file))) continue
    seen.add(key)
    violations.push({ file, line: Number(match[2]), message: line.trim().slice(0, 300) })
  }
  return violations
}

export const runCommand = (
  root: string,
  rule: CommandRuleConfig,
  opts: { commit: string | null; onEvent: (e: RunEvent) => void; signal?: AbortSignal },
): Promise<RuleResult> =>
  new Promise((resolve) => {
    const child = spawn(rule.run, {
      cwd: root,
      shell: true,
      detached: process.platform !== 'win32',
      env: { ...process.env, FORCE_COLOR: '0', CI: '1' },
    })
    const lines: string[] = []
    let pending: string[] = []
    const partial = { out: '', err: '' }
    let failure: string | null = null
    let settled = false

    const flush = () => {
      const last = pending[pending.length - 1]
      pending = []
      if (last) opts.onEvent({ type: 'progress', message: last.slice(0, 300) })
    }
    const timer = setInterval(flush, 100)
    const take = (source: 'out' | 'err', chunk: Buffer) => {
      const parts = (partial[source] + chunk.toString('utf8').replace(ANSI, '')).split(/\r?\n/)
      partial[source] = parts.pop() ?? ''
      for (const line of parts) {
        lines.push(line)
        if (line.trim()) pending.push(line.trim())
      }
      if (lines.length > KEEP_LINES * 2) lines.splice(0, lines.length - KEEP_LINES)
    }
    const stop = (reason: string) => {
      failure ??= reason
      killTree(child.pid, () => child.kill('SIGKILL'))
    }
    const timeout = setTimeout(() => stop('timeout'), (rule.timeoutSec ?? 600) * 1000)
    const onAbort = () => stop('cancelled')
    if (opts.signal?.aborted) onAbort()
    else opts.signal?.addEventListener('abort', onAbort, { once: true })

    const finish = (code: number | null, spawnError: string | null) => {
      if (settled) return
      settled = true
      clearInterval(timer)
      clearTimeout(timeout)
      opts.signal?.removeEventListener('abort', onAbort)
      for (const rest of [partial.out, partial.err]) if (rest) lines.push(rest)
      flush()
      const tail = lines.slice(-KEEP_LINES)
      const error = failure ?? spawnError
      if (error || code === 0) return resolve(finishRun(rule, opts.commit, { error }))
      const parsed = parseCommandOutput(root, tail)
      const violations = parsed.length
        ? parsed
        : [{ file: null, line: null, message: tail.slice(-20).join('\n').trim() }]
      resolve(finishRun(rule, opts.commit, { violations, ok: false }))
    }

    child.stdout?.on('data', (chunk: Buffer) => take('out', chunk))
    child.stderr?.on('data', (chunk: Buffer) => take('err', chunk))
    child.on('error', (error) => finish(null, error.message))
    child.on('close', (code) => finish(code, null))
  })
