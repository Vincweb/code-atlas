import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import type { CommandRuleConfig } from '../src/shared/config'
import type { RunEvent } from '../src/shared/types'
import { parseCommandOutput, runCommand } from '../src/server/rules/command'

const rule = (run: string, extra: Partial<CommandRuleConfig> = {}): CommandRuleConfig => ({
  id: 'CMD',
  family: 'tooling',
  severity: 'high',
  kind: 'command',
  run,
  ...extra,
})

const root = mkdtempSync(join(tmpdir(), 'atlas-command-'))
mkdirSync(join(root, 'src'))
writeFileSync(join(root, 'src/a.ts'), 'x')

test('exit 0 passes and streams progress', async () => {
  const events: RunEvent[] = []
  const result = await runCommand(root, rule('echo \u001b[31mhello\u001b[0m'), {
    commit: 'c',
    onEvent: (event) => events.push(event),
  })
  assert.equal(result.status, 'pass')
  assert.equal(result.commit, 'c')
  assert.ok(events.some((e) => e.type === 'progress' && e.message === 'hello'))
})

test('failure parses file locations', async () => {
  const result = await runCommand(
    root,
    rule(
      `echo "src/a.ts:12:3 error nope"; echo "${root}/src/a.ts(12,1)"; echo "src/missing.ts:1:1"; exit 2`,
    ),
    { commit: null, onEvent: () => {} },
  )
  assert.equal(result.status, 'fail')
  assert.deepEqual(
    result.violations.map((v) => [v.file, v.line]),
    [['src/a.ts', 12]],
  )
})

test('failure without a location keeps the last lines', async () => {
  const result = await runCommand(root, rule('echo boom 1>&2; exit 1'), {
    commit: null,
    onEvent: () => {},
  })
  assert.equal(result.status, 'fail')
  assert.deepEqual(result.violations, [{ file: null, line: null, message: 'boom' }])
})

test('timeout and abort are errors', async () => {
  const slow = await runCommand(root, rule('sleep 5', { timeoutSec: 0.2 }), {
    commit: null,
    onEvent: () => {},
  })
  assert.equal(slow.status, 'error')
  assert.equal(slow.error, 'timeout')
  const controller = new AbortController()
  setTimeout(() => controller.abort(), 100)
  const cancelled = await runCommand(root, rule('sleep 5'), {
    commit: null,
    onEvent: () => {},
    signal: controller.signal,
  })
  assert.equal(cancelled.error, 'cancelled')
})

test('parseCommandOutput ignores paths outside the root', () => {
  assert.deepEqual(parseCommandOutput(root, ['/etc/passwd:1', 'plain line']), [])
})
