import { useSyncExternalStore } from 'react'

export type RecentProject = {
  root: string
  label: string
  openedAt: string
  overall: number | null
}

const STORAGE_KEY = 'code-atlas.recent'
const MAX_RECENT = 8

const isRecent = (value: unknown): value is RecentProject =>
  typeof value === 'object' &&
  value !== null &&
  'root' in value &&
  typeof value.root === 'string' &&
  'label' in value &&
  typeof value.label === 'string' &&
  'openedAt' in value &&
  typeof value.openedAt === 'string'

const read = (): RecentProject[] => {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(raw) ? raw.filter(isRecent) : []
  } catch {
    return []
  }
}

let recent = read()
const listeners = new Set<() => void>()

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const write = (next: RecentProject[]) => {
  recent = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    return
  } finally {
    for (const listener of listeners) listener()
  }
}

export const rememberProject = (entry: Omit<RecentProject, 'openedAt'>) => {
  const others = recent.filter((item) => item.root !== entry.root)
  write([{ ...entry, openedAt: new Date().toISOString() }, ...others].slice(0, MAX_RECENT))
}

export const forgetProject = (root: string) => write(recent.filter((item) => item.root !== root))

export const useRecentProjects = () => useSyncExternalStore(subscribe, () => recent)
