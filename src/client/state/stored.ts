import { useState } from 'react'

/** localStorage, which a private window or a blocked site may refuse: then nothing was saved. */
const load = (key: string): string | null => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

const save = (key: string, value: string | null) => {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // Not remembering the choice is the only consequence.
  }
}

/** How a value is kept under its key; a value serialized to `null` removes the key. */
export type Stored<T> = {
  key: string
  parse: (saved: string | null) => T
  serialize: (value: T) => string | null
}

/** A value kept in localStorage that every component reading it follows, by `useSyncExternalStore`. */
export const storedStore = <T>({ key, parse, serialize }: Stored<T>) => {
  let value = parse(load(key))
  const listeners = new Set<() => void>()
  return {
    get: () => value,
    set: (next: T) => {
      value = next
      save(key, serialize(next))
      for (const listener of listeners) listener()
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

/** A component's own state kept in localStorage, so the page opens again as it was left. */
export const useStoredState = <T>({ key, parse, serialize }: Stored<T>) => {
  const [value, setValue] = useState(() => parse(load(key)))
  const update = (next: T) => {
    setValue(next)
    save(key, serialize(next))
  }
  return [value, update] as const
}
