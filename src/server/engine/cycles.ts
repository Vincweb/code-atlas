import { stronglyConnected } from '../../shared/graph'

export const findCycles = (edges: Map<string, Set<string>>): string[][] =>
  stronglyConnected(edges.keys(), edges)
    .filter(([first, ...rest]) => rest.length > 0 || (!!first && edges.get(first)?.has(first)))
    .map((component) => component.sort())
    .sort((a, b) => b.length - a.length || (a[0] ?? '').localeCompare(b[0] ?? ''))
