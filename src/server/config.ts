import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { AtlasConfig, LayerConfig, ResolvedConfig, RuleKind } from '../shared/config'
import type { ConfigSource } from '../shared/types'
import { CONFIG_FILE, SEVERITIES } from '../shared/config'
import { DEFAULT_DOCS, DOC_EXTENSION } from '../shared/docs'
import type { ResolvedDatabaseConfig, RuleConfig } from '../shared/config'
import { drizzleConfigs } from './engine/database'
import { defaultRules } from './rules/defaults'
import { detectWorkspaces, workspaceMembers } from './engine/workspace'
import {
  DEFAULT_EXCLUDE,
  defaultFeatures,
  defaultInclude,
  workspaceFeatures,
} from './configDefaults'
import { isDirectory } from './engine/fs'

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
  'workspaces',
  'features',
  'docs',
  'layers',
  'allow',
  'rules',
  'ai',
  'database',
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
  'db-layers': { required: [], optional: [] },
  'db-mutual': { required: [], optional: [] },
  'db-siblings': { required: [], optional: [] },
  docs: { required: [], optional: ['features'] },
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
  features: 'string',
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

const checkLayers = (value: unknown, issues: string[], key = 'layers') => {
  if (!Array.isArray(value)) {
    issues.push(`${key} must be an array`)
    return
  }
  value.forEach((layer, index) => {
    const at = `${key}[${index}]`
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
  if (value.language !== undefined && typeof value.language !== 'string')
    issues.push('ai.language must be a string')
  // budgetUsd is accepted and ignored: the spending cap was dropped, an older config still loads.
  for (const key of Object.keys(value))
    if (!['model', 'budgetUsd', 'language'].includes(key)) issues.push(`ai: unknown field ${key}`)
}

const checkAllow = (value: unknown, issues: string[], key = 'allow') => {
  const valid =
    Array.isArray(value) &&
    value.every(
      (pair) =>
        Array.isArray(pair) &&
        pair.length === 2 &&
        typeof pair[0] === 'string' &&
        typeof pair[1] === 'string',
    )
  if (!valid) issues.push(`${key} must be an array of [string, string] pairs`)
}

const DATABASE_KEYS = ['config', 'features', 'layers', 'allow', 'junctions']

const checkDatabaseFeatures = (value: unknown, issues: string[]) => {
  if (!Array.isArray(value)) {
    issues.push('database.features must be an array')
    return
  }
  value.forEach((feature, index) => {
    const at = `database.features[${index}]`
    if (!isRecord(feature)) {
      issues.push(`${at} must be an object`)
      return
    }
    if (typeof feature.name !== 'string' || !feature.name)
      issues.push(`${at}.name must be a string`)
    if (!isStringArray(feature.tables)) issues.push(`${at}.tables must be an array of strings`)
    for (const key of Object.keys(feature))
      if (!['name', 'tables'].includes(key)) issues.push(`${at}: unknown field ${key}`)
  })
}

const checkDatabase = (value: unknown, issues: string[]) => {
  if (!isRecord(value)) {
    issues.push('database must be an object')
    return
  }
  for (const key of Object.keys(value))
    if (!DATABASE_KEYS.includes(key)) issues.push(`database: unknown field ${key}`)
  if (value.config !== undefined && typeof value.config !== 'string')
    issues.push('database.config must be a string')
  if (value.features !== undefined) checkDatabaseFeatures(value.features, issues)
  if (value.layers !== undefined) checkLayers(value.layers, issues, 'database.layers')
  if (value.allow !== undefined) checkAllow(value.allow, issues, 'database.allow')
  if (value.junctions !== undefined && !isStringArray(value.junctions))
    issues.push('database.junctions must be an array of strings')
}

const checkDocs = (value: unknown, issues: string[]) => {
  if (!isStringArray(value)) issues.push('docs must be an array of strings')
  else if (!value.every((doc) => DOC_EXTENSION.test(doc)))
    issues.push('docs must name Markdown files: .md, .mdx or .markdown')
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
  for (const key of ['include', 'exclude', 'workspaces', 'features'])
    if (raw[key] !== undefined && !isStringArray(raw[key]))
      issues.push(`${key} must be an array of strings`)
  if (raw.docs !== undefined) checkDocs(raw.docs, issues)
  if (raw.tsconfig !== undefined && typeof raw.tsconfig !== 'string')
    issues.push('tsconfig must be a string')
  if (raw.layers !== undefined) checkLayers(raw.layers, issues)
  if (raw.allow !== undefined) checkAllow(raw.allow, issues)
  if (raw.rules !== undefined) checkRules(raw.rules, issues)
  if (raw.ai !== undefined) checkAi(raw.ai, issues)
  if (raw.database !== undefined) checkDatabase(raw.database, issues)
  return issues
}

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

const resolveDatabase = (raw: AtlasConfig['database']): ResolvedDatabaseConfig => ({
  config: raw?.config ?? null,
  features: raw?.features ?? null,
  layers: raw?.layers ?? [],
  allow: raw?.allow ?? [],
  junctions: raw?.junctions ?? [],
})

/** Fills every key the file leaves out with its default. */
const resolveConfig = (root: string, raw: AtlasConfig): ResolvedConfig => {
  const hasSrc = isDirectory(join(root, 'src'))
  const layers: LayerConfig[] = raw.layers ?? []
  const tsconfig = raw.tsconfig ?? 'tsconfig.json'
  const workspaces = raw.workspaces ?? detectWorkspaces(root)
  const members = workspaceMembers(root, workspaces, tsconfig)
  const rootSrc = hasSrc && existsSync(join(root, tsconfig))
  const database = resolveDatabase(raw.database)
  const rules = (
    raw.rules ??
    defaultRules(root, layers, {
      found: drizzleConfigs(root, database).configs.some((config) => config.chosen),
      layers: database.layers,
    })
  ).map(withoutCap)
  return {
    include: raw.include ?? defaultInclude(workspaces, members, { hasSrc, rootSrc }),
    exclude: raw.exclude ?? DEFAULT_EXCLUDE,
    tsconfig,
    workspaces,
    features:
      raw.features ??
      (members.length ? workspaceFeatures(root, members, rootSrc) : defaultFeatures(root, hasSrc)),
    docs: raw.docs ?? DEFAULT_DOCS,
    layers,
    allow: raw.allow ?? [],
    rules,
    ai: { model: raw.ai?.model ?? 'sonnet', language: raw.ai?.language ?? 'English' },
    database,
  }
}

/** The spending cap an older config may still carry: accepted, ignored, left out of the result. */
const withoutCap = (rule: RuleConfig): RuleConfig => {
  if (rule.kind !== 'ai' || !('budgetUsd' in rule)) return rule
  const kept: RuleConfig & { budgetUsd?: unknown } = { ...rule }
  delete kept.budgetUsd
  return kept
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
