/**
 * Where a feature's doc is looked for, in order, the first file found wins. `{feature}` is the
 * feature id, `{name}` its last segment: "docs/features/{name}.md", ".kiro/specs/{name}/design.md".
 */
export const DEFAULT_DOCS = ['{feature}/README.md', '{feature}/AGENTS.md', '{feature}/CLAUDE.md']

export const DOC_EXTENSION = /\.(md|mdx|markdown)$/i

/** A front matter: `key: value` lines between two `---`, at the very top of the file. */
export const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/

export const withoutFrontMatter = (text: string) => text.replace(FRONT_MATTER, '')

export type FeatureDoc = {
  /** A feature id, or in a monorepo a package folder. */
  id: string
  /** The doc found, relative to the root; null when the feature has none. */
  path: string | null
  /** The front matter's title, else the first level-1 heading. */
  title: string | null
  /** The front matter's description, else the first paragraph. */
  description: string | null
  owner: string | null
  status: string | null
}

export type DocPayload = { id: string; path: string; text: string }

const nameOf = (id: string) => id.split('/').filter(Boolean).pop() ?? id

const normalize = (path: string) =>
  path
    .split('/')
    .filter((segment) => segment !== '' && segment !== '.')
    .join('/')

/** The paths a feature's doc may sit at, relative to the root, in the order they are tried. */
export const docCandidates = (id: string, templates: readonly string[]) => [
  ...new Set(
    templates.map((template) =>
      normalize(template.replaceAll('{feature}', id).replaceAll('{name}', nameOf(id))),
    ),
  ),
]

const decoded = (text: string) => {
  try {
    return decodeURIComponent(text)
  } catch {
    return text
  }
}

/**
 * The project file a doc's relative link points to, from the root: relative to the doc's folder,
 * or to the root when it starts with `/`, as GitHub reads it. Null when it leaves the project.
 */
export const linkTarget = (docPath: string, href: string): string | null => {
  const target = decoded(href.split(/[?#]/)[0] ?? '')
  const parts = target.startsWith('/') ? [] : docPath.split('/').slice(0, -1)
  for (const segment of target.split('/')) {
    if (segment === '..') {
      if (parts.pop() === undefined) return null
    } else if (segment !== '' && segment !== '.') parts.push(segment)
  }
  return parts.join('/') || null
}
