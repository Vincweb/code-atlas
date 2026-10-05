import type http from 'node:http'

const MAX_BODY_BYTES = 100_000

export type ApiCall = { request: http.IncomingMessage; response: http.ServerResponse; url: URL }
export type ProjectCall = ApiCall & { root: string }

export const json = (response: http.ServerResponse, payload: unknown, status = 200) => {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  response.end(JSON.stringify(payload))
}

export const readJson = (request: http.IncomingMessage) =>
  new Promise<unknown>((resolve, reject) => {
    let body = ''
    request.setEncoding('utf8')
    request.on('data', (chunk: string) => {
      body += chunk
      if (body.length > MAX_BODY_BYTES) {
        reject(new Error('request body too large'))
        request.destroy()
      }
    })
    request.on('end', () => {
      try {
        resolve(JSON.parse(body))
      } catch {
        reject(new Error('request body is not JSON'))
      }
    })
    request.on('error', reject)
  })

export const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : String(error)
