import { spawn } from 'child_process'

const opener = (url: string): [string, string[]] => {
  if (process.platform === 'darwin') return ['open', [url]]
  if (process.platform === 'win32') return ['cmd', ['/c', 'start', '', url]]
  return ['xdg-open', [url]]
}

export const openUrl = (url: string) =>
  new Promise<void>((resolve, reject) => {
    const [command, args] =
      process.platform === 'win32'
        ? ['rundll32', ['url.dll,FileProtocolHandler', url]]
        : opener(url)
    const child = spawn(command, args, { stdio: 'ignore' })
    const settled = setTimeout(resolve, 3000)
    child.on('error', (error) => {
      clearTimeout(settled)
      reject(error)
    })
    child.on('exit', (code) => {
      clearTimeout(settled)
      if (code === 0) resolve()
      else reject(new Error(`no application opened the link (${command} exited with ${code})`))
    })
  })

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
