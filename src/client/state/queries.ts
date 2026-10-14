import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { isActive } from '../../shared/runs'
import type { RunsPayload } from '../../shared/runs'
import type { StrixScanRequest } from '../../shared/types'
import {
  cancelRuns,
  cancelScan,
  createConfig,
  fetchAnalysis,
  fetchBrowse,
  fetchClaudeStatus,
  fetchDoc,
  fetchDraft,
  fetchFile,
  fetchMigrations,
  fetchMigrationSql,
  fetchProjects,
  fetchRuns,
  fetchSecurity,
  fetchStrixTools,
  startRuns,
  startScan,
} from './api'

export const analysisKey = (root: string) => ['analysis', root] as const

export const useProjects = () => useQuery({ queryKey: ['projects'], queryFn: fetchProjects })

export const useClaudeStatus = () =>
  useQuery({ queryKey: ['claude'], queryFn: fetchClaudeStatus, staleTime: 60_000 })

export const useBrowse = (path: string) =>
  useQuery({
    queryKey: ['browse', path],
    queryFn: () => fetchBrowse(path),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })

export const useAnalysis = (root: string) =>
  useQuery({
    queryKey: analysisKey(root),
    queryFn: () => fetchAnalysis(root),
    staleTime: Infinity,
  })

export const useInvalidateAnalysis = (root: string) => {
  const client = useQueryClient()
  return useCallback(
    () =>
      Promise.all([
        client.invalidateQueries({ queryKey: analysisKey(root) }),
        client.invalidateQueries({ queryKey: ['migrations', root] }),
      ]),
    [client, root],
  )
}

export const useDraft = (root: string) => useMutation({ mutationFn: () => fetchDraft(root) })

export const useCreateConfig = (root: string) => {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => createConfig(root),
    onSuccess: () => client.invalidateQueries({ queryKey: analysisKey(root) }),
  })
}

export const useMigrations = (root: string, enabled: boolean) =>
  useQuery({
    queryKey: ['migrations', root],
    queryFn: () => fetchMigrations(root),
    enabled,
    staleTime: Infinity,
  })

export const useMigrationSql = (root: string, folder: string) =>
  useQuery({
    queryKey: ['migration', root, folder],
    queryFn: () => fetchMigrationSql(root, folder),
    staleTime: Infinity,
  })

export const useFile = (root: string, path: string) =>
  useQuery({
    queryKey: ['file', root, path],
    queryFn: () => fetchFile(root, path),
    staleTime: 10_000,
  })

/** A feature's doc, read again on each analysis: the analysis key is its prefix. */
export const useDoc = (root: string, feature: string, path: string | null) =>
  useQuery({
    queryKey: [...analysisKey(root), 'doc', feature, path],
    queryFn: () => fetchDoc(root, feature),
    enabled: path !== null,
  })

const runsKey = (root: string) => ['runs', root] as const

const RUNS_POLL_MS = 1000

/**
 * The command and AI runs of the project, which the server drives whatever page is open; polled
 * while one is waiting or running. Every tab reads this one query.
 */
export const useRuns = (root: string) =>
  useQuery({
    queryKey: runsKey(root),
    queryFn: () => fetchRuns(root),
    refetchInterval: (query) => (query.state.data?.runs.some(isActive) ? RUNS_POLL_MS : false),
  })

/** Starting and cancelling answer the new list, which replaces the polled one at once. */
export const useRunActions = (root: string) => {
  const client = useQueryClient()
  const onSuccess = (payload: RunsPayload) => client.setQueryData(runsKey(root), payload)
  const start = useMutation({ mutationFn: (rules: string[]) => startRuns(root, rules), onSuccess })
  const cancel = useMutation({
    mutationFn: (rule: string | null) => cancelRuns(root, rule),
    onSuccess,
  })
  return { start, cancel }
}

const securityKey = (root: string) => ['security', root] as const

const SCAN_POLL_MS = 2000

/** The Security tab's data; polled while a scan runs, since the scan outlives the page. */
export const useSecurity = (root: string, run: string | null) =>
  useQuery({
    queryKey: [...securityKey(root), run],
    queryFn: () => fetchSecurity(root, run),
    placeholderData: keepPreviousData,
    refetchInterval: (query) => (query.state.data?.scan?.running ? SCAN_POLL_MS : false),
  })

export const useStrixTools = () => {
  const client = useQueryClient()
  const query = useQuery({
    queryKey: ['strix-tools'],
    queryFn: () => fetchStrixTools(false),
    staleTime: 60_000,
  })
  const recheck = useCallback(
    () => client.fetchQuery({ queryKey: ['strix-tools'], queryFn: () => fetchStrixTools(true) }),
    [client],
  )
  return { ...query, recheck }
}

export const useStartScan = (root: string) => {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (request: StrixScanRequest) => startScan(root, request),
    onSuccess: () => client.invalidateQueries({ queryKey: securityKey(root) }),
  })
}

export const useCancelScan = (root: string) => {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => cancelScan(root),
    onSuccess: () => client.invalidateQueries({ queryKey: securityKey(root) }),
  })
}
