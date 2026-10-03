import assert from 'node:assert/strict'
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import type { AiRuleConfig, ResolvedConfig } from '../src/shared/config'
import type { RunEvent } from '../src/shared/types'
import { buildAiPrompt, parseStreamLine, runAi } from '../src/server/rules/ai'

const root = '/proj'
const config: ResolvedConfig = {
  include: [],
  exclude: [],
  tsconfig: 'tsconfig.json',
  features: [],
  layers: [],
  allow: [],
  rules: [],
  ai: { model: 'sonnet', budgetUsd: 1, language: 'French' },
}
const rule: AiRuleConfig = {
  id: 'AI',
  family: 'ai',
  severity: 'medium',
  kind: 'ai',
  prompt: 'Review it.',
  files: 'src/**',
}

const assistant = (block: object) =>
  JSON.stringify({ type: 'assistant', message: { content: [block] } })

test('progress lines', () => {
  assert.deepEqual(
    parseStreamLine(
      JSON.stringify({ type: 'system', subtype: 'init', model: 'claude-sonnet-5' }),
      root,
    ),
    { progress: 'Model claude-sonnet-5' },
  )
  assert.deepEqual(
    parseStreamLine(
      assistant({ type: 'tool_use', name: 'Read', input: { file_path: '/proj/src/a.ts' } }),
      root,
    ),
    { progress: 'Read src/a.ts' },
  )
  assert.deepEqual(
    parseStreamLine(
      assistant({ type: 'tool_use', name: 'Grep', input: { pattern: 'foo', path: '.' } }),
      root,
    ),
    { progress: 'Grep foo' },
  )
  assert.deepEqual(
    parseStreamLine(
      assistant({ type: 'tool_use', name: 'Glob', input: { pattern: '**/a.ts' } }),
      root,
    ),
    { progress: 'Glob **/a.ts' },
  )
  assert.deepEqual(parseStreamLine(assistant({ type: 'text', text: 'Looking around' }), root), {
    progress: 'Looking around',
  })
  assert.equal(parseStreamLine(assistant({ type: 'text', text: 'x'.repeat(300) }), root), null)
  assert.equal(parseStreamLine(assistant({ type: 'thinking', thinking: '…' }), root), null)
  assert.equal(
    parseStreamLine(assistant({ type: 'tool_use', name: 'StructuredOutput', input: {} }), root),
    null,
  )
})

test('ignored and invalid lines', () => {
  assert.equal(parseStreamLine('not json', root), null)
  assert.equal(parseStreamLine(JSON.stringify({ type: 'user' }), root), null)
  assert.equal(parseStreamLine(JSON.stringify({ type: 'rate_limit_event' }), root), null)
  assert.equal(
    parseStreamLine(JSON.stringify({ type: 'system', subtype: 'task_summary' }), root),
    null,
  )
})

test('result lines', () => {
  const ok = parseStreamLine(
    JSON.stringify({
      type: 'result',
      subtype: 'success',
      is_error: false,
      total_cost_usd: 0.07,
      structured_output: { findings: [{ file: '/proj/src/a.ts', line: 3, message: 'm' }] },
    }),
    root,
  )
  assert.deepEqual(ok, {
    result: {
      ok: true,
      findings: [{ file: 'src/a.ts', line: 3, message: 'm' }],
      costUsd: 0.07,
      error: null,
    },
  })
  const failed = parseStreamLine(
    JSON.stringify({
      type: 'result',
      subtype: 'error_max_budget_usd',
      is_error: true,
      total_cost_usd: 0.31,
      errors: ['Reached maximum budget ($0.1)'],
    }),
    root,
  )
  assert.deepEqual(failed?.result, {
    ok: false,
    findings: [],
    costUsd: 0.31,
    error: 'Reached maximum budget ($0.1)',
  })
})

test('prompt carries the guardrails', () => {
  const prompt = buildAiPrompt(rule, config)
  for (const part of [
    'Review it.',
    'src/**',
    'verified',
    'relative to the project root',
    '1-based',
    'empty list',
    'French',
  ])
    assert.ok(prompt.includes(part), part)
})

const fakeClaude = (lines: object[], exit = 0) => {
  const dir = mkdtempSync(join(tmpdir(), 'atlas-ai-'))
  const script = join(dir, 'claude')
  const body = lines.map((l) => `console.log(${JSON.stringify(JSON.stringify(l))})`).join('\n')
  writeFileSync(script, `#!/usr/bin/env node\n${body}\nprocess.exit(${exit})\n`)
  chmodSync(script, 0o755)
  return script
}

test('runAi turns findings into violations', async () => {
  const events: RunEvent[] = []
  const claudeBin = fakeClaude([
    { type: 'system', subtype: 'init', model: 'm' },
    {
      type: 'result',
      subtype: 'success',
      is_error: false,
      total_cost_usd: 0.5,
      structured_output: { findings: [{ file: 'src/a.ts', line: 0, message: 'bad' }] },
    },
  ])
  const result = await runAi(tmpdir(), rule, config, {
    commit: 'c',
    onEvent: (e) => events.push(e),
    claudeBin,
  })
  assert.equal(result.status, 'fail')
  assert.equal(result.costUsd, 0.5)
  assert.deepEqual(result.violations, [{ file: 'src/a.ts', line: null, message: 'bad' }])
  assert.ok(events.some((e) => e.type === 'progress' && e.message === 'Model m'))
})

test('runAi reports errors', async () => {
  const claudeBin = fakeClaude(
    [
      {
        type: 'result',
        subtype: 'error_max_budget_usd',
        is_error: true,
        total_cost_usd: 1,
        errors: ['over'],
      },
    ],
    1,
  )
  const result = await runAi(tmpdir(), rule, config, { commit: null, onEvent: () => {}, claudeBin })
  assert.equal(result.status, 'error')
  assert.equal(result.error, 'over')
  const missing = await runAi(tmpdir(), rule, config, {
    commit: null,
    onEvent: () => {},
    claudeBin: '/nonexistent/claude',
  })
  assert.equal(missing.error, 'claude-not-found')
})
