import { execFileSync } from 'node:child_process'

const git = (root: string, args: string[]) =>
  execFileSync('git', args, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] })
    .toString()
    .trim()

export const gitState = (root: string): { commit: string | null; dirty: boolean } => {
  try {
    const commit = git(root, ['rev-parse', 'HEAD'])
    const dirty = git(root, ['status', '--porcelain']).length > 0
    return { commit: commit || null, dirty }
  } catch {
    return { commit: null, dirty: false }
  }
}
