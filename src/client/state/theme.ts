import { useSyncExternalStore } from 'react'

export type Theme = 'system' | 'light' | 'dark'

export const THEMES: Theme[] = ['light', 'system', 'dark']
const STORAGE_KEY = 'code-atlas.theme'

const read = (): Theme => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    return 'system'
  }
  return 'system'
}

const apply = (value: Theme) => {
  if (value === 'system') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = value
}

let theme = read()
apply(theme)
const listeners = new Set<() => void>()

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const setTheme = (next: Theme) => {
  if (next === theme) return
  theme = next
  apply(next)
  try {
    if (next === 'system') localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, next)
  } catch {
    return
  } finally {
    for (const listener of listeners) listener()
  }
}

export const useTheme = () => useSyncExternalStore(subscribe, () => theme)
