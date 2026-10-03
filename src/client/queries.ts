import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import {
  createConfig,
  fetchAnalysis,
  fetchBrowse,
  fetchClaudeStatus,
  fetchDraft,
  fetchFile,
  fetchProjects,
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
