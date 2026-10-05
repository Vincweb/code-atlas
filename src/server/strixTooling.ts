import { execFile, execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type {
  StrixCiFile,
  StrixCiStep,
  StrixIntegration,
  StrixSkill,
  StrixTools,
} from '../shared/types'

const TTL_MS = 60_000
const MAX_CI_BYTES = 200_000
let cached: { at: number; tools: StrixTools } | null = null

const versionOf = (bin: string, args: string[]) =>
  new Promise<{ ok: boolean; out: string }>((resolve) => {
    execFile(bin, args, { timeout: 8000 }, (error, stdout) =>
      resolve({ ok: !error, out: stdout.trim() }),
    )
  })

const firstVersion = (out: string) => /\d+\.\d+(\.\d+)?/.exec(out)?.[0] ?? (out || null)

/** Probes the scanner and its sandbox. The LLM settings are reported as present or not, never read out. */
const probe = async (): Promise<StrixTools> => {
  const [strix, docker, dockerServer] = await Promise.all([
    versionOf('strix', ['--version']),
    versionOf('docker', ['--version']),
    versionOf('docker', ['info', '--format', '{{.ServerVersion}}']),
  ])
  return {
    strix: { found: strix.ok, version: strix.ok ? firstVersion(strix.out) : null },
    docker: {
      found: docker.ok,
      running: dockerServer.ok,
      version: dockerServer.ok ? firstVersion(dockerServer.out) : null,
    },
    llm: {
      model: process.env.STRIX_LLM?.trim() || null,
      apiKey: !!(process.env.LLM_API_KEY ?? process.env.OPENAI_API_KEY),
      configFile: existsSync(path.join(os.homedir(), '.strix', 'cli-config.json')),
    },
  }
}

export const strixTools = async (fresh = false) => {
  if (!fresh && cached && Date.now() - cached.at < TTL_MS) return cached.tools
  const tools = await probe()
  cached = { at: Date.now(), tools }
  return tools
}

const CI_FILES: [string, StrixCiFile['provider']][] = [
  ['.gitlab-ci.yml', 'gitlab'],
  ['Jenkinsfile', 'jenkins'],
  ['.circleci/config.yml', 'circleci'],
  ['bitbucket-pipelines.yml', 'bitbucket'],
  ['azure-pipelines.yml', 'azure'],
]

const ciCandidates = (root: string): [string, StrixCiFile['provider']][] => {
  let workflows: string[] = []
  try {
    workflows = readdirSync(path.join(root, '.github', 'workflows'))
      .filter((name) => /\.ya?ml$/.test(name))
      .map((name) => `.github/workflows/${name}`)
  } catch {
    // no GitHub workflows
  }
  return [...workflows.map((file): [string, 'github'] => [file, 'github']), ...CI_FILES]
}

const readSmall = (file: string) => {
  try {
    const content = readFileSync(file, 'utf8')
    return content.length > MAX_CI_BYTES ? null : content
  } catch {
    return null
  }
}

/** A line that starts a scan: `strix` with a target, not the installer or `strix view`. */
const SCAN_LINE = /(^|[\s;&|'"(])strix\s[^\n]*(\s-t\s|--target|--target-list)/
const option = (line: string, pattern: RegExp) => pattern.exec(line)?.[1] ?? null

export const scanStepsIn = (file: string, content: string): StrixCiStep[] =>
  content.split('\n').flatMap((line, index) => {
    if (!SCAN_LINE.test(` ${line} `)) return []
    return [
      {
        file,
        line: index + 1,
        headless: /\s(-n|--non-interactive)(\s|$)/.test(` ${line} `),
        mode: option(line, /(?:--scan-mode|-m)[ =](\w+)/),
        failOn: option(line, /--fail-on[ =](\w+)/),
        budget: option(line, /--max-budget(?:-usd)?[ =]([\d.]+)/),
      },
    ]
  })

export const ciFileOf = (
  file: string,
  provider: StrixCiFile['provider'],
  content: string,
): StrixCiFile | null => {
  const steps = scanStepsIn(file, content)
  const cloud = /\bstrix\s+cloud\s+scans/.test(content)
  if (!steps.length && !cloud) return null
  const github = provider === 'github'
  return {
    file,
    provider,
    steps,
    cloud,
    secrets: /\bSTRIX_LLM\b/.test(content) && /\bLLM_API_KEY\b/.test(content),
    pullRequests: github ? /\bpull_request(_target)?\b/.test(content) : null,
    fullHistory: github ? /fetch-depth:\s*['"]?0\b/.test(content) : null,
  }
}

const findCi = (root: string): StrixCiFile[] =>
  ciCandidates(root).flatMap(([file, provider]) => {
    const content = readSmall(path.join(root, file))
    const found = content === null ? null : ciFileOf(file, provider, content)
    return found ? [found] : []
  })

const SKILL_DIRS = ['.claude/skills', '.agents/skills']

const skillsIn = (base: string, scope: StrixSkill['scope']): StrixSkill[] =>
  SKILL_DIRS.flatMap((dir) => {
    const folder = path.join(base, dir)
    let names: string[] = []
    try {
      names = readdirSync(folder)
    } catch {
      return []
    }
    return names.flatMap((name) => {
      const file = path.join(folder, name, 'SKILL.md')
      const head = readSmall(file)?.slice(0, 4000) ?? ''
      return /strix/i.test(`${name}\n${head}`) ? [{ name, scope, path: file }] : []
    })
  })

/** Whether git ignores a path; null when the folder is no git repository. */
export const gitIgnores = (root: string, relative: string): boolean | null => {
  try {
    execFileSync('git', ['rev-parse', '--git-dir'], { cwd: root, stdio: 'ignore' })
  } catch {
    return null
  }
  try {
    execFileSync('git', ['check-ignore', '-q', '--no-index', relative], {
      cwd: root,
      stdio: 'ignore',
    })
    return true
  } catch {
    return false
  }
}

export const strixIntegration = (root: string, runsDir: string): StrixIntegration => {
  const reports = path.relative(root, runsDir)
  const rootRuns = existsSync(path.join(root, 'strix_runs'))
  return {
    ci: findCi(root),
    skills: [...skillsIn(root, 'project'), ...skillsIn(os.homedir(), 'user')],
    reportsIgnored: reports.startsWith('..') ? true : gitIgnores(root, `${reports}/`),
    rootRuns: { present: rootRuns, ignored: rootRuns ? gitIgnores(root, 'strix_runs/') : null },
  }
}
