import assert from 'node:assert/strict'
import fs from 'node:fs'
import type http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { isRebound, readProjectFile } from '../src/server/server'

const requestTo = (host: string | undefined) =>
  ({ headers: host === undefined ? {} : { host } }) as http.IncomingMessage

test('a loopback server answers only to loopback names', () => {
  for (const host of ['127.0.0.1:4800', 'localhost:4801', '[::1]:4800', 'app.localhost'])
    assert.equal(isRebound(requestTo(host), '127.0.0.1'), false, host)
  for (const host of ['evil.example:4800', '192.168.1.5:4800', '', undefined])
    assert.equal(isRebound(requestTo(host), '127.0.0.1'), true, String(host))
})

test('a server bound beyond loopback answers any name', () => {
  assert.equal(isRebound(requestTo('192.168.1.5:4800'), '0.0.0.0'), false)
})

test('reads a project file, never one a link leads out of the project', () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-file-')))
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-outside-'))
  try {
    fs.mkdirSync(path.join(root, 'src'))
    fs.writeFileSync(path.join(root, 'src', 'a.ts'), 'export const a = 1\n')
    fs.writeFileSync(path.join(outside, 'secret.txt'), 'secret\n')
    fs.symlinkSync(outside, path.join(root, 'src', 'link'))

    assert.equal(readProjectFile(root, 'src/a.ts'), 'export const a = 1\n')
    assert.equal(readProjectFile(root, 'src/link/secret.txt'), null)
    assert.equal(readProjectFile(root, '../secret.txt'), null)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
    fs.rmSync(outside, { recursive: true, force: true })
  }
})
