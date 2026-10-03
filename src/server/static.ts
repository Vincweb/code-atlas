import fs from 'fs'
import type http from 'http'
import path from 'path'
import { fileURLToPath } from 'url'

export const clientDir = fileURLToPath(
  new URL(
    import.meta.url.includes('/src/server/') ? '../../dist/client/' : './client/',
    import.meta.url,
  ),
)

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
}

export const clientIsBuilt = () => fs.existsSync(path.join(clientDir, 'index.html'))

export const serveClientFile = (pathname: string, response: http.ServerResponse) => {
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '')
  const file = path.resolve(clientDir, relative)
  if (!file.startsWith(clientDir)) return false
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return false

  response.writeHead(200, {
    'content-type': MIME[path.extname(file)] ?? 'application/octet-stream',
    'cache-control': relative.startsWith('assets/')
      ? 'public, max-age=31536000, immutable'
      : 'no-store',
  })
  response.end(fs.readFileSync(file))
  return true
}

export const DEV_CLIENT =
  'code-atlas: serving the API only — the page comes from the Vite dev server, on the URL it prints.'

const escapeAttribute = (value: string) =>
  value.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`)

export const devPage = (web: string) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>code-atlas — API server</title>
<style>
  :root { color-scheme: light dark }
  body { margin: 0; display: grid; place-content: center; min-height: 100vh;
         font: 14px/1.6 ui-sans-serif, -apple-system, "Segoe UI", sans-serif; text-align: center }
  code { font-family: ui-monospace, monospace }
  a { font-size: 18px }
</style></head>
<body><div>
  <p>This port serves <code>/api</code> only.</p>
  <p>The page is on the Vite dev server: <a href="${escapeAttribute(web)}">${escapeAttribute(web)}</a></p>
</div></body></html>
`

export const MISSING_CLIENT = `code-atlas: the client bundle is missing from ${clientDir}

Running from source? Build it once with \`pnpm build\`, or use \`pnpm dev\` — which serves
this API and the Vite dev server side by side.
`
