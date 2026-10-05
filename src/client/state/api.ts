import { API, rootQuery } from '../../shared/routes'
import type {
  Analysis,
  BrowsePayload,
  ClaudeStatus,
  DraftPayload,
  FilePayload,
  ProjectsPayload,
  SecurityPayload,
  StrixScan,
  StrixScanRequest,
  StrixTools,
} from '../../shared/types'

const errorIn = (payload: unknown) =>
  typeof payload === 'object' &&
  payload !== null &&
  'error' in payload &&
  typeof payload.error === 'string'
    ? payload.error
    : null

const read = async <T>(url: string): Promise<T> => {
  const response = await fetch(url)
  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) throw new Error(errorIn(payload) ?? `${url} answered ${response.status}`)
  return payload as T
}

export const fetchProjects = () => read<ProjectsPayload>(API.projects)

export const fetchClaudeStatus = () => read<ClaudeStatus>(API.claude)

export const fetchBrowse = (path: string) =>
  read<BrowsePayload>(`${API.browse}?path=${encodeURIComponent(path)}`)

export const fetchAnalysis = (root: string) => read<Analysis>(`${API.analysis}${rootQuery(root)}`)

export const fetchDraft = (root: string) => read<DraftPayload>(`${API.draft}${rootQuery(root)}`)

const post = async <T>(url: string, body?: unknown): Promise<T> => {
  const response = await fetch(url, {
    method: 'POST',
    ...(body === undefined
      ? {}
      : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
  })
  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) throw new Error(errorIn(payload) ?? `${url} answered ${response.status}`)
  return payload as T
}

export const createConfig = (root: string) =>
  post<{ path: string }>(`${API.createConfig}${rootQuery(root)}`)

export const openInClaude = (root: string, prompt: string) =>
  post<{ opened: true }>(`${API.claudeOpen}${rootQuery(root)}`, { prompt })

export const fetchFile = (root: string, path: string) =>
  read<FilePayload>(`${API.file}${rootQuery(root)}&path=${encodeURIComponent(path)}`)

export const runUrl = (root: string, rule: string) =>
  `${API.run}${rootQuery(root)}&rule=${encodeURIComponent(rule)}`

export const fetchSecurity = (root: string, run: string | null) =>
  read<SecurityPayload>(
    `${API.security}${rootQuery(root)}${run ? `&run=${encodeURIComponent(run)}` : ''}`,
  )

export const fetchStrixTools = (fresh: boolean) =>
  read<StrixTools>(`${API.securityTools}${fresh ? '?fresh=1' : ''}`)

export const startScan = (root: string, request: StrixScanRequest) =>
  post<{ scan: StrixScan }>(`${API.securityScan}${rootQuery(root)}`, request)

export const cancelScan = (root: string) =>
  post<{ cancelled: boolean }>(`${API.securityCancel}${rootQuery(root)}`)
