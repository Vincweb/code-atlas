export type Severity = 'critical' | 'high' | 'medium' | 'low'

export const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low']

export const KNOWN_FAMILIES = ['architecture', 'clean-code', 'tooling', 'ai'] as const

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

export type AtlasConfig = {
  include?: string[]
  exclude?: string[]
  tsconfig?: string
  features?: string[]
  layers?: LayerConfig[]
  allow?: [string, string][]
  rules?: RuleConfig[]
  ai?: { model?: string; budgetUsd?: number; language?: string }
}

export type ResolvedConfig = Required<Omit<AtlasConfig, 'ai'>> & {
  ai: { model: string; budgetUsd: number; language: string }
}

export const CONFIG_FILE = 'code-atlas.json'
export const STATE_DIR = '.code-atlas'
