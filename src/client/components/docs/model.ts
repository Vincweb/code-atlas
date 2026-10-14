import { useEffect, useState } from 'react'
import { FRONT_MATTER } from '../../../shared/docs'
import type { Analysis, FeatureDoc, FeatureNode } from '../../../shared/types'
import type { DraftFacts } from '../../i18n/docs.en'

export type Entry = { node: FeatureNode; doc: FeatureDoc | null }

export type Group = { name: string | null; entries: Entry[] }

const MAX_FILES = 40

export const isDocumented = (entry: Entry) => entry.doc?.path != null

/** The features as the tab lists them: by layer from the top of the stack, the unlayered last. */
export const groupsOf = (analysis: Analysis, unlayered: string): Group[] => {
  const docs = new Map(analysis.docs.map((doc) => [doc.id, doc]))
  const entries = analysis.graph.features.map((node) => ({ node, doc: docs.get(node.id) ?? null }))
  const { layers } = analysis.graph
  if (!layers.length) return [{ name: null, entries }]
  return [
    ...layers.map((layer, index) => ({
      name: layer.name,
      entries: entries.filter((entry) => entry.node.layer === index),
    })),
    { name: unlayered, entries: entries.filter((entry) => entry.node.layer === null) },
  ].filter((group) => group.entries.length > 0)
}

/** The folder every id sits under, shown once above the list rather than on every line. */
export const commonParent = (ids: string[]) => {
  const parents = ids.map((id) => id.split('/').slice(0, -1))
  const first = parents[0] ?? []
  let length = 0
  while (length < first.length && parents.every((parent) => parent[length] === first[length]))
    length++
  return first.slice(0, length).join('/')
}

export const shortId = (id: string, parent: string) =>
  parent && id.startsWith(`${parent}/`) ? id.slice(parent.length + 1) : id

/** Whether the doc's own front matter gives its description, which the body then leaves out. */
export const describesItself = (text: string) =>
  /^description:/m.test(FRONT_MATTER.exec(text)?.[1] ?? '')

/** What Claude Code is told of a feature it is asked to document. */
export const draftFacts = (
  analysis: Analysis,
  id: string,
  path: string,
  packagesView: boolean,
): DraftFacts => {
  const node = analysis.graph.features.find((feature) => feature.id === id)
  const files = analysis.files
    .filter((file) => (packagesView ? file.package === id : file.feature === id))
    .map((file) => file.path)
  return {
    id,
    path,
    layer: node?.layer == null ? null : (analysis.graph.layers[node.layer]?.name ?? null),
    files: files.length > MAX_FILES ? [...files.slice(0, MAX_FILES), '…'] : files,
    dependsOn: analysis.graph.edges.filter((edge) => edge.from === id).map((edge) => edge.to),
    usedBy: analysis.graph.edges.filter((edge) => edge.to === id).map((edge) => edge.from),
  }
}

const hashId = () => {
  try {
    return decodeURIComponent(window.location.hash.slice(1))
  } catch {
    return ''
  }
}

/**
 * The feature the URL's hash names, so a link from the graph lands on it and a reload keeps it;
 * a hash typed into the address bar moves it too.
 */
export const useHashSelection = () => {
  const [chosen, setChosen] = useState(hashId)
  useEffect(() => {
    const follow = () => setChosen(hashId())
    window.addEventListener('hashchange', follow)
    return () => window.removeEventListener('hashchange', follow)
  }, [])
  const select = (id: string) => {
    setChosen(id)
    const { pathname, search } = window.location
    window.history.replaceState(
      window.history.state,
      '',
      `${pathname}${search}#${encodeURIComponent(id)}`,
    )
  }
  return [chosen, select] as const
}
