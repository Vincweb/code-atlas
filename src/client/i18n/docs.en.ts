import { plural } from './plural'
export type DraftFacts = {
  id: string
  path: string
  layer: string | null
  files: string[]
  dependsOn: string[]
  usedBy: string[]
}

const list = (items: string[]) => (items.length ? items.join(', ') : 'none')

export const docsEn = {
  intro:
    'What each feature is for, in its own words: the README.md, AGENTS.md or CLAUDE.md of its folder, or the file the config’s “docs” names. The doc sits next to the code, so it moves and goes with it — and the agents working in that folder read the same file.',
  packagesIntro:
    'One entry per package: its own doc. Open a package to see the docs of its features.',
  tiles: {
    features: 'Features',
    packages: 'Packages',
    documented: 'Documented',
    coverage: 'Coverage',
  },
  lookedFor: 'Looked for, in order',
  configure: 'Change it in the config',
  search: 'Find a feature…',
  filters: { all: 'All', missing: 'Without a doc' },
  noMatch: 'No feature matches.',
  noFeatures: 'No feature found.',
  read: 'Read the doc',
  write: 'Write its doc',
  noDoc: 'no doc',
  files: (n: number) => plural(n, 'file', 'files'),
  lines: (n: string) => `${n} lines`,
  usedBy: (n: number) => `used by ${n}`,
  dependsOn: (n: number) => `depends on ${n}`,
  status: 'status',
  owner: 'owner',
  openFile: 'Open the file',
  openPackage: 'Open this package',
  loadFailed: 'The doc could not be read.',
  image: (alt: string) => (alt ? `image: ${alt}` : 'image'),
  empty: {
    title: 'No doc yet',
    lookedFor: 'code-atlas looked for these files, in this order, and found none:',
    frontMatter:
      'Start it with a front matter: its description becomes the feature’s one-line definition, here, in the graph and for the agents.',
    claude: 'Or let Claude Code write it from the code:',
  },
  frontMatterExample: `---
description: One sentence on what this feature is for.
owner: team-or-person
status: stable
---
`,
  draftPrompt: (facts: DraftFacts) =>
    [
      `Write the doc of the feature ${facts.id} of this project, as ${facts.path}.`,
      '',
      'Open it with this front matter:',
      '---',
      'description: one sentence on what the feature is for',
      'owner: the team or the person who owns it, if the code says so; otherwise leave the line out',
      'status: stable, experimental or deprecated',
      '---',
      '',
      'Then, in a page at most: what the feature does and for whom, its entry points (the files other features import), what it depends on and why, and the rules a change to it must respect. Read the code first and describe what is there, not what should be.',
      '',
      'What code-atlas knows of it:',
      `- layer: ${facts.layer ?? 'none'}`,
      `- files (${facts.files.length}): ${list(facts.files)}`,
      `- depends on: ${list(facts.dependsOn)}`,
      `- used by: ${list(facts.usedBy)}`,
    ].join('\n'),
  ruleTitle: 'Undocumented features',
  missing: (n: number) => plural(n, 'feature without a doc', 'features without a doc'),
}
