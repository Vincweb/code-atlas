import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { AtlasConfig, LayerConfig, ResolvedConfig, RuleKind } from '../shared/config'
import type { ConfigSource } from '../shared/types'
import { CONFIG_FILE, SEVERITIES } from '../shared/config'
import { defaultRules } from './rules/defaults'

export { defaultRules } from './rules/defaults'

export class ConfigError extends Error {
  issues: string[]

  constructor(issues: string[]) {
    super(`Invalid ${CONFIG_FILE}:\n${issues.map((issue) => `  - ${issue}`).join('\n')}`)
    this.name = 'ConfigError'
    this.issues = issues
  }
}

const TOP_KEYS = [
  '$schema',
  'include',
  'exclude',
  'tsconfig',
  'features',
  'layers',
  'allow',
  'rules',
  'ai',
]

const KIND_FIELDS: Record<RuleKind, { required: string[]; optional: string[] }> = {
  layers: { required: [], optional: [] },
  mutual: { required: [], optional: [] },
  siblings: { required: [], optional: [] },
  'no-cycle': { required: [], optional: [] },
  'forbid-import': { required: ['from', 'to'], optional: ['types'] },
  'max-lines': { required: ['max'], optional: ['files'] },
  complexity: { required: ['max'], optional: ['files'] },
  'max-params': { required: ['max'], optional: ['files'] },
  pattern: { required: ['pattern'], optional: ['flags', 'files', 'exclude'] },
  command: { required: ['run'], optional: ['timeoutSec'] },
  ai: { required: ['prompt'], optional: ['files', 'model', 'budgetUsd'] },
}

const FIELD_TYPES: Record<string, 'string' | 'number' | 'boolean'> = {
  from: 'string',
  to: 'string',
  types: 'boolean',
  max: 'number',
  files: 'string',
  pattern: 'string',
  flags: 'string',
  exclude: 'string',
  run: 'string',
  timeoutSec: 'number',
  prompt: 'string',
  model: 'string',
  budgetUsd: 'number',
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string')

type KindSpec = { required: string[]; optional: string[] }

/** Checks the fields every rule has, and returns the label its other issues are reported under. */
const checkCommonFields = (
  raw: Record<string, unknown>,
  at: string,
  seen: Set<string>,
  issues: string[],
) => {
  const id = typeof raw.id === 'string' && raw.id ? raw.id : null
  if (!id) issues.push(`${at}.id must be a non-empty string`)
  else if (seen.has(id)) issues.push(`duplicate rule id ${id}`)
  else seen.add(id)
  const label = id ? `rule ${id}` : at
  if (typeof raw.family !== 'string' || !raw.family) issues.push(`${label}.family must be a string`)
  if (!SEVERITIES.includes(raw.severity as never))
    issues.push(`${label}.severity must be one of ${SEVERITIES.join(', ')}`)
  if (raw.title !== undefined && typeof raw.title !== 'string')
    issues.push(`${label}.title must be a string`)
  return label
}

const checkKindFields = (
  raw: Record<string, unknown>,
  label: string,
  spec: KindSpec,
  issues: string[],
) => {
  const fields = [...spec.required, ...spec.optional]
  const known = new Set(['id', 'family', 'severity', 'title', 'kind', ...fields])
  for (const key of Object.keys(raw))
    if (!known.has(key)) issues.push(`${label}: unknown field ${key}`)
  for (const field of fields) {
    const value = raw[field]
    if (value === undefined) {
      if (spec.required.includes(field)) issues.push(`${label}: missing field ${field}`)
    } else if (typeof value !== FIELD_TYPES[field])
      issues.push(`${label}.${field} must be a ${FIELD_TYPES[field]}`)
  }
}

const checkPattern = (raw: Record<string, unknown>, label: string, issues: string[]) => {
  if (typeof raw.pattern !== 'string') return
  try {
    new RegExp(raw.pattern, typeof raw.flags === 'string' ? raw.flags : '')
  } catch (error) {
    issues.push(`${label}.pattern does not compile: ${(error as Error).message}`)
  }
}

const checkRule = (raw: unknown, index: number, seen: Set<string>, issues: string[]) => {
  const at = `rules[${index}]`
  if (!isRecord(raw)) {
    issues.push(`${at} must be an object`)
    return
  }
  const label = checkCommonFields(raw, at, seen, issues)
  const spec = typeof raw.kind === 'string' ? KIND_FIELDS[raw.kind as RuleKind] : undefined
  if (!spec) {
    issues.push(`${label}.kind must be one of ${Object.keys(KIND_FIELDS).join(', ')}`)
    return
  }
  checkKindFields(raw, label, spec, issues)
  if (raw.kind === 'pattern') checkPattern(raw, label, issues)
}

const checkLayers = (value: unknown, issues: string[]) => {
  if (!Array.isArray(value)) {
    issues.push('layers must be an array')
    return
  }
  value.forEach((layer, index) => {
    const at = `layers[${index}]`
    if (!isRecord(layer)) {
      issues.push(`${at} must be an object`)
      return
    }
    if (typeof layer.name !== 'string' || !layer.name) issues.push(`${at}.name must be a string`)
    if (!isStringArray(layer.features)) issues.push(`${at}.features must be an array of strings`)
    if (layer.siblings !== undefined && typeof layer.siblings !== 'boolean')
      issues.push(`${at}.siblings must be a boolean`)
    for (const key of Object.keys(layer))
      if (!['name', 'features', 'siblings'].includes(key))
        issues.push(`${at}: unknown field ${key}`)
  })
}

const checkAi = (value: unknown, issues: string[]) => {
  if (!isRecord(value)) {
    issues.push('ai must be an object')
    return
  }
  if (value.model !== undefined && typeof value.model !== 'string')
    issues.push('ai.model must be a string')
  if (value.budgetUsd !== undefined && typeof value.budgetUsd !== 'number')
    issues.push('ai.budgetUsd must be a number')
  if (value.language !== undefined && typeof value.language !== 'string')
    issues.push('ai.language must be a string')
  for (const key of Object.keys(value))
    if (!['model', 'budgetUsd', 'language'].includes(key)) issues.push(`ai: unknown field ${key}`)
}

const checkAllow = (value: unknown, issues: string[]) => {
  const valid =
    Array.isArray(value) &&
    value.every(
      (pair) =>
        Array.isArray(pair) &&
        pair.length === 2 &&
        typeof pair[0] === 'string' &&
        typeof pair[1] === 'string',
    )
  if (!valid) issues.push('allow must be an array of [string, string] pairs')
}

const checkRules = (value: unknown, issues: string[]) => {
  if (!Array.isArray(value)) {
    issues.push('rules must be an array')
    return
  }
  const seen = new Set<string>()
  value.forEach((rule, index) => checkRule(rule, index, seen, issues))
}

const validate = (raw: unknown): string[] => {
  if (!isRecord(raw)) return ['the file must contain a JSON object']
  const issues: string[] = []
  for (const key of Object.keys(raw)) if (!TOP_KEYS.includes(key)) issues.push(`unknown key ${key}`)
  for (const key of ['include', 'exclude', 'features'])
    if (raw[key] !== undefined && !isStringArray(raw[key]))
      issues.push(`${key} must be an array of strings`)
  if (raw.tsconfig !== undefined && typeof raw.tsconfig !== 'string')
    issues.push('tsconfig must be a string')
  if (raw.layers !== undefined) checkLayers(raw.layers, issues)
  if (raw.allow !== undefined) checkAllow(raw.allow, issues)
  if (raw.rules !== undefined) checkRules(raw.rules, issues)
  if (raw.ai !== undefined) checkAi(raw.ai, issues)
  return issues
}

const isDirectory = (path: string) => existsSync(path) && statSync(path).isDirectory()

const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'coverage'])

const subdirectories = (dir: string) => {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
      .filter((entry) => !SKIP_DIRS.has(entry.name))
      .map((entry) => entry.name)
  } catch {
    return []
  }
}

const defaultFeatures = (root: string, hasSrc: boolean) => {
  const base = hasSrc ? 'src' : ''
  const prefix = base ? `${base}/` : ''
  const grouped = subdirectories(join(root, base))
    .filter((name) => subdirectories(join(root, base, name)).length >= 3)
    .sort()
    .map((name) => `${prefix}${name}/*`)
  return [...grouped, `${prefix}*`]
}

const DEFAULT_EXCLUDE = [
  '**/*.test.*',
  '**/*.spec.*',
  '**/*.d.ts',
  '**/node_modules/**',
  '**/dist/**',
]

const readConfigFile = (path: string): AtlasConfig => {
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    throw new ConfigError([`cannot read ${path}: ${(error as Error).message}`])
  }
  const issues = validate(parsed)
  if (issues.length) throw new ConfigError(issues)
  return parsed as AtlasConfig
}

/** Fills every key the file leaves out with its default. */
const resolveConfig = (root: string, raw: AtlasConfig): ResolvedConfig => {
  const hasSrc = isDirectory(join(root, 'src'))
  const layers: LayerConfig[] = raw.layers ?? []
  return {
    include: raw.include ?? (hasSrc ? ['src/**'] : ['**']),
    exclude: raw.exclude ?? DEFAULT_EXCLUDE,
    tsconfig: raw.tsconfig ?? 'tsconfig.json',
    features: raw.features ?? defaultFeatures(root, hasSrc),
    layers,
    allow: raw.allow ?? [],
    rules: raw.rules ?? defaultRules(root, layers),
    ai: { model: 'sonnet', budgetUsd: 1, language: 'English', ...raw.ai },
  }
}

export const loadConfig = (
  root: string,
  overridePath?: string | null,
): { config: ResolvedConfig; source: ConfigSource; path: string | null } => {
  const fromCli = overridePath ? resolve(overridePath) : null
  const inRoot = join(root, CONFIG_FILE)
  const path = fromCli ?? (existsSync(inRoot) ? inRoot : null)
  const source: ConfigSource = fromCli ? 'cli' : path ? 'file' : 'default'
  const raw = path ? readConfigFile(path) : {}
  return { config: resolveConfig(root, raw), source, path }
}

export { draftConfig, draftText } from './rules/draft'
