import { useSyncExternalStore } from 'react'
import { storedStore } from './stored'

export type Theme = 'system' | 'light' | 'dark'

export const THEMES: Theme[] = ['light', 'system', 'dark']

const store = storedStore<Theme>({
  key: 'code-atlas.theme',
  parse: (saved) => (saved === 'light' || saved === 'dark' ? saved : 'system'),
  serialize: (value) => (value === 'system' ? null : value),
})

const apply = (value: Theme) => {
  if (value === 'system') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = value
}

apply(store.get())

export const setTheme = (next: Theme) => {
  if (next === store.get()) return
  apply(next)
  store.set(next)
}

export const useTheme = () => useSyncExternalStore(store.subscribe, store.get)
