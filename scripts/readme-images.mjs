#!/usr/bin/env node
// Regenerates docs/media from the fictitious examples/tidy-shop project.
// Drives headless Chrome over the DevTools protocol: its --lang flag is ignored on macOS,
// so the language and the theme are set in the page's own storage instead.
import { spawn } from 'node:child_process'
import { cp, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

const repo = resolve(import.meta.dirname, '..')
const media = join(repo, 'docs/media')
const chrome = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const port = 4899
const debugPort = 9339
const origin = `http://127.0.0.1:${port}`
const demo = '/tmp/tidy-shop'
const work = await mkdtemp(join(tmpdir(), 'code-atlas-images-'))

const until = async (check, what) => {
  for (let attempt = 0; attempt < 100; attempt++) {
    const value = await check().catch(() => undefined)
    if (value) return value
    await sleep(150)
  }
  throw new Error(`Timed out waiting for ${what}`)
}

const connect = async (url) => {
  const socket = new WebSocket(url)
  await new Promise((done, fail) => {
    socket.onopen = done
    socket.onerror = fail
  })
  let next = 0
  const pending = new Map()
  const waiting = []
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data)
    if (message.id) {
      pending.get(message.id)?.(message)
      pending.delete(message.id)
      return
    }
    for (const waiter of waiting.filter((item) => item.method === message.method)) {
      waiting.splice(waiting.indexOf(waiter), 1)
      waiter.done(message.params)
    }
  }
  const send = (method, params = {}) =>
    new Promise((done, fail) => {
      const id = ++next
      pending.set(id, (message) =>
        message.error
          ? fail(new Error(`${method}: ${message.error.message}`))
          : done(message.result),
      )
      socket.send(JSON.stringify({ id, method, params }))
    })
  const once = (method) => new Promise((done) => waiting.push({ method, done }))
  return { send, once, close: () => socket.close() }
}

await rm(demo, { recursive: true, force: true })
await cp(join(repo, 'examples/tidy-shop'), demo, { recursive: true })
await mkdir(join(demo, 'node_modules'))
await symlink(join(repo, 'node_modules/typescript'), join(demo, 'node_modules/typescript'))

const server = spawn(
  process.execPath,
  [
    join(repo, 'dist/cli.js'),
    '--root',
    demo,
    '--state',
    join(work, 'state'),
    '--port',
    `${port}`,
    '--no-open',
  ],
  { stdio: 'ignore' },
)
const browser = spawn(
  chrome,
  [
    '--headless=new',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${join(work, 'profile')}`,
    '--no-first-run',
    '--hide-scrollbars',
    '--disable-gpu',
    'about:blank',
  ],
  { stdio: 'ignore' },
)

try {
  await until(() => fetch(`${origin}/api/projects`).then((response) => response.ok), 'the server')
  const target = await until(
    () =>
      fetch(`http://127.0.0.1:${debugPort}/json/list`)
        .then((response) => response.json())
        .then((targets) => targets.find((item) => item.type === 'page')),
    'Chrome',
  )
  const page = await connect(target.webSocketDebuggerUrl)
  await page.send('Page.enable')
  await page.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-color-scheme', value: 'dark' }],
  })
  await page.send('Emulation.setDefaultBackgroundColorOverride', {
    color: { r: 0, g: 0, b: 0, a: 0 },
  })

  const open = async (url) => {
    const loaded = page.once('Page.loadEventFired')
    await page.send('Page.navigate', { url })
    await loaded
    await until(async () => {
      const { result } = await page.send('Runtime.evaluate', {
        expression:
          "document.readyState === 'complete' && !document.querySelector('.animate-pulse')",
      })
      return result.value
    }, url)
    await page.send('Runtime.evaluate', { expression: 'document.fonts.ready', awaitPromise: true })
    await sleep(700)
  }

  const shoot = async (name, url, width, height) => {
    await page.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 2,
      mobile: false,
    })
    await open(url)
    const { data } = await page.send('Page.captureScreenshot', { format: 'png' })
    await writeFile(join(media, `${name}.png`), Buffer.from(data, 'base64'))
    console.log(`  ${name}.png`)
  }

  await open(`${origin}/`)
  await page.send('Runtime.evaluate', {
    expression:
      "localStorage.setItem('code-atlas.lang', 'en'); localStorage.setItem('code-atlas.theme', 'dark')",
  })

  const project = `${origin}/project?root=${encodeURIComponent(demo)}`
  await shoot('overview', project, 1440, 900)
  await shoot('graph', `${project}&tab=graph`, 1440, 900)
  await shoot('rules', `${project}&tab=rules&rule=ARCH-MUTUAL`, 1440, 900)
  await shoot('metrics', `${project}&tab=metrics`, 1440, 900)
  await shoot('welcome', `${origin}/`, 1440, 900)
  await shoot('banner', `file://${join(media, 'banner.svg')}`, 1152, 412)
  page.close()
  console.log('docs/media regenerated')
} finally {
  browser.kill()
  server.kill()
  await sleep(300)
  await rm(work, { recursive: true, force: true })
}
