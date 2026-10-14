import { useSyncExternalStore } from 'react'
import { storedStore } from './stored'

export type RecentProject = {
  root: string
  label: string
  openedAt: string
  overall: number | null
}

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

const store = storedStore<RecentProject[]>({
  key: 'code-atlas.recent',
  parse: (saved) => {
    try {
      const raw: unknown = JSON.parse(saved ?? '[]')
      return Array.isArray(raw) ? raw.filter(isRecent) : []
    } catch {
      return []
    }
  },
  serialize: (value) => JSON.stringify(value),
})

export const rememberProject = (entry: Omit<RecentProject, 'openedAt'>) => {
  const others = store.get().filter((item) => item.root !== entry.root)
  store.set([{ ...entry, openedAt: new Date().toISOString() }, ...others].slice(0, MAX_RECENT))
}

export const forgetProject = (root: string) =>
  store.set(store.get().filter((item) => item.root !== root))

export const useRecentProjects = () => useSyncExternalStore(store.subscribe, store.get)
