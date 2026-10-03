import { API, rootQuery } from '../shared/routes'
import type {
  Analysis,
  BrowsePayload,
  ClaudeStatus,
  DraftPayload,
  FilePayload,
  ProjectsPayload,
} from '../shared/types'

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

export const createConfig = async (root: string) => {
  const response = await fetch(`${API.createConfig}${rootQuery(root)}`, { method: 'POST' })
  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok)
    throw new Error(errorIn(payload) ?? `${API.createConfig} answered ${response.status}`)
  return payload as { path: string }
}

export const fetchFile = (root: string, path: string) =>
  read<FilePayload>(`${API.file}${rootQuery(root)}&path=${encodeURIComponent(path)}`)

export const runUrl = (root: string, rule: string) =>
  `${API.run}${rootQuery(root)}&rule=${encodeURIComponent(rule)}`
