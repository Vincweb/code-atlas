export const WELCOME_PATH = '/'

export const PROJECT_PATH = '/project'

export const TABS = ['overview', 'graph', 'rules', 'audits', 'metrics', 'config'] as const

export type Tab = (typeof TABS)[number]

export const rootQuery = (root: string) => `?root=${encodeURIComponent(root).replace(/%2F/g, '/')}`

export const projectPath = (root: string, tab: Tab = 'overview', rule?: string) =>
  `${PROJECT_PATH}${rootQuery(root)}${tab === 'overview' ? '' : `&tab=${tab}`}${
    rule ? `&rule=${encodeURIComponent(rule)}` : ''
  }`

export const API = {
  projects: '/api/projects',
  browse: '/api/browse',
  analysis: '/api/analysis',
  draft: '/api/draft',
  createConfig: '/api/config/create',
  file: '/api/file',
  run: '/api/run',
  claude: '/api/claude',
} as const
