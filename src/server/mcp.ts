import { callTool, paramsOf } from './mcpCalls'
import type { McpContext } from './mcpCalls'
import { INSTRUCTIONS, TOOLS } from './mcpTools'

/**
 * The Model Context Protocol over stdio, written by hand: newline-delimited JSON-RPC 2.0, the
 * `initialize` handshake, `tools/list` and `tools/call`. No SDK, so the package keeps its zero
 * runtime dependencies. Spec: https://modelcontextprotocol.io/specification/2025-06-18
 */
export const PROTOCOL_VERSION = '2025-06-18'

export type { McpContext } from './mcpCalls'
export { TOOLS } from './mcpTools'

type JsonRpcId = string | number | null

type Request = { jsonrpc?: unknown; id?: JsonRpcId; method?: unknown; params?: unknown }

type Response =
  | { jsonrpc: '2.0'; id: JsonRpcId; result: unknown }
  | { jsonrpc: '2.0'; id: JsonRpcId; error: { code: number; message: string; data?: unknown } }

const PARSE_ERROR = -32700
const INVALID_REQUEST = -32600
const METHOD_NOT_FOUND = -32601
const INVALID_PARAMS = -32602

const reply = (id: JsonRpcId, result: unknown): Response => ({ jsonrpc: '2.0', id, result })
const refuse = (id: JsonRpcId, code: number, message: string): Response => ({
  jsonrpc: '2.0',
  id,
  error: { code, message },
})

/** One message in, at most one response out: none for a notification (a message without id). */
export const handleMessage = async (
  ctx: McpContext,
  message: unknown,
): Promise<Response | null> => {
  if (typeof message !== 'object' || message === null || Array.isArray(message))
    return refuse(null, INVALID_REQUEST, 'expected one JSON-RPC request object')
  const request = message as Request
  const id = request.id === undefined ? null : request.id
  const isNotification = request.id === undefined
  if (typeof request.method !== 'string')
    return isNotification ? null : refuse(id, INVALID_REQUEST, 'method must be a string')
  const params = paramsOf(request.params)
  switch (request.method) {
    case 'initialize': {
      const asked = params.protocolVersion
      return reply(id, {
        protocolVersion: typeof asked === 'string' ? asked : PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: 'code-atlas', version: ctx.version },
        instructions: INSTRUCTIONS,
      })
    }
    case 'ping':
      return reply(id, {})
    case 'tools/list':
      return reply(id, { tools: TOOLS })
    case 'tools/call': {
      const name = params.name
      if (typeof name !== 'string')
        return refuse(id, INVALID_PARAMS, 'params.name must be a string')
      if (!TOOLS.some((tool) => tool.name === name))
        return refuse(id, INVALID_PARAMS, `no tool ${name}`)
      return reply(id, await callTool(ctx, name, paramsOf(params.arguments)))
    }
    default:
      if (isNotification) return null
      return refuse(id, METHOD_NOT_FOUND, `no method ${request.method}`)
  }
}

/** Serves the protocol on stdin and stdout until stdin closes. Everything else goes to stderr. */
export const serveMcp = (ctx: McpContext) => {
  const write = (response: Response) => process.stdout.write(`${JSON.stringify(response)}\n`)
  let buffer = ''
  let chain = Promise.resolve()
  const dispatch = (line: string) => {
    if (!line.trim()) return
    chain = chain.then(async () => {
      let message: unknown
      try {
        message = JSON.parse(line)
      } catch {
        write(refuse(null, PARSE_ERROR, 'the line is not JSON'))
        return
      }
      const response = await handleMessage(ctx, message)
      if (response) write(response)
    })
  }
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', (chunk: string) => {
    buffer += chunk
    let index = buffer.indexOf('\n')
    while (index !== -1) {
      dispatch(buffer.slice(0, index))
      buffer = buffer.slice(index + 1)
      index = buffer.indexOf('\n')
    }
  })
  process.stdin.on('end', () => {
    if (buffer.trim()) dispatch(buffer)
    void chain.then(() => process.exit(0))
  })
  const where = ctx.overrides.root
    ? `on ${ctx.overrides.root}`
    : 'no project yet — tools take a root'
  console.error(`code-atlas mcp ${ctx.version} — ${where}`)
}
