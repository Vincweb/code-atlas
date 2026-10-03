import { spawn } from 'child_process'

const args = process.argv.slice(2)

const portFlag = args.findIndex((arg) => arg === '--port' || arg === '-p')
const port = portFlag === -1 ? undefined : args[portFlag + 1]

const children = [
  spawn('pnpm', ['exec', 'tsx', 'watch', 'src/cli.ts', ...args], {
    stdio: 'inherit',
    env: { ...process.env, CODE_ATLAS_DEV: '1', CODE_ATLAS_WEB: 'http://localhost:4801' },
  }),
  spawn('pnpm', ['exec', 'vite'], {
    stdio: 'inherit',
    env: port ? { ...process.env, CODE_ATLAS_API: `http://127.0.0.1:${port}` } : { ...process.env },
  }),
]

let stopping = false
const stop = (code: number) => {
  if (stopping) return
  stopping = true
  for (const child of children) child.kill('SIGTERM')
  process.exitCode = code
}

for (const child of children) {
  child.on('exit', (code) => stop(code ?? 0))
  child.on('error', (error) => {
    console.error(error)
    stop(1)
  })
}

process.on('SIGINT', () => stop(0))
process.on('SIGTERM', () => stop(0))
