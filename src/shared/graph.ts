/**
 * Tarjan's strongly connected components. Iterative, so a long import chain cannot overflow the
 * stack. Every node reachable from `nodes` lands in exactly one component.
 */
export const stronglyConnected = (
  nodes: Iterable<string>,
  edges: Map<string, Iterable<string>>,
): string[][] => {
  const index = new Map<string, number>()
  const low = new Map<string, number>()
  const onStack = new Set<string>()
  const stack: string[] = []
  const components: string[][] = []
  const frames: { node: string; targets: string[]; next: number }[] = []

  const enter = (node: string) => {
    const order = index.size
    index.set(node, order)
    low.set(node, order)
    stack.push(node)
    onStack.add(node)
    frames.push({ node, targets: [...(edges.get(node) ?? [])], next: 0 })
  }
  const lower = (node: string, value: number | undefined) =>
    low.set(node, Math.min(low.get(node) ?? 0, value ?? 0))

  const leave = (node: string) => {
    const parent = frames[frames.length - 1]
    if (parent) lower(parent.node, low.get(node))
    if (low.get(node) !== index.get(node)) return
    const component: string[] = []
    for (let member = stack.pop(); member !== undefined; member = stack.pop()) {
      onStack.delete(member)
      component.push(member)
      if (member === node) break
    }
    components.push(component)
  }

  for (const start of nodes) {
    if (index.has(start)) continue
    enter(start)
    for (let frame = frames[frames.length - 1]; frame; frame = frames[frames.length - 1]) {
      const target = frame.targets[frame.next++]
      if (target === undefined) {
        frames.pop()
        leave(frame.node)
      } else if (!index.has(target)) enter(target)
      else if (onStack.has(target)) lower(frame.node, index.get(target))
    }
  }
  return components
}

/**
 * The depth of every node in the graph of its strongly connected components: 0 for a component
 * nothing imports, otherwise one more than the deepest component importing it.
 */
export const condensedDepths = (
  nodes: string[],
  edges: Map<string, Iterable<string>>,
): Map<string, number> => {
  const components = stronglyConnected(nodes, edges)
  const componentOf = new Map<string, number>()
  components.forEach((members, id) => members.forEach((node) => componentOf.set(node, id)))

  const next = components.map(() => new Set<number>())
  const incoming = components.map(() => 0)
  for (const [from, targets] of edges) {
    const a = componentOf.get(from) ?? 0
    for (const target of targets) {
      const b = componentOf.get(target) ?? 0
      if (a === b || next[a]?.has(b)) continue
      next[a]?.add(b)
      incoming[b] = (incoming[b] ?? 0) + 1
    }
  }

  const depth = components.map(() => 0)
  const ready = incoming.flatMap((count, id) => (count === 0 ? [id] : []))
  for (let id = ready.pop(); id !== undefined; id = ready.pop()) {
    for (const target of next[id] ?? []) {
      depth[target] = Math.max(depth[target] ?? 0, (depth[id] ?? 0) + 1)
      incoming[target] = (incoming[target] ?? 0) - 1
      if (incoming[target] === 0) ready.push(target)
    }
  }
  return new Map(nodes.map((node) => [node, depth[componentOf.get(node) ?? 0] ?? 0]))
}
