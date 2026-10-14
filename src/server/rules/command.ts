import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { isAbsolute, join, relative } from 'node:path'
import type { CommandRuleConfig } from '../../shared/config'
import type { PackageRef, RuleResult, RunEvent, Violation } from '../../shared/types'
import { followProcess } from './process'
import { finishRun } from './result'

const ANSI = new RegExp(String.raw`\u001b\[[0-9;?]*[ -/]*[@-~]|\u001b\][^\u0007]*\u0007`, 'g')
const PATH = String.raw`(?:\/|\.{0,2}\/)?[\w@.\-/]+\.[a-z]{1,4}`
const LOCATION = new RegExp(String.raw`(?:^|\s)(${PATH})[:(](\d+)`, 'i')
/** A line that names a file and nothing else, as ESLint's stylish format heads its messages. */
const FILE_HEADER = new RegExp(String.raw`^\s*(${PATH})\s*$`, 'i')
/** ESLint's stylish message under such a header: `  12:5  error  …`. */
const STYLISH = /^\s+(\d+):\d+\s+(?:error|warning)\b/
/** turbo prefixes each line with `<package>:<task>: `, pnpm -r with `<folder> <script>: `. */
const TASK_PREFIX = /^(\S+?):[\w:-]+: ?|^(\S+) [\w:-]+: /
const KEEP_LINES = 400

/** The package a monorepo task prefix names, and the line without it. */
const unprefix = (line: string, packages: PackageRef[]) => {
  const match = TASK_PREFIX.exec(line)
  const name = match?.[1] ?? match?.[2]
  const pkg =
    name && packages.find((candidate) => candidate.name === name || candidate.dir === name)
  return pkg && match
    ? { dir: pkg.dir, text: line.slice(match[0].length) }
    : { dir: null, text: line }
}

/**
 * The `file:line` places a command printed, relative to the root. In a monorepo a task's paths
 * are relative to its package, which its prefix names.
 */
export const parseCommandOutput = (
  root: string,
  lines: string[],
  packages: PackageRef[] = [],
): Violation[] => {
  const seen = new Set<string>()
  const violations: Violation[] = []
  const located = (raw: string, dir: string | null) => {
    let file = raw
    if (isAbsolute(file)) {
      const rel = relative(root, file)
      if (rel.startsWith('..')) return null
      file = rel
    }
    file = file.replace(/^\.\//, '')
    for (const candidate of dir && dir !== '.' ? [join(dir, file), file] : [file])
      if (
        existsSync(join(root, candidate)) &&
        !relative(root, join(root, candidate)).startsWith('..')
      )
        return candidate.split('\\').join('/')
    return null
  }
  const add = (file: string, line: number, message: string) => {
    const key = `${file}:${line}`
    if (seen.has(key)) return
    seen.add(key)
    violations.push({ file, line, message: message.trim().slice(0, 300) })
  }
  let header: string | null = null
  for (const raw of lines) {
    const { dir, text } = unprefix(raw, packages)
    const stylish = header ? STYLISH.exec(text) : null
    if (header && stylish) {
      add(header, Number(stylish[1]), text)
      continue
    }
    const named = FILE_HEADER.exec(text)
    header = named ? located(named[1] ?? '', dir) : null
    if (header) continue
    const match = LOCATION.exec(text)
    const file = match ? located(match[1] ?? '', dir) : null
    if (match && file) add(file, Number(match[2]), text)
  }
  return violations
}

export const runCommand = async (
  root: string,
  rule: CommandRuleConfig,
  opts: {
    commit: string | null
    onEvent: (e: RunEvent) => void
    signal?: AbortSignal
    packages?: PackageRef[]
  },
): Promise<RuleResult> => {
  const child = spawn(rule.run, {
    cwd: root,
    shell: true,
    detached: process.platform !== 'win32',
    env: { ...process.env, FORCE_COLOR: '0', CI: '1' },
  })
  const lines: string[] = []
  let pending: string[] = []
  const flush = () => {
    const last = pending[pending.length - 1]
    pending = []
    if (last) opts.onEvent({ type: 'progress', message: last.slice(0, 300) })
  }
  const timer = setInterval(flush, 100)
  const end = await followProcess(child, {
    signal: opts.signal,
    timeoutMs: (rule.timeoutSec ?? 600) * 1000,
    onLine: (raw) => {
      const line = raw.replace(ANSI, '')
      lines.push(line)
      if (line.trim()) pending.push(line.trim())
      if (lines.length > KEEP_LINES * 2) lines.splice(0, lines.length - KEEP_LINES)
    },
  })
  clearInterval(timer)
  flush()
  const tail = lines.slice(-KEEP_LINES)
  const error = end.failure ?? end.spawnError?.message ?? null
  if (error || end.code === 0) return finishRun(rule, opts.commit, { error })
  const parsed = parseCommandOutput(root, tail, opts.packages)
  const violations = parsed.length
    ? parsed
    : [{ file: null, line: null, message: tail.slice(-20).join('\n').trim() }]
  return finishRun(rule, opts.commit, { violations, ok: false })
}
