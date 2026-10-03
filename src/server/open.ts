import { spawn } from 'child_process'

const opener = (url: string): [string, string[]] => {
  if (process.platform === 'darwin') return ['open', [url]]
  if (process.platform === 'win32') return ['cmd', ['/c', 'start', '', url]]
  return ['xdg-open', [url]]
}

export const openBrowser = (url: string) => {
  const [command, args] = opener(url)
  try {
    const child = spawn(command, args, { stdio: 'ignore', detached: true })
    child.on('error', () => undefined)
    child.unref()
  } catch {
    return
  }
}
