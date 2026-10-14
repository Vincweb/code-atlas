import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import type { ResolvedConfig } from '../src/shared/config'
import { DEFAULT_DOCS, docCandidates, linkTarget, withoutFrontMatter } from '../src/shared/docs'
import type { EngineResult } from '../src/shared/types'
import { loadConfig } from '../src/server/config'
import { featureDocs, findDoc, parseDoc } from '../src/server/engine/docs'
import { evaluateStatic } from '../src/server/rules/static'

const tempProject = () => fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-docs-')))

const write = (root: string, file: string, text: string) => {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
  fs.writeFileSync(path.join(root, file), text)
}

test('the candidates fill {feature} and {name}, the root feature included', () => {
  assert.deepEqual(docCandidates('src/components/cart', DEFAULT_DOCS), [
    'src/components/cart/README.md',
    'src/components/cart/AGENTS.md',
    'src/components/cart/CLAUDE.md',
  ])
  assert.deepEqual(
    docCandidates('src/cart', ['docs/features/{name}.md', '.kiro/specs/{name}/design.md']),
    ['docs/features/cart.md', '.kiro/specs/cart/design.md'],
  )
  assert.deepEqual(docCandidates('.', ['{feature}/README.md']), ['README.md'])
})

test('the front matter gives the definition, a block scalar folded into one line', () => {
  const doc = parseDoc(
    [
      '---',
      'title: "Cart"',
      'description: >',
      '  Holds what the customer picked',
      '  until checkout.',
      'owner: shop-team',
      "status: 'stable'",
      '---',
      '# Shopping cart',
      '',
      'The first paragraph, unused here.',
    ].join('\n'),
  )
  assert.deepEqual(doc, {
    title: 'Cart',
    description: 'Holds what the customer picked until checkout.',
    owner: 'shop-team',
    status: 'stable',
  })
})

test('without a front matter, the first heading and the first paragraph of prose stand in', () => {
  const doc = parseDoc(
    [
      '[![build](https://example.com/badge.svg)](https://example.com)',
      '<p align="center"><img src="logo.png"></p>',
      '',
      '# Checkout',
      '',
      '```ts',
      'not prose',
      '```',
      '',
      'Turns a **cart** into an [order](../orders/README.md),',
      'and charges the `card`.',
      '',
      'A second paragraph.',
    ].join('\n'),
  )
  assert.equal(doc.title, 'Checkout')
  assert.equal(doc.description, 'Turns a cart into an order, and charges the card.')
  assert.equal(doc.owner, null)
  assert.equal(parseDoc('## Only a subheading\n').description, null)
  assert.ok((parseDoc('x '.repeat(400)).description ?? '').endsWith('…'))
})

test('the body is rendered without its front matter', () => {
  assert.equal(withoutFrontMatter('---\na: b\n---\n# Title\n'), '# Title\n')
  assert.equal(withoutFrontMatter('# No front matter\n'), '# No front matter\n')
})

test('the first template found wins; a dot folder is read, never a file outside the project', () => {
  const root = tempProject()
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-outside-'))
  try {
    write(root, 'src/cart/AGENTS.md', '# Agents\n')
    write(root, 'src/cart/README.md', '# Readme\n')
    write(root, 'src/orders/AGENTS.md', '# Orders\n')
    write(root, '.kiro/specs/billing/design.md', '# Billing\n')
    write(root, 'src/notes/README.txt', 'not markdown\n')
    write(outside, 'README.md', '# Secret\n')
    fs.mkdirSync(path.join(root, 'src/linked'), { recursive: true })
    fs.symlinkSync(path.join(outside, 'README.md'), path.join(root, 'src/linked/README.md'))

    assert.equal(findDoc(root, 'src/cart', DEFAULT_DOCS)?.path, 'src/cart/README.md')
    assert.equal(findDoc(root, 'src/orders', DEFAULT_DOCS)?.path, 'src/orders/AGENTS.md')
    assert.equal(
      findDoc(root, 'src/billing', ['.kiro/specs/{name}/design.md'])?.path,
      '.kiro/specs/billing/design.md',
    )
    assert.equal(findDoc(root, 'src/notes', ['{feature}/README.txt']), null)
    assert.equal(findDoc(root, 'src/linked', DEFAULT_DOCS), null)
    assert.equal(findDoc(root, '../outside', DEFAULT_DOCS), null)

    const docs = featureDocs(root, ['src/cart', 'src/none', 'src/cart'], DEFAULT_DOCS)
    assert.deepEqual(
      docs.map((doc) => [doc.id, doc.path, doc.title]),
      [
        ['src/cart', 'src/cart/README.md', 'Readme'],
        ['src/none', null, null],
      ],
    )
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
    fs.rmSync(outside, { recursive: true, force: true })
  }
})

test('a relative link resolves from the doc, a leading slash from the root', () => {
  assert.equal(linkTarget('src/cart/README.md', './cart.ts'), 'src/cart/cart.ts')
  assert.equal(linkTarget('src/cart/README.md', '../orders/README.md#api'), 'src/orders/README.md')
  assert.equal(linkTarget('src/cart/README.md', '/docs/design.md'), 'docs/design.md')
  assert.equal(linkTarget('src/cart/README.md', 'my%20file.ts'), 'src/cart/my file.ts')
  assert.equal(linkTarget('README.md', '../outside.md'), null)
})

test('the config takes docs as Markdown paths, and defaults to the feature folder', () => {
  const root = tempProject()
  try {
    write(root, 'package.json', '{}')
    assert.deepEqual(loadConfig(root).config.docs, DEFAULT_DOCS)
    write(root, 'code-atlas.json', JSON.stringify({ docs: ['docs/{name}.txt'] }))
    assert.throws(() => loadConfig(root), /docs must name Markdown files/)
    write(
      root,
      'code-atlas.json',
      JSON.stringify({
        docs: ['docs/features/{name}.md'],
        rules: [{ id: 'D', family: 'architecture', severity: 'low', kind: 'docs', nope: 1 }],
      }),
    )
    assert.throws(() => loadConfig(root), /rule D: unknown field nope/)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

const engineWith = (packages: boolean): EngineResult => ({
  ts: { version: '5', projects: [] },
  files: [
    {
      path: 'apps/web/src/cart/a.ts',
      feature: 'apps/web/src/cart',
      package: packages ? 'apps/web' : null,
      lines: 1,
    },
    {
      path: 'apps/web/src/lib/b.ts',
      feature: 'apps/web/src/lib',
      package: packages ? 'apps/web' : null,
      lines: 1,
    },
    {
      path: 'apps/web/src/ui/c.ts',
      feature: 'apps/web/src/ui',
      package: packages ? 'apps/web' : null,
      lines: 1,
    },
  ],
  imports: [],
  graph: {
    layers: [],
    features: ['apps/web/src/cart', 'apps/web/src/lib', 'apps/web/src/ui'].map((id) => ({
      id,
      layer: null,
      files: 1,
      lines: 1,
      ca: 0,
      ce: 0,
      instability: 0,
    })),
    edges: [],
    cycles: [],
  },
  functions: [],
  stats: { files: 3, lines: 3, imports: 0, typeImports: 0, features: 3, functions: 0 },
  packages: packages ? [{ dir: 'apps/web', name: 'web' }] : [],
  database: null,
  docs: [
    {
      id: 'apps/web/src/cart',
      path: 'apps/web/src/cart/README.md',
      title: null,
      description: null,
      owner: null,
      status: null,
    },
    {
      id: 'apps/web/src/lib',
      path: null,
      title: null,
      description: null,
      owner: null,
      status: null,
    },
    {
      id: 'apps/web/src/ui',
      path: null,
      title: null,
      description: null,
      owner: null,
      status: null,
    },
    { id: 'apps/web', path: null, title: null, description: null, owner: null, status: null },
  ],
  warnings: [],
})

const configWith = (features?: string): ResolvedConfig => ({
  include: [],
  exclude: [],
  tsconfig: 'tsconfig.json',
  workspaces: [],
  features: [],
  docs: ['{feature}/README.md', 'docs/{name}.md'],
  layers: [],
  allow: [],
  rules: [
    {
      id: 'DOCS',
      family: 'architecture',
      severity: 'low',
      kind: 'docs',
      ...(features ? { features } : {}),
    },
  ],
  ai: { model: 'sonnet', language: 'English' },
  database: { config: null, features: null, layers: [], allow: [], junctions: [] },
})

test('the docs rule reports each feature without a doc, not the packages', () => {
  const [rule] = evaluateStatic(
    { root: '/proj', config: configWith(), commit: null },
    engineWith(false),
  )
  assert.equal(rule?.count, 2)
  assert.deepEqual(
    rule?.violations.map((violation) => violation.message),
    [
      'apps/web/src/lib has no doc: add apps/web/src/lib/README.md',
      'apps/web/src/ui has no doc: add apps/web/src/ui/README.md',
    ],
  )
  const [narrowed] = evaluateStatic(
    { root: '/proj', config: configWith('**/ui'), commit: null },
    engineWith(false),
  )
  assert.equal(narrowed?.count, 1)
})

test('in a monorepo, a missing doc counts against the package of its feature', () => {
  const [rule] = evaluateStatic(
    { root: '/proj', config: configWith(), commit: null },
    engineWith(true),
  )
  assert.deepEqual(rule?.packages, { 'apps/web': 2 })
  assert.equal(rule?.unattributed, 0)
})
