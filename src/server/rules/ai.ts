import { spawn } from 'node:child_process'
import { isAbsolute, relative } from 'node:path'
import type { AiRuleConfig, ResolvedConfig } from '../../shared/config'
import type { RuleResult, RunEvent } from '../../shared/types'
import { followProcess, spawnEnv } from './process'
import type { ProcessEnd } from './process'
import { finishRun } from './result'

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
  result?: { ok: boolean; findings: Finding[]; error: string | null }
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
  return { ok, findings, error }
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
  ]
  return { model, prompt, args }
}

/** Why Claude gave no findings, when it said nothing itself. */
const failureOf = (end: ProcessEnd, stderr: string) => {
  if (end.failure) return end.failure
  if (end.spawnError?.code === 'ENOENT') return 'claude-not-found'
  return (
    end.spawnError?.message ?? (stderr.trim().slice(-300) || `claude exited with code ${end.code}`)
  )
}

export const runAi = async (
  root: string,
  rule: AiRuleConfig,
  config: ResolvedConfig,
  opts: {
    commit: string | null
    onEvent: (e: RunEvent) => void
    signal?: AbortSignal
    claudeBin?: string
  },
): Promise<RuleResult> => {
  const { args } = aiInvocation(rule, config)
  const child = spawn(opts.claudeBin ?? 'claude', args, {
    cwd: root,
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: spawnEnv((key) => key === 'CLAUDECODE' || key.startsWith('CLAUDE_')),
  })
  let stderr = ''
  // Set by the stream as it is read: an object, so the narrowing of a local does not hide it.
  const last: { result: NonNullable<Parsed['result']> | null } = { result: null }
  const end = await followProcess(child, {
    signal: opts.signal,
    onLine: (line, source) => {
      if (source === 'err') stderr = `${stderr}${line}\n`.slice(-2000)
      else if (line.trim()) {
        const event = parseStreamLine(line, root)
        if (event?.progress) opts.onEvent({ type: 'progress', message: event.progress })
        if (event?.result) last.result = event.result
      }
    },
  })
  const { result } = last
  if (end.failure || end.spawnError || !result)
    return finishRun(rule, opts.commit, { error: failureOf(end, stderr) })
  if (!result.ok) return finishRun(rule, opts.commit, { error: result.error })
  const violations = result.findings.map((finding) => ({
    file: finding.file || null,
    line: finding.line >= 1 ? finding.line : null,
    message: finding.message,
  }))
  return finishRun(rule, opts.commit, { violations })
}
