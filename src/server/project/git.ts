import { execFileSync } from 'node:child_process'
import { STATE_DIR } from '../../shared/config'

const git = (root: string, args: string[]) =>
  execFileSync('git', args, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] })
    .toString()
    .trim()

/** A porcelain line about the tool's own state folder: it must never dirty the project it measures. */
const isOwnState = (line: string) => {
  const file = line.slice(3).split(' -> ').pop() ?? ''
  return file === STATE_DIR || file === `${STATE_DIR}/` || file.startsWith(`${STATE_DIR}/`)
}

export const gitState = (root: string): { commit: string | null; dirty: boolean } => {
  try {
    const commit = git(root, ['rev-parse', 'HEAD'])
    const changes = git(root, ['status', '--porcelain'])
      .split('\n')
      .filter((line) => line.length > 0 && !isOwnState(line))
    return { commit: commit || null, dirty: changes.length > 0 }
  } catch {
    return { commit: null, dirty: false }
  }
}
