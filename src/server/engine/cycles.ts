export const findCycles = (edges: Map<string, Set<string>>): string[][] => {
  const index = new Map<string, number>()
  const low = new Map<string, number>()
  const onStack = new Set<string>()
  const stack: string[] = []
  const cycles: string[][] = []
  let counter = 0

  for (const start of edges.keys()) {
    if (index.has(start)) continue
    const frames: { node: string; targets: string[]; next: number }[] = []
    const enter = (node: string) => {
      index.set(node, counter)
      low.set(node, counter)
      counter++
      stack.push(node)
      onStack.add(node)
      frames.push({ node, targets: [...(edges.get(node) ?? [])], next: 0 })
    }
    enter(start)
    while (frames.length > 0) {
      const frame = frames[frames.length - 1]
      if (!frame) break
      const target = frame.targets[frame.next++]
      if (target !== undefined) {
        if (!index.has(target)) enter(target)
        else if (onStack.has(target)) {
          low.set(frame.node, Math.min(low.get(frame.node) ?? 0, index.get(target) ?? 0))
        }
        continue
      }
      frames.pop()
      const parent = frames[frames.length - 1]
      if (parent) {
        low.set(parent.node, Math.min(low.get(parent.node) ?? 0, low.get(frame.node) ?? 0))
      }
      if (low.get(frame.node) === index.get(frame.node)) {
        const component: string[] = []
        for (let member = stack.pop(); member !== undefined; member = stack.pop()) {
          onStack.delete(member)
          component.push(member)
          if (member === frame.node) break
        }
        if (component.length > 1 || edges.get(frame.node)?.has(frame.node)) {
          cycles.push(component.sort())
        }
      }
    }
  }
  return cycles.sort((a, b) => b.length - a.length || (a[0] ?? '').localeCompare(b[0] ?? ''))
}
