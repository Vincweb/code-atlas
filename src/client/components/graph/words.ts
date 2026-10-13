import { createContext, useContext } from 'react'
import { useT } from '../../i18n'
import type { Strings } from '../../i18n'

export type GraphWords = Strings['graph']

/**
 * The words the graph components use, so the same components draw the import graph ("3 files",
 * "imports behind the red edges") and the database graph ("3 tables", "foreign keys behind…").
 */
export const GraphWordsContext = createContext<Partial<GraphWords> | null>(null)

export const useGraphWords = (): GraphWords => {
  const t = useT()
  const overrides = useContext(GraphWordsContext)
  return overrides ? { ...t.graph, ...overrides } : t.graph
}
