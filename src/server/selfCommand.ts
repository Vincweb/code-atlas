import path from 'path'
import type { Overrides } from './project'

const quote = (value: string) =>
  /^[\w@%+=:,./-]+$/.test(value) ? value : `'${value.replace(/'/g, `'\\''`)}'`

export const describeCommand = (root: string, overrides: Overrides) => {
  const cli = path.resolve(process.argv[1] ?? 'code-atlas')
  const runner = cli.endsWith('.ts') ? `npx tsx ${quote(cli)}` : `node ${quote(cli)}`
  const isStartup = overrides.root !== null && path.resolve(overrides.root) === root
  const config = isStartup && overrides.config ? ` --config ${quote(overrides.config)}` : ''
  return `${runner} describe --root ${quote(root)}${config}`
}
