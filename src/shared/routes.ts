export const WELCOME_PATH = '/'

export const PROJECT_PATH = '/project'

export const TABS = [
  'overview',
  'graph',
  'docs',
  'rules',
  'audits',
  'security',
  'metrics',
  'database',
  'config',
] as const

export type Tab = (typeof TABS)[number]

export const rootQuery = (root: string) => `?root=${encodeURIComponent(root).replace(/%2F/g, '/')}`

/** A tab of a project, scoped to one package of a monorepo when `pkg` names it. */
export const projectPath = (
  root: string,
  tab: Tab = 'overview',
  rule?: string | null,
  pkg?: string | null,
) =>
  `${PROJECT_PATH}${rootQuery(root)}${tab === 'overview' ? '' : `&tab=${tab}`}${
    pkg ? `&pkg=${encodeURIComponent(pkg).replace(/%2F/g, '/')}` : ''
  }${rule ? `&rule=${encodeURIComponent(rule)}` : ''}`

export const API = {
  projects: '/api/projects',
  browse: '/api/browse',
  analysis: '/api/analysis',
  draft: '/api/draft',
  createConfig: '/api/config/create',
  file: '/api/file',
  doc: '/api/doc',
  runs: '/api/runs',
  run: '/api/run',
  runCancel: '/api/run/cancel',
  claude: '/api/claude',
  claudeOpen: '/api/claude/open',
  security: '/api/security',
  securityTools: '/api/security/tools',
  securityScan: '/api/security/scan',
  securityCancel: '/api/security/cancel',
  migrations: '/api/migrations',
  migrationSql: '/api/migration',
} as const

const CLAUDE_PROMPT_LIMIT = 14000

export const claudeLink = (prompt: string, folder: string) =>
  `claude://code/new?q=${encodeURIComponent(prompt.slice(0, CLAUDE_PROMPT_LIMIT))}&folder=${encodeURIComponent(folder)}`
