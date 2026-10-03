import { spawn } from 'node:child_process'
import { isAbsolute, relative } from 'node:path'
import type { AiRuleConfig, ResolvedConfig } from '../../shared/config'
import type { RuleResult, RunEvent } from '../../shared/types'
import { finishRun, killTree, spawnEnv } from './result'

export const FINDINGS_SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          file: { type: 'string' },
          line: { type: 'integer' },
          message: { type: 'string' },
        },
        required: ['file', 'line', 'message'],
      },
    },
  },
  required: ['findings'],
}

type Finding = { file: string; line: number; message: string }
type Parsed = {
  progress?: string
  result?: { ok: boolean; findings: Finding[]; costUsd: number | null; error: string | null }
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null

const relativize = (root: string, path: string) => {
  if (!isAbsolute(path)) return path.replace(/^\.\//, '')
  const rel = relative(root, path)
  return rel.startsWith('..') ? path : rel
}

const toFindings = (root: string, value: unknown): Finding[] => {
  const list = asRecord(value)?.findings
  if (!Array.isArray(list)) return []
  return list.flatMap((entry) => {
    const item = asRecord(entry)
    if (!item || typeof item.message !== 'string') return []
    return [
      {
        file: typeof item.file === 'string' ? relativize(root, item.file) : '',
        line: typeof item.line === 'number' ? item.line : 0,
        message: item.message,
      },
    ]
  })
}

const progressOf = (block: Record<string, unknown>, root: string): string | null => {
  if (block.type === 'text' && typeof block.text === 'string') {
    const text = block.text.trim()
    return text && text.length <= 200 ? text : null
  }
  if (block.type !== 'tool_use') return null
  const input = asRecord(block.input) ?? {}
  if (block.name === 'Read' && typeof input.file_path === 'string')
    return `Read ${relativize(root, input.file_path)}`
  if (block.name === 'Grep' && typeof input.pattern === 'string') return `Grep ${input.pattern}`
  if (block.name === 'Glob' && typeof input.pattern === 'string') return `Glob ${input.pattern}`
  return null
}

const resultOf = (event: Record<string, unknown>, root: string): NonNullable<Parsed['result']> => {
  const ok = event.is_error !== true && event.subtype === 'success'
  const costUsd = typeof event.total_cost_usd === 'number' ? event.total_cost_usd : null
  let findings = toFindings(root, event.structured_output)
  if (!findings.length && typeof event.result === 'string') {
    try {
      findings = toFindings(root, JSON.parse(event.result))
    } catch {
      findings = []
    }
  }
  const errors = Array.isArray(event.errors)
    ? event.errors.filter((entry): entry is string => typeof entry === 'string')
    : []
  const subtype = typeof event.subtype === 'string' ? event.subtype : 'error'
  const error = ok ? null : errors.join('; ') || subtype
  return { ok, findings, costUsd, error }
}

export const parseStreamLine = (line: string, root: string): Parsed | null => {
  let event: Record<string, unknown> | null
  try {
    event = asRecord(JSON.parse(line))
  } catch {
    return null
  }
  if (!event) return null
  if (event.type === 'result') return { result: resultOf(event, root) }
  if (event.type === 'system' && event.subtype === 'init')
    return typeof event.model === 'string' ? { progress: `Model ${event.model}` } : null
  if (event.type !== 'assistant') return null
  const content = asRecord(event.message)?.content
  if (!Array.isArray(content)) return null
  const messages = content.flatMap((block) => {
    const message = asRecord(block) ? progressOf(block as Record<string, unknown>, root) : null
    return message ? [message] : []
  })
  const progress = messages[messages.length - 1]
  return progress ? { progress } : null
}

export const buildAiPrompt = (rule: AiRuleConfig, config: ResolvedConfig) =>
  [
    rule.prompt.trim(),
    rule.files ? `Scope: only files matching ${rule.files}.` : 'Scope: the whole project.',
    'Report only issues you verified by reading the code.',
    'Each finding has a file relative to the project root, a 1-based line and a short message.',
    'Return an empty list when nothing is wrong.',
    `Write the messages in ${config.ai.language}.`,
  ].join('\n\n')

export const AI_TOOLS = ['Read', 'Grep', 'Glob']

export const aiInvocation = (rule: AiRuleConfig, config: ResolvedConfig) => {
  const model = rule.model ?? config.ai.model
  const budgetUsd = rule.budgetUsd ?? config.ai.budgetUsd
  const prompt = buildAiPrompt(rule, config)
  const args = [
    '-p',
    prompt,
    '--output-format',
    'stream-json',
    '--verbose',
    '--json-schema',
    JSON.stringify(FINDINGS_SCHEMA),
    '--tools',
    AI_TOOLS.join(','),
    '--strict-mcp-config',
    '--disable-slash-commands',
    '--no-session-persistence',
    '--model',
    model,
    '--max-budget-usd',
    String(budgetUsd),
  ]
  return { model, budgetUsd, prompt, args }
}

export const runAi = (
  root: string,
  rule: AiRuleConfig,
  config: ResolvedConfig,
  opts: {
    commit: string | null
    onEvent: (e: RunEvent) => void
    signal?: AbortSignal
    claudeBin?: string
  },
): Promise<RuleResult> =>
  new Promise((resolve) => {
    const { args } = aiInvocation(rule, config)
    const child = spawn(opts.claudeBin ?? 'claude', args, {
      cwd: root,
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: spawnEnv((key) => key === 'CLAUDECODE' || key.startsWith('CLAUDE_')),
    })
    let buffer = ''
    let stderr = ''
    let parsed: NonNullable<Parsed['result']> | null = null
    let failure: string | null = null
    let settled = false

    const handle = (line: string) => {
      const event = parseStreamLine(line, root)
      if (event?.progress) opts.onEvent({ type: 'progress', message: event.progress })
      if (event?.result) parsed = event.result
    }
    const onAbort = () => {
      failure ??= 'cancelled'
      killTree(child.pid, () => child.kill('SIGKILL'))
    }
    if (opts.signal?.aborted) onAbort()
    else opts.signal?.addEventListener('abort', onAbort, { once: true })

    const finish = (code: number | null) => {
      if (settled) return
      settled = true
      opts.signal?.removeEventListener('abort', onAbort)
      if (buffer.trim()) handle(buffer)
      const result = parsed
      if (failure || !result)
        return resolve(
          finishRun(rule, opts.commit, {
            costUsd: result?.costUsd ?? null,
            error: failure ?? (stderr.trim().slice(-300) || `claude exited with code ${code}`),
          }),
        )
      if (!result.ok)
        return resolve(
          finishRun(rule, opts.commit, { costUsd: result.costUsd, error: result.error }),
        )
      const violations = result.findings.map((finding) => ({
        file: finding.file || null,
        line: finding.line >= 1 ? finding.line : null,
        message: finding.message,
      }))
      resolve(finishRun(rule, opts.commit, { violations, costUsd: result.costUsd }))
    }

    child.stdout?.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf8')
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) if (line.trim()) handle(line)
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr = (stderr + chunk.toString('utf8')).slice(-2000)
    })
    child.on('error', (error: NodeJS.ErrnoException) => {
      failure ??= error.code === 'ENOENT' ? 'claude-not-found' : error.message
      finish(null)
    })
    child.on('close', (code) => finish(code))
  })
