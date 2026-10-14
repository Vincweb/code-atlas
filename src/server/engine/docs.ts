import { readFileSync, realpathSync, statSync } from 'node:fs'
import { relative, resolve, sep } from 'node:path'
import { DOC_EXTENSION, FRONT_MATTER, docCandidates } from '../../shared/docs'
import type { FeatureDoc } from '../../shared/docs'

const MAX_DOC_BYTES = 1_000_000
const MAX_DESCRIPTION = 280

const isInside = (root: string, file: string) => file.startsWith(root + sep)

/**
 * The text of a doc, or null when the path is not one: not Markdown, outside the project once
 * links are followed, under node_modules, not a file, or too large. Dot folders are read, since
 * spec tools keep their files there (`.kiro/specs`); only Markdown is, whatever the template says.
 */
const readDocFile = (root: string, candidate: string): string | null => {
  if (!DOC_EXTENSION.test(candidate)) return null
  const file = resolve(root, candidate)
  if (!isInside(root, file) || relative(root, file).split(sep).includes('node_modules')) return null
  try {
    if (!isInside(realpathSync(root), realpathSync(file))) return null
    const stat = statSync(file)
    if (!stat.isFile() || stat.size > MAX_DOC_BYTES) return null
    return readFileSync(file, 'utf8')
  } catch {
    return null
  }
}

/** The first doc found for a feature, from the config's ordered templates. */
export const findDoc = (root: string, id: string, templates: readonly string[]) => {
  for (const path of docCandidates(id, templates)) {
    const text = readDocFile(root, path)
    if (text !== null) return { path, text }
  }
  return null
}

const unquote = (value: string) => /^(['"])(.*)\1$/.exec(value)?.[2] ?? value

/** The indented lines a YAML block scalar (`description: >`) folds into one line. */
const blockScalar = (lines: string[], from: number) => {
  const taken: string[] = []
  for (let index = from; index < lines.length && /^\s+\S/.test(lines[index] ?? ''); index++)
    taken.push((lines[index] ?? '').trim())
  return taken.join(' ')
}

/**
 * The `key: value` pairs between two `---` at the very top, and the body after them. Read by
 * hand, like pnpm-workspace.yaml: no YAML dependency, and anything fancier is left alone.
 */
export const frontMatter = (text: string) => {
  const match = FRONT_MATTER.exec(text)
  if (!match) return { front: new Map<string, string>(), body: text }
  const front = new Map<string, string>()
  const lines = (match[1] ?? '').split(/\r?\n/)
  lines.forEach((line, index) => {
    const pair = /^([A-Za-z][\w-]*):[ \t]*(.*)$/.exec(line)
    if (!pair?.[1]) return
    const raw = (pair[2] ?? '').trim()
    const value = /^[>|][-+]?$/.test(raw) ? blockScalar(lines, index + 1) : unquote(raw)
    if (value) front.set(pair[1].toLowerCase(), value)
  })
  return { front, body: text.slice(match[0].length) }
}

/** Markdown inline syntax and HTML tags out, whitespace collapsed. */
const plain = (markdown: string) =>
  markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/(\*\*|__|\*|_|`)(.+?)\1/g, '$2')
    .replace(/\s+/g, ' ')
    .trim()

const clip = (text: string) =>
  text.length > MAX_DESCRIPTION ? `${text.slice(0, MAX_DESCRIPTION - 1).trimEnd()}…` : text

/** A line that is no prose: a heading, a list, a quote, a table, an image, a badge or HTML. */
const NOT_PROSE = /^(#|[-*+>|<!]|\d+[.)]\s|\[!\[)/

/** The first level-1 heading and the first paragraph of prose, outside code fences. */
const outline = (body: string) => {
  let title: string | null = null
  const paragraph: string[] = []
  let fenced = false
  for (const line of body.split(/\r?\n/)) {
    const text = line.trim()
    const fence = /^(```|~~~)/.test(text)
    if (fence) fenced = !fenced
    const prose = !fence && !fenced && text !== '' && !NOT_PROSE.test(text)
    if (prose) paragraph.push(text)
    else if (paragraph.length) break
    const heading = fence || fenced ? null : /^#\s+(.+?)\s*#*$/.exec(text)
    if (heading?.[1]) title ??= plain(heading[1])
  }
  return { title, paragraph: paragraph.join(' ') }
}

/** What a doc says of its feature: front matter first, then its heading and first paragraph. */
export const parseDoc = (text: string): Omit<FeatureDoc, 'id' | 'path'> => {
  const { front, body } = frontMatter(text)
  const { title, paragraph } = outline(body)
  const description = plain(front.get('description') ?? paragraph)
  return {
    title: front.get('title') ?? title,
    description: description ? clip(description) : null,
    owner: front.get('owner') ?? null,
    status: front.get('status') ?? null,
  }
}

/** The doc of each feature id, or a record of its absence. */
export const featureDocs = (
  root: string,
  ids: readonly string[],
  templates: readonly string[],
): FeatureDoc[] =>
  [...new Set(ids)].map((id) => {
    const found = findDoc(root, id, templates)
    if (!found) return { id, path: null, title: null, description: null, owner: null, status: null }
    return { id, path: found.path, ...parseDoc(found.text) }
  })
