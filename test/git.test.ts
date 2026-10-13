import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { gitState } from '../src/server/git'

const run = (root: string, args: string[]) =>
  execFileSync('git', args, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] })

test('the tool’s own state folder never dirties the project it measures', () => {
  const root = mkdtempSync(join(tmpdir(), 'atlas-git-'))
  run(root, ['init', '-q'])
  run(root, [
    '-c',
    'user.name=t',
    '-c',
    'user.email=t@t',
    'commit',
    '-q',
    '--allow-empty',
    '-m',
    'init',
  ])
  const clean = gitState(root)
  assert.ok(clean.commit)
  assert.equal(clean.dirty, false)

  mkdirSync(join(root, '.code-atlas', 'runs'), { recursive: true })
  writeFileSync(join(root, '.code-atlas', 'runs', 'history.jsonl'), '{}\n')
  writeFileSync(join(root, '.code-atlas', 'baseline.json'), '{}\n')
  assert.equal(gitState(root).dirty, false)

  writeFileSync(join(root, 'a.ts'), 'export {}\n')
  assert.equal(gitState(root).dirty, true)
})

test('outside git there is no commit and nothing is dirty', () => {
  assert.deepEqual(gitState(mkdtempSync(join(tmpdir(), 'atlas-nogit-'))), {
    commit: null,
    dirty: false,
  })
})
