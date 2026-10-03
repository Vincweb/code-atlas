import { execFile } from 'child_process'
import type { ClaudeStatus } from '../shared/types'
import { spawnEnv } from './rules/result'

const TTL_MS = 60_000
let cached: { at: number; status: ClaudeStatus } | null = null

const probe = () =>
  new Promise<ClaudeStatus>((resolve) => {
    execFile(
      'claude',
      ['--version'],
      {
        timeout: 5000,
        env: spawnEnv((key) => key === 'CLAUDECODE' || key.startsWith('CLAUDE_')),
      },
      (error, stdout) => {
        if (error) return resolve({ found: false, version: null })
        const version = /\d+\.\d+\.\d+/.exec(stdout)?.[0] ?? (stdout.trim() || null)
        resolve({ found: true, version })
      },
    )
  })

export const claudeStatus = async () => {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.status
  const status = await probe()
  cached = { at: Date.now(), status }
  return status
}
