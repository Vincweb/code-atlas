#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { ConfigError } from './server/config'
import { describeProject } from './server/describe'
import { isProject } from './server/discover'
import { analyzeEngine, EngineError } from './server/engine'
import { gitState } from './server/git'
import { projectContext } from './server/project'
import type { Overrides } from './server/project'
import { makeBaseline, runCheck } from './server/rules'
import { writeBaseline } from './server/rules/state'
import { serveAtlas } from './server/server'

const DEFAULT_PORT = 4800
const DEFAULT_HOST = '127.0.0.1'

const USAGE = `code-atlas — map and audit a TypeScript codebase

Usage
  code-atlas [options]
  code-atlas describe [--root <path>] [--config <file>]

Options
  -r, --root <path>       project to open (default: the current folder, when it is one)
      --config <file>     config to use instead of <root>/code-atlas.json
      --state <dir>       where runs and the baseline are kept (default: <root>/.code-atlas)
  -p, --port <n>          port to serve on (default: ${DEFAULT_PORT})
      --host <host>       host to bind (default: ${DEFAULT_HOST})
      --no-open           do not open the page in the browser
  -c, --check             run the static and command rules, compare with the baseline,
                          exit 1 on any regression
      --skip-commands     with --check or --update-baseline: static rules only
      --update-baseline   run the same rules and save the result as the baseline
  -h, --help              show this message
  -v, --version           show the version

Commands
  describe                the config format and the project's current state, written for an AI
                          assistant: features, layers, red edges with their imports, rules,
                          scores. Exits 2 when the config is invalid.

Examples
  code-atlas                          open the page on the current project
  code-atlas --root ../my-app         open another project
  code-atlas --check                  use it as a CI guard
`

const readVersion = () => {
  const manifest = fileURLToPath(new URL('../package.json', import.meta.url))
  const raw: unknown = JSON.parse(fs.readFileSync(manifest, 'utf8'))
  return raw && typeof raw === 'object' && 'version' in raw && typeof raw.version === 'string'
    ? raw.version
    : '0.0.0'
}

const valueOf = (argv: string[], ...names: string[]) => {
  for (const name of names) {
    const index = argv.indexOf(name)
    if (index !== -1) return argv[index + 1]
  }
  return undefined
}

const has = (argv: string[], ...names: string[]) => names.some((name) => argv.includes(name))

const describe = (error: unknown) => {
  if (error instanceof ConfigError)
    return [`✗ ${error.message}`, ...error.issues.map((issue) => `  - ${issue}`)].join('\n')
  if (error instanceof EngineError) return `✗ ${error.message}`
  return `✗ ${error instanceof Error ? error.message : String(error)}`
}

const gate = async (root: string, overrides: Overrides, argv: string[]) => {
  const { config, stateDir } = projectContext(root, overrides)
  const engine = analyzeEngine(root, config)
  const git = gitState(root)
  const result = await runCheck({
    root,
    config,
    engine,
    stateDir,
    git,
    skipCommands: has(argv, '--skip-commands'),
    log: (line) => console.log(line),
  })
  if (has(argv, '--update-baseline')) {
    writeBaseline(stateDir, makeBaseline(result.rules, result.scores, git.commit))
    console.log(`Baseline saved to ${path.join(stateDir, 'baseline.json')}`)
    return 0
  }
  return result.ok ? 0 : 1
}

export const run = async (argv = process.argv.slice(2)): Promise<number | null> => {
  if (has(argv, '-h', '--help')) {
    console.log(USAGE)
    return 0
  }
  if (has(argv, '-v', '--version')) {
    console.log(readVersion())
    return 0
  }

  const asked = valueOf(argv, '-r', '--root')
  const root = path.resolve(asked ?? '.')
  const found = isProject(root)
  if (asked !== undefined && !found) {
    console.error(`✗ no project at ${root} — expected a folder with package.json and tsconfig.json`)
    return 1
  }

  const configFlag = valueOf(argv, '--config')
  const stateFlag = valueOf(argv, '--state')
  const overrides: Overrides = {
    root: found ? root : null,
    config: configFlag ? path.resolve(configFlag) : null,
    state: stateFlag ? path.resolve(stateFlag) : null,
  }

  if (argv[0] === 'describe') {
    if (!found) {
      console.error(`✗ no project at ${root} — pass --root <path>`)
      return 1
    }
    try {
      const { ok, text } = describeProject(root, overrides)
      console.log(text)
      return ok ? 0 : 2
    } catch (error) {
      console.error(describe(error))
      return 2
    }
  }

  if (has(argv, '-c', '--check', '--update-baseline')) {
    if (!found) {
      console.error(`✗ no project at ${root} — pass --root <path>`)
      return 1
    }
    try {
      return await gate(root, overrides, argv)
    } catch (error) {
      console.error(describe(error))
      return 2
    }
  }

  const port = Number(valueOf(argv, '-p', '--port') ?? DEFAULT_PORT)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error(`✗ invalid port: ${valueOf(argv, '-p', '--port')}`)
    return 1
  }

  serveAtlas({
    overrides,
    port,
    host: valueOf(argv, '--host') ?? DEFAULT_HOST,
    cwd: process.cwd(),
    version: readVersion(),
    open: !has(argv, '--no-open') && process.stdout.isTTY && !process.env.CI,
  })
  return null
}

const code = await run()
if (code !== null) process.exit(code)
