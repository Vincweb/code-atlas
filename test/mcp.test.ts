import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { PROTOCOL_VERSION, TOOLS, handleMessage } from '../src/server/mcp'
import type { McpContext } from '../src/server/mcp'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, 'fixtures', 'layered')
const cli = path.join(here, '..', 'src', 'cli.ts')

const context = (): McpContext => ({
  overrides: { root, config: null, state: mkdtempSync(path.join(tmpdir(), 'atlas-mcp-')) },
  cwd: here,
  version: '9.9.9',
})

type Reply = { id: unknown; result?: Record<string, unknown>; error?: { code: number } }

const call = async (ctx: McpContext, name: string, args: Record<string, unknown> = {}) => {
  const reply = (await handleMessage(ctx, {
    jsonrpc: '2.0',
    id: name,
    method: 'tools/call',
    params: { name, arguments: args },
  })) as Reply
  const result = reply.result as { content: { text: string }[]; isError?: boolean }
  const text = result.content[0]?.text ?? ''
  return { isError: result.isError ?? false, text, json: () => JSON.parse(text) as never }
}

test('the handshake, the tool list, and silence on notifications', async () => {
  const ctx = context()
  const init = (await handleMessage(ctx, {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 't' } },
  })) as Reply
  assert.deepEqual(init.result?.protocolVersion, '2025-03-26')
  assert.deepEqual(init.result?.serverInfo, { name: 'code-atlas', version: '9.9.9' })
  const bare = (await handleMessage(ctx, { jsonrpc: '2.0', id: 2, method: 'initialize' })) as Reply
  assert.equal(bare.result?.protocolVersion, PROTOCOL_VERSION)

  assert.equal(
    await handleMessage(ctx, { jsonrpc: '2.0', method: 'notifications/initialized' }),
    null,
  )
  assert.deepEqual(await handleMessage(ctx, { jsonrpc: '2.0', id: 3, method: 'ping' }), {
    jsonrpc: '2.0',
    id: 3,
    result: {},
  })
  const list = (await handleMessage(ctx, { jsonrpc: '2.0', id: 4, method: 'tools/list' })) as Reply
  assert.deepEqual(
    (list.result?.tools as { name: string }[]).map((tool) => tool.name),
    TOOLS.map((tool) => tool.name),
  )
  const missing = (await handleMessage(ctx, { jsonrpc: '2.0', id: 5, method: 'nope' })) as Reply
  assert.equal(missing.error?.code, -32601)
  const bad = (await handleMessage(ctx, [1, 2])) as Reply
  assert.equal(bad.error?.code, -32600)
  const unknown = (await handleMessage(ctx, {
    jsonrpc: '2.0',
    id: 6,
    method: 'tools/call',
    params: { name: 'nope' },
  })) as Reply
  assert.equal(unknown.error?.code, -32602)
})

test('overview, violations, edges and feature read the fixture', async () => {
  const ctx = context()
  const overview = (await call(ctx, 'overview')).json() as {
    label: string
    rules: { id: string; violations: number }[]
    scores: { overall: number }
    history: unknown[]
  }
  assert.equal(overview.label, 'layered')
  assert.equal(overview.rules.find((rule) => rule.id === 'ARCH-CYCLES')?.violations, 2)
  assert.equal(overview.history.length, 0)

  const violations = (await call(ctx, 'violations', { rule: 'ARCH-CYCLES', limit: 1 })).json() as {
    total: number
    shown: number
    violations: { rule: string; file: string }[]
  }
  assert.equal(violations.total, 2)
  assert.equal(violations.shown, 1)
  assert.equal(violations.violations[0]?.rule, 'ARCH-CYCLES')
  const scoped = (await call(ctx, 'violations', { file: 'src/lib/**' })).json() as {
    violations: { file: string }[]
  }
  assert.ok(scoped.violations.every((violation) => violation.file.startsWith('src/lib/')))

  const edges = (await call(ctx, 'edges', { class: 'all' })).json() as {
    total: number
    edges: { from: string; to: string; behind: unknown[] }[]
  }
  assert.ok(edges.total > 0)
  assert.ok(edges.edges.every((edge) => edge.behind.length > 0))
  const red = (await call(ctx, 'edges')).json() as { edges: { class: string }[] }
  assert.ok(red.edges.every((edge) => edge.class === 'up' || edge.class === 'mutual'))

  const feature = (await call(ctx, 'feature', { id: 'src/lib' })).json() as {
    id: string
    files: string[]
    incoming: unknown[]
  }
  assert.equal(feature.id, 'src/lib')
  assert.ok(feature.files.includes('src/lib/x.ts'))
})

test('a bad argument, a missing project or an invalid config is a tool error, not a crash', async () => {
  const ctx = context()
  assert.match(
    (await call(ctx, 'feature', { id: 'nope' })).text,
    /no feature nope — the features are/,
  )
  assert.match((await call(ctx, 'violations', { rule: 'X' })).text, /no rule X/)
  assert.match((await call(ctx, 'edges', { class: 'purple' })).text, /class is one of/)
  assert.match((await call(ctx, 'edges', { graph: 'database' })).text, /no Drizzle config/)
  assert.match((await call(ctx, 'overview', { package: 'apps/x' })).text, /not a monorepo/)
  assert.match((await call(ctx, 'overview', { root: tmpdir() })).text, /no project at/)
  assert.equal((await call(ctx, 'feature', { id: 'nope' })).isError, true)
  const none = { ...ctx, overrides: { ...ctx.overrides, root: null } }
  assert.match((await call(none, 'overview')).text, /no project: start the server/)
})

test('config and describe hand over the reference; check records a point of history', async () => {
  const ctx = context()
  const config = (await call(ctx, 'config')).json() as { reference: string; source: string }
  assert.match(config.reference, /# code-atlas\.json — format reference/)
  assert.equal(config.source, 'default')
  assert.match((await call(ctx, 'describe')).text, /# Current state of layered/)

  const check = (await call(ctx, 'check')).json() as {
    ok: boolean
    regressions: { id: string }[]
    rules: { id: string; violations: unknown[] }[]
  }
  assert.equal(check.ok, false)
  assert.ok(check.regressions.some((regression) => regression.id === 'ARCH-CYCLES'))
  const after = (await call(ctx, 'overview')).json() as { history: { overall: number }[] }
  assert.equal(after.history.length, 1)
})

const speak = (args: string[], lines: string[]) =>
  new Promise<{ stdout: string; stderr: string; code: number | null }>((resolve, reject) => {
    const child = spawn('npx', ['tsx', cli, ...args], { cwd: path.join(here, '..') })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()))
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()))
    child.on('error', reject)
    child.on('close', (code) => resolve({ stdout, stderr, code }))
    child.stdin.end(lines.map((line) => `${line}\n`).join(''))
  })

test('the CLI serves the protocol over stdio, JSON only on stdout', async () => {
  const state = mkdtempSync(path.join(tmpdir(), 'atlas-mcp-cli-'))
  const { stdout, stderr, code } = await speak(
    ['mcp', '--root', root, '--state', state],
    [
      '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18"}}',
      '{"jsonrpc":"2.0","method":"notifications/initialized"}',
      'garbage',
      '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"overview","arguments":{}}}',
    ],
  )
  assert.equal(code, 0, stderr)
  const replies = stdout
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as Reply)
  assert.deepEqual(
    replies.map((reply) => reply.id),
    [1, null, 2],
  )
  assert.equal(replies[1]?.error?.code, -32700)
  assert.match(stderr, /code-atlas mcp .* — on /)
})

test('--check --format json prints one JSON document, the progress on stderr', async () => {
  const state = mkdtempSync(path.join(tmpdir(), 'atlas-format-'))
  const { stdout, stderr, code } = await speak(
    ['--check', '--skip-commands', '--root', root, '--state', state, '--format', 'json'],
    [],
  )
  assert.equal(code, 1)
  const report = JSON.parse(stdout) as { ok: boolean; regressions: unknown[]; rules: unknown[] }
  assert.equal(report.ok, false)
  assert.ok(report.regressions.length > 0)
  assert.match(stderr, /overall: \d+/)
  const bad = await speak(['--check', '--root', root, '--state', state, '--format', 'yaml'], [])
  assert.equal(bad.code, 1)
  assert.match(bad.stderr, /unknown format: yaml/)
})
