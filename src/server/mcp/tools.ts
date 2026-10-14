import type { EdgeClass } from '../../shared/types'

/** What `code-atlas mcp` offers: each tool's name, what it answers and the shape of its input. */
export const MAX_VIOLATIONS = 50
export const MAX_EDGES = 40

export const INSTRUCTIONS = `code-atlas maps a TypeScript project: its files grouped into features, the features placed in layers, the imports between them, and the rules of code-atlas.json scored over it. Start with \`overview\`, then \`violations\` or \`edges\` for the detail, and \`check\` after editing to see whether anything regressed against the baseline. Read \`config\` before editing code-atlas.json. Every tool analyses the project afresh, which takes a few seconds on a large one.`

const ROOT = {
  type: 'string',
  description:
    'The project folder, absolute or relative to the working directory. Defaults to the project the server was started on.',
}
const PACKAGE = {
  type: 'string',
  description:
    'In a monorepo, scope the answer to one package, by its folder ("apps/web"): its own files, features, rules and scores.',
}

export const EDGE_CLASSES: (EdgeClass | 'red' | 'all')[] = [
  'red',
  'all',
  'up',
  'mutual',
  'sibling',
  'lateral',
  'down',
  'allowed',
  'unlayered',
  'junction',
]

export const TOOLS = [
  {
    name: 'overview',
    description:
      'The state of the project: scores per family, every rule with its status and violation count, the packages of a monorepo, and the recent history of the overall score.',
    inputSchema: {
      type: 'object',
      properties: { root: ROOT, package: PACKAGE },
      additionalProperties: false,
    },
  },
  {
    name: 'violations',
    description:
      'The violations of the rules, each with its file and line. Filter by rule id or file glob; capped, with the total.',
    inputSchema: {
      type: 'object',
      properties: {
        root: ROOT,
        package: PACKAGE,
        rule: { type: 'string', description: 'A rule id, as in code-atlas.json ("ARCH-LAYERS").' },
        file: { type: 'string', description: 'A glob over file paths ("src/components/**").' },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 500,
          description: `Default ${MAX_VIOLATIONS}.`,
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'edges',
    description:
      'The dependencies between features, with the import statements behind each. By default the red ones: those that climb a layer ("up") or go both ways ("mutual"). The database graph, where an edge is a foreign key, with graph: "database".',
    inputSchema: {
      type: 'object',
      properties: {
        root: ROOT,
        package: PACKAGE,
        graph: { type: 'string', enum: ['code', 'database'], description: 'Default "code".' },
        class: {
          type: 'string',
          enum: EDGE_CLASSES,
          description: '"red" (up and mutual, the default), "all", or one class.',
        },
        feature: { type: 'string', description: 'Keep the edges touching this feature id.' },
        limit: { type: 'integer', minimum: 1, maximum: 500, description: `Default ${MAX_EDGES}.` },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'feature',
    description:
      'One feature: its layer, its files, its coupling (afferent, efferent, instability), its edges in and out, and its doc — the README.md, AGENTS.md or CLAUDE.md of its folder, or where the config\'s "docs" says — with what it says the feature is for.',
    inputSchema: {
      type: 'object',
      properties: {
        root: ROOT,
        id: { type: 'string', description: 'The feature id, a path ("src/components/cart").' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'check',
    description:
      'Run the rules and compare with the baseline, as `code-atlas --check` does: the regressions, if any, the rules the baseline does not count yet (newRules: reported, not checked), and the scores. Static rules only unless commands is true, which also runs the command rules (lint, types, tests) of the config.',
    inputSchema: {
      type: 'object',
      properties: {
        root: ROOT,
        commands: { type: 'boolean', description: 'Also run the command rules. Default false.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'config',
    description:
      'The format of code-atlas.json, and the effective config of the project with where it comes from. Read it before editing the config.',
    inputSchema: { type: 'object', properties: { root: ROOT }, additionalProperties: false },
  },
  {
    name: 'describe',
    description:
      'The config reference and the current state as one text, what `code-atlas describe` prints.',
    inputSchema: { type: 'object', properties: { root: ROOT }, additionalProperties: false },
  },
] as const

export type ToolName = (typeof TOOLS)[number]['name']
