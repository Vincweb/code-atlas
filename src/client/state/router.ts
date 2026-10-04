import { useSyncExternalStore } from 'react'
import { PROJECT_PATH, TABS } from '../../shared/routes'
import type { Tab } from '../../shared/routes'

export type Route = {
  view: 'welcome' | 'project'
  root: string
  tab: Tab
  rule: string | null
}

const isTab = (value: string | null): value is Tab => TABS.some((tab) => tab === value)

const parse = (): Route => {
  const url = new URL(window.location.href)
  const pathname = url.pathname.replace(/\/+$/, '') || '/'
  const tab = url.searchParams.get('tab')
  return {
    view: pathname === PROJECT_PATH ? 'project' : 'welcome',
    root: url.searchParams.get('root') ?? '',
    tab: isTab(tab) ? tab : 'overview',
    rule: url.searchParams.get('rule'),
  }
}

/** One snapshot for the page, at module level, so every component sees the same URL. */
let route = parse()
const listeners = new Set<() => void>()

const publish = () => {
  route = parse()
  for (const listener of listeners) listener()
}

window.addEventListener('popstate', publish)

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const useRoute = () => useSyncExternalStore(subscribe, () => route)

export const navigate = (to: string, { replace = false }: { replace?: boolean } = {}) => {
  if (replace) window.history.replaceState(null, '', to)
  else window.history.pushState(null, '', to)
  publish()
}
