import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import type {
  StrixFinding,
  StrixLocation,
  StrixRun,
  StrixRunSummary,
  StrixSeverity,
} from '../shared/types'

const SEVERITY_ORDER: StrixSeverity[] = ['critical', 'high', 'medium', 'low', 'info']
const MAX_RUNS = 20
const MAX_REPORT_BYTES = 200_000
const RUN_NAME = /^[\w.-]+$/

/** Strix writes its runs under `strix_runs/` in the folder it starts from; code-atlas starts it here. */
export const strixCwd = (stateDir: string) => path.join(stateDir, 'runs')

export const strixRunsDir = (stateDir: string) => path.join(strixCwd(stateDir), 'strix_runs')

type Json = Record<string, unknown>

const asRecord = (value: unknown): Json | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Json) : null

const readJson = (file: string): unknown => {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null)

const integer = (value: unknown) =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 ? value : null

const severityOf = (value: unknown): StrixSeverity => {
  const lower = typeof value === 'string' ? value.toLowerCase().trim() : ''
  return SEVERITY_ORDER.find((severity) => severity === lower) ?? 'info'
}

const isInside = (root: string, file: string) => file.startsWith(root + path.sep)

/**
 * Strix reports paths relative to its workspace, where the project's copy sits in a folder named
 * after it: `src/a.ts`, `<name>/src/a.ts` or `/workspace/<name>/src/a.ts` all mean the same file.
 */
export const projectRelative = (
  root: string,
  reported: string,
): { file: string; exists: boolean } => {
  const clean = reported
    .replace(/\\/g, '/')
    .replace(/^\/?workspace\//, '')
    .replace(/^\.\//, '')
  const segments = clean.split('/').filter(Boolean)
  const candidates = [segments, segments.slice(1)].map((parts) => parts.join('/'))
  for (const candidate of candidates) {
    const absolute = path.resolve(root, candidate)
    if (candidate && isInside(root, absolute) && existsSync(absolute))
      return { file: candidate, exists: true }
  }
  return { file: clean, exists: false }
}

const locationOf = (root: string, value: unknown): StrixLocation[] => {
  const raw = asRecord(value)
  const reported = text(raw?.file)
  const line = integer(raw?.start_line)
  if (!raw || !reported || !line) return []
  return [
    {
      ...projectRelative(root, reported),
      line,
      endLine: integer(raw.end_line),
      label: text(raw.label),
      snippet: text(raw.snippet),
      fixBefore: text(raw.fix_before),
      fixAfter: text(raw.fix_after),
    },
  ]
}

const findingOf = (root: string, runDir: string, value: unknown): StrixFinding[] => {
  const raw = asRecord(value)
  const id = text(raw?.id)
  if (!raw || !id || !RUN_NAME.test(id)) return []
  const locations = Array.isArray(raw.code_locations) ? raw.code_locations : []
  return [
    {
      id,
      title: text(raw.title) ?? id,
      severity: severityOf(raw.severity),
      timestamp: text(raw.timestamp),
      description: text(raw.description),
      impact: text(raw.impact),
      technicalAnalysis: text(raw.technical_analysis),
      poc: text(raw.poc_description),
      pocCode: text(raw.poc_script_code),
      remediation: text(raw.remediation_steps),
      cvss: typeof raw.cvss === 'number' ? raw.cvss : null,
      cwe: text(raw.cwe),
      cve: text(raw.cve),
      endpoint: text(raw.endpoint),
      method: text(raw.method),
      confidence: text(raw.confidence),
      fixEffort: text(raw.fix_effort),
      locations: locations.flatMap((location) => locationOf(root, location)),
      reportPath: path.join(runDir, 'vulnerabilities', `${id}.md`),
    },
  ]
}

const rank = (severity: StrixSeverity) => SEVERITY_ORDER.indexOf(severity)

const readFindings = (root: string, runDir: string) => {
  const raw = readJson(path.join(runDir, 'vulnerabilities.json'))
  const list = Array.isArray(raw) ? raw : []
  return list
    .flatMap((entry) => findingOf(root, runDir, entry))
    .sort((a, b) => rank(a.severity) - rank(b.severity))
}

const costOf = (record: Json | null) => {
  const cost = asRecord(record?.llm_usage)?.cost
  return typeof cost === 'number' ? cost : null
}

const summaryOf = (
  name: string,
  record: Json | null,
  findings: StrixFinding[],
): StrixRunSummary => {
  const bySeverity = Object.fromEntries(
    SEVERITY_ORDER.map((s) => [s, 0]),
  ) as StrixRunSummary['bySeverity']
  for (const finding of findings) bySeverity[finding.severity]++
  return {
    name,
    status: text(record?.status) ?? 'unknown',
    mode: text(record?.scan_mode),
    startedAt: text(record?.start_time),
    endedAt: text(record?.end_time),
    costUsd: costOf(record),
    count: findings.length,
    bySeverity,
  }
}

/** The run folders, newest first. */
export const listRunNames = (stateDir: string) => {
  const dir = strixRunsDir(stateDir)
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && RUN_NAME.test(entry.name))
      .map((entry) => ({ name: entry.name, at: statSync(path.join(dir, entry.name)).mtimeMs }))
      .sort((a, b) => b.at - a.at)
      .map((entry) => entry.name)
  } catch {
    return []
  }
}

export const readRunSummaries = (root: string, stateDir: string): StrixRunSummary[] =>
  listRunNames(stateDir)
    .slice(0, MAX_RUNS)
    .map((name) => {
      const runDir = path.join(strixRunsDir(stateDir), name)
      const record = asRecord(readJson(path.join(runDir, 'run.json')))
      return summaryOf(name, record, readFindings(root, runDir))
    })

const readReport = (runDir: string) => {
  const file = path.join(runDir, 'penetration_test_report.md')
  try {
    return statSync(file).size > MAX_REPORT_BYTES ? null : readFileSync(file, 'utf8')
  } catch {
    return null
  }
}

export const readStrixRun = (root: string, stateDir: string, name: string): StrixRun | null => {
  if (!RUN_NAME.test(name)) return null
  const runDir = path.join(strixRunsDir(stateDir), name)
  if (!existsSync(runDir)) return null
  const record = asRecord(readJson(path.join(runDir, 'run.json')))
  const findings = readFindings(root, runDir)
  return {
    ...summaryOf(name, record, findings),
    instruction: text(record?.instruction),
    findings,
    report: readReport(runDir),
  }
}

/** The live numbers of a run in progress: what it spent and how many findings it has so far. */
export const runProgress = (stateDir: string, name: string) => {
  const runDir = path.join(strixRunsDir(stateDir), name)
  const record = asRecord(readJson(path.join(runDir, 'run.json')))
  const findings = readJson(path.join(runDir, 'vulnerabilities.json'))
  return { costUsd: costOf(record), findings: Array.isArray(findings) ? findings.length : 0 }
}
