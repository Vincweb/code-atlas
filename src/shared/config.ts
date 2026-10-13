export type Severity = 'critical' | 'high' | 'medium' | 'low'

export const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low']

export const KNOWN_FAMILIES = ['architecture', 'clean-code', 'tooling', 'database', 'ai'] as const

export type LayerConfig = {
  name: string
  features: string[]
  siblings?: boolean
}

type RuleBase = {
  id: string
  family: string
  severity: Severity
  title?: string
}

export type StaticRuleConfig = RuleBase &
  (
    | { kind: 'layers' }
    | { kind: 'mutual' }
    | { kind: 'siblings' }
    | { kind: 'no-cycle' }
    | { kind: 'forbid-import'; from: string; to: string; types?: boolean }
    | { kind: 'max-lines'; max: number; files?: string }
    | { kind: 'complexity'; max: number; files?: string }
    | { kind: 'max-params'; max: number; files?: string }
    | { kind: 'pattern'; pattern: string; flags?: string; files?: string; exclude?: string }
    | { kind: 'db-layers' }
    | { kind: 'db-mutual' }
    | { kind: 'db-siblings' }
  )

export type CommandRuleConfig = RuleBase & { kind: 'command'; run: string; timeoutSec?: number }

export type AiRuleConfig = RuleBase & {
  kind: 'ai'
  prompt: string
  files?: string
  model?: string
  budgetUsd?: number
}

export type RuleConfig = StaticRuleConfig | CommandRuleConfig | AiRuleConfig

export type RuleKind = RuleConfig['kind']

export const RUN_KINDS: RuleKind[] = ['command', 'ai']

/** The database rules are in beta: shown and scored, but they never gate `--check`. */
export const DB_KINDS: RuleKind[] = ['db-layers', 'db-mutual', 'db-siblings']

export const isDbKind = (kind: RuleKind) => DB_KINDS.includes(kind)

/** A group of tables: ordered globs over table names, the first matching feature wins. */
export type DbFeatureConfig = { name: string; tables: string[] }

export type DatabaseConfig = {
  config?: string
  features?: DbFeatureConfig[]
  layers?: LayerConfig[]
  allow?: [string, string][]
  junctions?: string[]
}

export type AtlasConfig = {
  include?: string[]
  exclude?: string[]
  tsconfig?: string
  /** Package folders of a monorepo; detected from the package manager when left out. */
  workspaces?: string[]
  features?: string[]
  layers?: LayerConfig[]
  allow?: [string, string][]
  rules?: RuleConfig[]
  ai?: { model?: string; budgetUsd?: number; language?: string }
  database?: DatabaseConfig
}

export type ResolvedDatabaseConfig = {
  config: string | null
  /** null: tables are grouped by the first segment of their name. */
  features: DbFeatureConfig[] | null
  layers: LayerConfig[]
  allow: [string, string][]
  junctions: string[]
}

export type ResolvedConfig = Required<Omit<AtlasConfig, 'ai' | 'database'>> & {
  ai: { model: string; budgetUsd: number; language: string }
  database: ResolvedDatabaseConfig
}

export const CONFIG_FILE = 'code-atlas.json'
export const STATE_DIR = '.code-atlas'
