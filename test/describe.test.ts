import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { describeProject } from '../src/server/describe'
import { describeCommand } from '../src/server/selfCommand'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'layered')
const none = { root: null, config: null, state: null }

test('describe prints the format reference and the current state', () => {
  const { ok, text } = describeProject(root, none)
  assert.equal(ok, true)
  assert.match(text, /# code-atlas\.json — format reference/)
  assert.match(text, /# Current state of layered/)
  assert.match(text, /## Red edges \(up and mutual\): \d+/)
  assert.match(text, /## File cycles: 2/)
  assert.match(text, /src\/lib\/x\.ts → src\/lib\/y\.ts → src\/lib\/x\.ts/)
})

test('describe lists the config issues and fails on an invalid config', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'atlas-describe-'))
  const file = path.join(dir, 'bad.json')
  writeFileSync(file, JSON.stringify({ rules: [{ id: 'X', kind: 'nope' }] }))
  const { ok, text } = describeProject(root, { root, config: file, state: null })
  assert.equal(ok, false)
  assert.match(text, /The config is invalid/)
  assert.match(text, /rule X\.kind must be one of/)
})

test('the describe command names the root and the config override', () => {
  const command = describeCommand(root, { root, config: '/tmp/my config.json', state: null })
  assert.match(command, / describe --root /)
  assert.match(command, /--config '\/tmp\/my config\.json'/)
})
