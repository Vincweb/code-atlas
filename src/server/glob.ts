const cache = new Map<string, RegExp>()

const escape = (text: string) => text.replace(/[.+^$()|[\]\\]/g, '\\$&')

const expandBraces = (pattern: string): string[] => {
  const match = /\{([^{}]*)\}/.exec(pattern)
  if (!match) return [pattern]
  const before = pattern.slice(0, match.index)
  const after = pattern.slice(match.index + match[0].length)
  return (match[1] ?? '').split(',').flatMap((option) => expandBraces(before + option + after))
}

const toSource = (pattern: string) => {
  let source = ''
  for (let index = 0; index < pattern.length; index++) {
    const char = pattern[index]
    if (char === '*') {
      if (pattern[index + 1] === '*') {
        const slashAfter = pattern[index + 2] === '/'
        source += slashAfter ? '(?:.*/)?' : '.*'
        index += slashAfter ? 2 : 1
      } else source += '[^/]*'
    } else if (char === '?') source += '[^/]'
    else source += escape(char ?? '')
  }
  return source
}

export const globToRegExp = (pattern: string) => {
  const cached = cache.get(pattern)
  if (cached) return cached
  const regexp = new RegExp(`^(?:${expandBraces(pattern).map(toSource).join('|')})$`)
  cache.set(pattern, regexp)
  return regexp
}

export const matchGlob = (path: string, pattern: string) => globToRegExp(pattern).test(path)

export const matchAny = (path: string, patterns: readonly string[]) =>
  patterns.some((pattern) => matchGlob(path, pattern))

export const featureOf = (file: string, patterns: readonly string[]) => {
  const fileSegments = file.split('/')
  for (const pattern of patterns) {
    const segments = pattern.replace(/\/+$/, '').split('/')
    if (fileSegments.length <= segments.length) {
      if (!segments.includes('*') && file === pattern) return pattern
      continue
    }
    const bound = segments.every(
      (segment, index) => segment === '*' || segment === fileSegments[index],
    )
    if (bound) return fileSegments.slice(0, segments.length).join('/')
  }
  return fileSegments.slice(0, -1).join('/') || '.'
}
