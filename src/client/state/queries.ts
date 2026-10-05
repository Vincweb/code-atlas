import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import type { StrixScanRequest } from '../../shared/types'
import {
  cancelScan,
  createConfig,
  fetchAnalysis,
  fetchBrowse,
  fetchClaudeStatus,
  fetchDraft,
  fetchFile,
  fetchProjects,
  fetchSecurity,
  fetchStrixTools,
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
    () => client.invalidateQueries({ queryKey: analysisKey(root) }),
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

export const useFile = (root: string, path: string) =>
  useQuery({
    queryKey: ['file', root, path],
    queryFn: () => fetchFile(root, path),
    staleTime: 10_000,
  })

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
