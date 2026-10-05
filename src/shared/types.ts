import type { AtlasConfig, ResolvedConfig, RuleKind, Severity } from './config'

export type ImportKind = 'static' | 'reexport' | 'dynamic' | 'type'

export type FileNode = {
  path: string
  feature: string
  lines: number
}

export type ImportEdge = {
  from: string
  to: string
  line: number
  kind: ImportKind
}

export type EdgeClass = 'down' | 'up' | 'mutual' | 'sibling' | 'lateral' | 'allowed' | 'unlayered'

export type FeatureNode = {
  id: string
  layer: number | null
  files: number
  lines: number
  ca: number
  ce: number
  instability: number
}

export type FeatureEdge = {
  from: string
  to: string
  weight: number
  class: EdgeClass
  imports: { file: string; line: number; target: string }[]
}

export type LayerInfo = {
  name: string
  siblings: boolean
}

export type Graph = {
  layers: LayerInfo[]
  features: FeatureNode[]
  edges: FeatureEdge[]
  cycles: string[][]
}

export type FunctionMetric = {
  file: string
  line: number
  name: string
  complexity: number
  params: number
  lines: number
}

export type EngineStats = {
  files: number
  lines: number
  imports: number
  typeImports: number
  features: number
  functions: number
}

export type EngineResult = {
  ts: { version: string; projects: string[] }
  files: FileNode[]
  imports: ImportEdge[]
  graph: Graph
  functions: FunctionMetric[]
  stats: EngineStats
  warnings: string[]
}

export type Violation = {
  file: string | null
  line: number | null
  message: string
}

export type RuleStatus = 'pass' | 'fail' | 'not-run' | 'error'

export type RuleResult = {
  id: string
  family: string
  severity: Severity
  kind: RuleKind
  title: string
  status: RuleStatus
  count: number
  violations: Violation[]
  ranAt: string | null
  commit: string | null
  stale: boolean
  costUsd: number | null
  error: string | null
}

export type FamilyScore = {
  family: string
  score: number | null
  rules: number
  failing: number
  pending: number
}

export type Scores = {
  overall: number | null
  families: FamilyScore[]
}

export type ConfigSource = 'file' | 'cli' | 'default'

export type Analysis = {
  root: string
  label: string
  config: ResolvedConfig
  configSource: ConfigSource
  configPath: string | null
  commit: string | null
  dirty: boolean
  analyzedAt: string
  durationMs: number
  ts: EngineResult['ts']
  stats: EngineStats
  graph: Graph
  files: FileNode[]
  functions: FunctionMetric[]
  rules: RuleResult[]
  scores: Scores
  baseline: Baseline | null
  audits: AuditsInfo
  distribution: { complexity: Distribution; fileLines: Distribution }
  describeCommand: string
  warnings: string[]
}

export type Bucket = { min: number; max: number | null; count: number }

export type Distribution = { buckets: Bucket[]; average: number; max: number; total: number }

export type AuditPreview = {
  id: string
  model: string
  budgetUsd: number
  prompt: string
  args: string[]
}

export type AuditsInfo = {
  schema: string
  tools: string[]
  items: AuditPreview[]
}

export type Baseline = {
  commit: string | null
  savedAt: string
  scores: Scores
  violations: Record<string, number>
}

export type RunEvent =
  | { type: 'start'; rule: string; kind: RuleKind; at: string }
  | { type: 'progress'; message: string }
  | { type: 'done'; result: RuleResult }
  | { type: 'error'; message: string }

export type Place = {
  kind: 'home' | 'cwd' | 'folder'
  name: string
  path: string
}

export type ClaudeStatus = { found: boolean; version: string | null }

export type ProjectsPayload = {
  cwd: string
  home: string
  default: string | null
  places: Place[]
  version: string
}

export type FolderEntry = {
  name: string
  path: string
  isProject: boolean
  isGit: boolean
  hasConfig: boolean
}

export type BrowsePayload = {
  path: string
  parent: string | null
  home: string
  isProject: boolean
  hasConfig: boolean
  directories: FolderEntry[]
}

export type FilePayload = {
  path: string
  text: string
}

export type DraftPayload = {
  config: AtlasConfig
  text: string
}

export type StrixSeverity = Severity | 'info'

export const STRIX_MODES = ['quick', 'standard', 'deep'] as const

export type StrixMode = (typeof STRIX_MODES)[number]

export type StrixTools = {
  strix: { found: boolean; version: string | null }
  docker: { found: boolean; running: boolean; version: string | null }
  llm: { model: string | null; apiKey: boolean; configFile: boolean }
}

export type StrixLocation = {
  file: string
  line: number
  endLine: number | null
  /** Whether the file exists in the project, so the page can open it. */
  exists: boolean
  label: string | null
  snippet: string | null
  fixBefore: string | null
  fixAfter: string | null
}

export type StrixFinding = {
  id: string
  title: string
  severity: StrixSeverity
  timestamp: string | null
  description: string | null
  impact: string | null
  technicalAnalysis: string | null
  poc: string | null
  pocCode: string | null
  remediation: string | null
  cvss: number | null
  cwe: string | null
  cve: string | null
  endpoint: string | null
  method: string | null
  confidence: string | null
  fixEffort: string | null
  locations: StrixLocation[]
  /** The finding's own Markdown report, absolute, for Claude to read. */
  reportPath: string
}

export type StrixRunSummary = {
  name: string
  status: string
  mode: string | null
  startedAt: string | null
  endedAt: string | null
  costUsd: number | null
  count: number
  bySeverity: Record<StrixSeverity, number>
}

export type StrixRun = StrixRunSummary & {
  instruction: string | null
  findings: StrixFinding[]
  report: string | null
}

export type StrixScanPhase = 'scanning' | 'done' | 'failed' | 'cancelled'

export type StrixScan = {
  running: boolean
  phase: StrixScanPhase
  mode: StrixMode
  budgetUsd: number
  startedAt: string
  endedAt: string | null
  files: number
  run: string | null
  costUsd: number | null
  findings: number
  exitCode: number | null
  error: string | null
  log: string[]
}

export type StrixCiStep = {
  file: string
  line: number
  headless: boolean
  mode: string | null
  failOn: string | null
  budget: string | null
}

export type StrixCiFile = {
  file: string
  provider: 'github' | 'gitlab' | 'jenkins' | 'circleci' | 'bitbucket' | 'azure'
  steps: StrixCiStep[]
  cloud: boolean
  secrets: boolean
  pullRequests: boolean | null
  fullHistory: boolean | null
}

export type StrixSkill = { name: string; scope: 'project' | 'user'; path: string }

export type StrixIntegration = {
  ci: StrixCiFile[]
  skills: StrixSkill[]
  /** Whether git ignores the reports; null outside a git repository. */
  reportsIgnored: boolean | null
  rootRuns: { present: boolean; ignored: boolean | null }
}

export type SecurityPayload = {
  runsDir: string
  scan: StrixScan | null
  runs: StrixRunSummary[]
  run: StrixRun | null
  integration: StrixIntegration
}

export type StrixScanRequest = { mode: StrixMode; budgetUsd: number; instruction: string }
