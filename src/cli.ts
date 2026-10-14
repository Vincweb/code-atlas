#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { describeProject } from './server/describe'
import { isProject } from './server/project/discover'
import { analyzeEngine } from './server/engine'
import { gitState } from './server/project/git'
import { serveMcp } from './server/mcp'
import { projectContext } from './server/project'
import type { Overrides } from './server/project'
import {
  FORMATS,
  checkReport,
  githubAnnotations,
  isFormat,
  sarifReport,
  summaryMarkdown,
} from './server/report'
import type { Format } from './server/report'
import type { CheckReport } from './shared/types'
import { messageOf } from './shared/errors'
import { makeBaseline, runCheck } from './server/rules'
import { historyEntry, recordHistory } from './server/rules/history'
import { writeBaseline } from './server/rules/state'
import { serveAtlas } from './server/http'

const DEFAULT_PORT = 4800
const DEFAULT_HOST = '127.0.0.1'

const USAGE = `code-atlas — map and audit a TypeScript codebase

Usage
  code-atlas [options]
  code-atlas describe [--root <path>] [--config <file>]
  code-atlas mcp [--root <path>] [--config <file>] [--state <dir>]

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
      --format <name>     with the two above: text (default), json, github (annotations and
                          a job summary for GitHub Actions) or sarif (for code scanning)
  -h, --help              show this message
  -v, --version           show the version

Commands
  describe                the config format and the project's current state, written for an AI
                          assistant: features, layers, red edges with their imports, rules,
                          scores. Exits 2 when the config is invalid.
  mcp                     serve the same as MCP tools over stdio, for Claude Code or any MCP
                          client: claude mcp add -s project code-atlas -- npx -y @vincweb/code-atlas mcp

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

/** A config error's message already lists its issues, one per line. */
const describe = (error: unknown) => `✗ ${messageOf(error)}`

/** What a format prints besides the text report; `json` and `sarif` own stdout entirely. */
const emit = (format: Format, report: CheckReport) => {
  switch (format) {
    case 'text':
      return
    case 'json':
      console.log(JSON.stringify(report, null, 2))
      return
    case 'sarif':
      console.log(JSON.stringify(sarifReport(report, readVersion()), null, 2))
      return
    case 'github': {
      for (const line of githubAnnotations(report)) console.log(line)
      const summary = process.env.GITHUB_STEP_SUMMARY
      if (summary) fs.appendFileSync(summary, summaryMarkdown(report))
      return
    }
  }
}

const gate = async (root: string, overrides: Overrides, argv: string[], format: Format) => {
  const quiet = format === 'json' || format === 'sarif'
  const log = (line: string) => (quiet ? console.error(line) : console.log(line))
  const recording = has(argv, '--update-baseline')
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
    recording,
    log,
  })
  recordHistory(stateDir, historyEntry(result.scores, result.rules, result.packages, git))
  if (recording) {
    writeBaseline(stateDir, makeBaseline(result.rules, result.scores, git.commit, result.packages))
    log(`Baseline saved to ${path.join(stateDir, 'baseline.json')}`)
  }
  emit(format, checkReport({ root, engine, git, recording, result }))
  return recording || result.ok ? 0 : 1
}

const overridesFrom = (argv: string[], root: string | null): Overrides => {
  const configFlag = valueOf(argv, '--config')
  const stateFlag = valueOf(argv, '--state')
  return {
    root,
    config: configFlag ? path.resolve(configFlag) : null,
    state: stateFlag ? path.resolve(stateFlag) : null,
  }
}

const runDescribe = (root: string, overrides: Overrides) => {
  const { ok, text } = describeProject(root, overrides)
  console.log(text)
  return ok ? 0 : 2
}

/** The commands that need a project, each exiting 2 when the config or the engine fails. */
const projectCommand = (argv: string[], format: Format) => {
  if (argv[0] === 'describe') return runDescribe
  if (has(argv, '-c', '--check', '--update-baseline'))
    return (root: string, overrides: Overrides) => gate(root, overrides, argv, format)
  return null
}

const serve = (argv: string[], overrides: Overrides) => {
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

export const run = async (argv = process.argv.slice(2)): Promise<number | null> => {
  if (has(argv, '-h', '--help')) {
    console.log(USAGE)
    return 0
  }
  if (has(argv, '-v', '--version')) {
    console.log(readVersion())
    return 0
  }

  const format = valueOf(argv, '--format') ?? 'text'
  if (!isFormat(format)) {
    console.error(`✗ unknown format: ${format} — one of ${FORMATS.join(', ')}`)
    return 1
  }

  const asked = valueOf(argv, '-r', '--root')
  const root = path.resolve(asked ?? '.')
  const found = isProject(root)
  if (asked !== undefined && !found) {
    console.error(
      `✗ no project at ${root} — expected a folder with package.json and tsconfig.json, or a monorepo root`,
    )
    return 1
  }
  const overrides = overridesFrom(argv, found ? root : null)

  if (argv[0] === 'mcp') {
    serveMcp({ overrides, cwd: process.cwd(), version: readVersion() })
    return null
  }
  const command = projectCommand(argv, format)
  if (!command) return serve(argv, overrides)
  if (!found) {
    console.error(`✗ no project at ${root} — pass --root <path>`)
    return 1
  }
  try {
    return await command(root, overrides)
  } catch (error) {
    console.error(describe(error))
    return 2
  }
}

const code = await run()
if (code !== null) process.exit(code)
