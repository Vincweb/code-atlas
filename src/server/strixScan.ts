import { execFileSync, spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { STRIX_MODES } from '../shared/types'
import type { StrixScan, StrixScanRequest } from '../shared/types'
import { listRunNames, runProgress, strixCwd } from './strixReport'

const MAX_FILES = 20_000
const MAX_BYTES = 300_000_000
const MAX_BUDGET_USD = 100
const MAX_INSTRUCTION = 4000
const KEEP_LINES = 60
const POLL_MS = 2000
const GRACE_MS = 20_000
const HOURS = 3_600_000
const TIMEOUT_MS: Record<StrixScan['mode'], number> = {
  quick: 2 * HOURS,
  standard: 6 * HOURS,
  deep: 12 * HOURS,
}
const SKIPPED = new Set(['node_modules', '.git', '.code-atlas', 'strix_runs'])
const ANSI = new RegExp(String.raw`\u001b\[[0-9;?]*[ -/]*[@-~]|\u001b\][^\u0007]*\u0007`, 'g')
const FRAME = /^[\s│┃║╭╮╰╯┏┓┗┛─━═┌┐└┘|]+|[\s│┃║╭╮╰╯┏┓┗┛─━═┌┐└┘|]+$/g

export class ScanError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message)
  }
}

export const parseScanRequest = (body: unknown): StrixScanRequest => {
  const raw = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
  const mode = STRIX_MODES.find((candidate) => candidate === raw.mode)
  if (!mode) throw new ScanError(`mode must be one of ${STRIX_MODES.join(', ')}`)
  const budgetUsd = raw.budgetUsd
  if (typeof budgetUsd !== 'number' || !(budgetUsd > 0) || budgetUsd > MAX_BUDGET_USD)
    throw new ScanError(`budgetUsd must be a number above 0 and at most ${MAX_BUDGET_USD}`)
  const instruction = typeof raw.instruction === 'string' ? raw.instruction.trim() : ''
  if (instruction.length > MAX_INSTRUCTION)
    throw new ScanError(`the instruction is limited to ${MAX_INSTRUCTION} characters`)
  return { mode, budgetUsd, instruction }
}

export const strixArgs = (target: string, request: StrixScanRequest) => [
  '-n',
  '-t',
  target,
  '--scan-mode',
  request.mode,
  // The copy has no git history, so a diff scope has nothing to compare with.
  '--scope-mode',
  'full',
  '--max-budget-usd',
  String(request.budgetUsd),
  ...(request.instruction ? ['--instruction', request.instruction] : []),
]

const isSkipped = (relative: string, extra: string | null) =>
  relative.split('/').some((segment) => SKIPPED.has(segment)) ||
  (extra !== null && (relative === extra || relative.startsWith(`${extra}/`)))

const gitFiles = (root: string) => {
  try {
    const out = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 64 * 1024 * 1024,
    })
    return out.toString('utf8').split('\0').filter(Boolean)
  } catch {
    return null
  }
}

const walkFiles = (root: string, dir = ''): string[] =>
  fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const relative = dir ? `${dir}/${entry.name}` : entry.name
    if (SKIPPED.has(entry.name)) return []
    if (entry.isDirectory()) return walkFiles(root, relative)
    return entry.isFile() ? [relative] : []
  })

/**
 * Copies what the project tracks or would track — git's view, ignored files left out — into a
 * temporary folder. Strix mounts its target writable; the copy keeps the project out of reach.
 * Symbolic links are skipped so nothing outside the project goes along.
 */
export const copyProject = (root: string, stateDir: string) => {
  const state = path.relative(root, stateDir)
  const extra = state && !state.startsWith('..') ? state.split(path.sep).join('/') : null
  const files = (gitFiles(root) ?? walkFiles(root)).filter((file) => !isSkipped(file, extra))
  if (files.length > MAX_FILES)
    throw new ScanError(
      `the project has ${files.length} files; a scan copies ${MAX_FILES} at most`,
      422,
    )
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'code-atlas-strix-'))
  const target = path.join(temp, path.basename(root) || 'project')
  let bytes = 0
  let copied = 0
  try {
    for (const file of files) {
      const source = path.join(root, file)
      const stat = fs.lstatSync(source, { throwIfNoEntry: false })
      if (!stat?.isFile()) continue
      bytes += stat.size
      if (bytes > MAX_BYTES) throw new ScanError('the project is too large to copy for a scan', 422)
      fs.mkdirSync(path.dirname(path.join(target, file)), { recursive: true })
      fs.copyFileSync(source, path.join(target, file))
      copied++
    }
  } catch (error) {
    fs.rmSync(temp, { recursive: true, force: true })
    throw error
  }
  return { temp, target, files: copied }
}

const launch = (bin: string, args: string[], stateDir: string, copy: { temp: string }) => {
  const cwd = strixCwd(stateDir)
  try {
    fs.mkdirSync(cwd, { recursive: true })
    return spawn(bin, args, {
      cwd,
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        // Strix reports usage to its makers unless told not to; code-atlas keeps things local.
        STRIX_TELEMETRY: process.env.STRIX_TELEMETRY ?? '0',
        NO_COLOR: '1',
        FORCE_COLOR: '0',
      },
    })
  } catch (error) {
    fs.rmSync(copy.temp, { recursive: true, force: true })
    throw error
  }
}

const cleanLine = (line: string) => line.replace(ANSI, '').replace(FRAME, '').trim()

type Scan = { state: StrixScan; stop: (reason: 'cancelled') => void; refresh: () => void }

const signalGroup = (child: ChildProcess, signal: NodeJS.Signals) => {
  try {
    if (child.pid !== undefined && process.platform !== 'win32') process.kill(-child.pid, signal)
    else child.kill(signal)
  } catch {
    // already gone
  }
}

/** One scan at a time per project, kept by the server so it outlives the page that started it. */
export const createScans = (opts: { strixBin?: string } = {}) => {
  const scans = new Map<string, Scan>()

  const start = (root: string, stateDir: string, request: StrixScanRequest): StrixScan => {
    if (scans.get(root)?.state.running)
      throw new ScanError('a scan is already running for this project', 409)
    const copy = copyProject(root, stateDir)
    const state: StrixScan = {
      running: true,
      phase: 'scanning',
      mode: request.mode,
      budgetUsd: request.budgetUsd,
      startedAt: new Date().toISOString(),
      endedAt: null,
      files: copy.files,
      run: null,
      costUsd: null,
      findings: 0,
      exitCode: null,
      error: null,
      log: [],
    }
    const before = new Set(listRunNames(stateDir))
    const child = launch(opts.strixBin ?? 'strix', strixArgs(copy.target, request), stateDir, copy)
    const scan: Scan = { state, stop: () => undefined, refresh: () => undefined }
    scans.set(root, scan)

    let partial = ''
    let failure: string | null = null
    let killer: NodeJS.Timeout | null = null
    const take = (chunk: Buffer) => {
      const lines = (partial + chunk.toString('utf8')).split(/\r?\n/)
      partial = lines.pop() ?? ''
      const kept = lines.map(cleanLine).filter(Boolean)
      if (kept.length) state.log = [...state.log, ...kept].slice(-KEEP_LINES)
    }
    const refresh = () => {
      state.run ??= listRunNames(stateDir).find((name) => !before.has(name)) ?? null
      if (state.run) Object.assign(state, runProgress(stateDir, state.run))
    }
    const stop = (reason: 'cancelled' | 'timeout') => {
      failure ??= reason
      signalGroup(child, 'SIGTERM')
      killer ??= setTimeout(() => signalGroup(child, 'SIGKILL'), GRACE_MS)
    }
    scan.stop = stop
    scan.refresh = refresh
    const poll = setInterval(refresh, POLL_MS)
    const timeout = setTimeout(() => stop('timeout'), TIMEOUT_MS[request.mode])

    const finish = (code: number | null, spawnError: string | null) => {
      if (!state.running) return
      clearInterval(poll)
      clearTimeout(timeout)
      if (killer) clearTimeout(killer)
      if (partial) take(Buffer.from('\n'))
      refresh()
      fs.rmSync(copy.temp, { recursive: true, force: true })
      Object.assign(state, outcome(code, failure ?? spawnError, state.log))
      state.running = false
      state.endedAt = new Date().toISOString()
    }
    child.stdout?.on('data', take)
    child.stderr?.on('data', take)
    child.on('error', (error: NodeJS.ErrnoException) =>
      finish(null, error.code === 'ENOENT' ? 'strix-not-found' : error.message),
    )
    child.on('close', (code) => finish(code, null))
    return state
  }

  return {
    start,
    /** The scan's state, its run folder and numbers read now rather than at the last poll. */
    get: (root: string) => {
      const scan = scans.get(root)
      if (scan?.state.running) scan.refresh()
      return scan?.state ?? null
    },
    cancel: (root: string) => {
      const scan = scans.get(root)
      if (!scan?.state.running) return false
      scan.stop('cancelled')
      return true
    },
    stopAll: () => {
      for (const scan of scans.values()) if (scan.state.running) scan.stop('cancelled')
    },
  }
}

export type Scans = ReturnType<typeof createScans>

/** Strix exits 0 with nothing to report, 2 with findings, 1 on an error. */
const outcome = (
  code: number | null,
  failure: string | null,
  log: string[],
): Pick<StrixScan, 'phase' | 'exitCode' | 'error'> => {
  if (failure === 'cancelled') return { phase: 'cancelled', exitCode: code, error: null }
  if (failure) return { phase: 'failed', exitCode: code, error: failure }
  if (code === 0 || code === 2) return { phase: 'done', exitCode: code, error: null }
  const tail = log.slice(-12).join('\n')
  return { phase: 'failed', exitCode: code, error: tail || `strix exited with code ${code}` }
}
