export const configHelpEn = {
  nav: 'On this page',
  introTitle: 'What is the config for?',
  intro:
    'code-atlas.json describes the architecture you want: how files group into features, which layers those features belong to, and which rules to check. It is what decides what turns red.',
  withoutConfig:
    'Without a file, code-atlas guesses: one feature per folder, and dependency levels instead of layers. It still sees cycles and mutual dependencies, but not what climbs back up.',
  withConfig:
    'This project has its own config: the layers, exceptions and rules below come from the file.',
  steps: {
    draft: {
      title: 'Look at a draft',
      text: 'code-atlas proposes a config from the current graph.',
      action: 'Generate a draft',
    },
    create: {
      title: 'Create the file',
      text: 'Writes code-atlas.json at the project root, from the draft. It does not overwrite an existing file.',
      action: 'Create code-atlas.json',
      done: 'The file exists: code-atlas reads it on every analysis.',
      confirm: 'Create code-atlas.json at the root of this project?',
    },
    claude: {
      title: 'Improve it with Claude Code',
      text: 'Open Claude Code in the project with this prompt, or copy it: Claude will describe your real layers and add rules.',
    },
    reanalyse: {
      title: 'Re-analyse',
      text: 'The graph and the scores follow the new config.',
      action: 'Re-analyse',
    },
  },
  json: { show: 'See the JSON', hide: 'Hide the JSON', copy: 'Copy the JSON' },
  claudePrompt: (p: {
    root: string
    target: string
    exists: boolean
    describe: string
    context: string
  }) =>
    [
      `In the project ${p.root}, ${p.exists ? 'improve' : 'create'} the file ${p.target}: it describes the project’s architecture for the code-atlas tool (features, layers, exceptions, rules).`,
      '',
      'Start by running this command. It prints the full file format and the project’s current state (features, layers, red edges with the imports behind them, rules, scores):',
      p.describe,
      '',
      'What to do:',
      '1. "features": patterns grouping files into meaningful features.',
      '2. "layers": the layers from top to bottom with meaningful names; "siblings": true when the features of a layer must stay independent.',
      '3. "allow": only the dependencies accepted despite the layers, each one justified in your answer.',
      '4. "rules": keep the default rules; add "forbid-import" rules for important boundaries and "pattern" rules for code to ban.',
      'Rely on the code, the project’s CLAUDE.md and its lint rules when there are some.',
      '',
      'Then run the command again: fix any config error, and check that every remaining red edge is a real problem in the code, not a layering mistake. End with a summary of what you changed and why.',
      '',
      'Current state:',
      p.context,
    ].join('\n'),
  context: {
    features: (n: number, layers: string) => `- ${n} features; layers: ${layers}`,
    noLayers: 'none',
    unlayered: (ids: string) => `- Unlayered: ${ids}`,
    red: (n: number, list: string) => `- Red edges (${n}): ${list}`,
    noRed: '- No red edge.',
    scores: (line: string) => `- Scores: ${line}`,
  },
  scope: {
    title: 'Scope',
    text: 'The files analysed: what the include patterns cover, minus what the exclude patterns remove, read through the project’s tsconfig.',
    include: 'Included',
    exclude: 'Excluded',
    tsconfig: 'tsconfig',
    files: (n: number) => `${n.toLocaleString('en-GB')} files analysed`,
  },
  features: {
    title: 'Features',
    text: 'How files group together. Patterns apply in order; “*” stands for one folder: src/components/* makes one feature per subfolder of components.',
    fallback: 'Other folders',
    count: (n: number) => `${n} ${n === 1 ? 'feature' : 'features'}`,
  },
  layers: {
    title: 'Layers',
    text: 'From top to bottom: a feature should only depend on the layers below it. A “siblings” layer also forbids links between its own features.',
    none: 'No layers: the graph shows dependency levels and the upward-imports rule does not apply. Generate a draft to start from.',
    siblings: 'independent siblings',
    unlayered: 'Unlayered',
    top: 'top of the stack',
    bottom: 'foundation',
  },
  allow: {
    title: 'Exceptions',
    text: 'Dependencies accepted despite the layers — a factory that knows both implementations, for instance. They show as dashed lines.',
    none: 'No exception.',
  },
  rules: {
    title: 'Rules',
    text: 'What code-atlas checks and how much each rule weighs in the score. Without a list in the file, a default set applies.',
    id: 'Rule',
    kind: 'Type',
    severity: 'Severity',
    params: 'Setting',
    family: 'Family',
    seeRules: 'See the results',
  },
  ai: {
    title: 'AI audits',
    text: 'Defaults for the AI rules: the Claude model, the spending cap per audit and the language of the findings.',
    model: 'Model',
    budget: 'Cap per audit',
    language: 'Language',
  },
  aiAudits: {
    title: 'AI audit settings',
    what: 'An AI audit is a rule checked by Claude instead of a script: Claude reads the code from the angle given by the rule’s prompt and returns its findings (file, line, message). It runs on demand from the Rules tab and counts in the “AI audits” family.',
  },
  file: {
    title: 'The full file',
    text: 'The config as code-atlas applies it, defaults included.',
  },
  draft: {
    title: 'Draft',
    text: 'The draft follows the current structure: it sorts features into layers by dependency depth and adds the default rules. A starting point to correct, not the truth.',
    regenerate: 'Generate again',
  },
  reference: {
    title: 'Key reference',
    key: 'Key',
    role: 'Role',
    fallback: 'Default',
    rows: [
      ['include', 'Patterns of the files to analyse.', 'src/**'],
      ['exclude', 'Patterns to skip (tests, declarations…).', '**/*.test.*, **/*.d.ts…'],
      ['tsconfig', 'The tsconfig used to resolve imports.', 'tsconfig.json'],
      ['features', 'Patterns grouping files into features.', 'guessed from the folders'],
      ['layers', 'The layers, top to bottom, with their features.', 'none'],
      ['allow', '[from, to] pairs accepted despite the layers.', 'none'],
      ['rules', 'The rules to check.', 'default set'],
      ['ai', 'Model, cap and language of the AI audits.', 'sonnet · $1 · English'],
    ] as [string, string, string][],
  },
  kinds: {
    layers: 'Layers',
    mutual: 'Mutual',
    siblings: 'Siblings',
    'no-cycle': 'Cycles',
    'forbid-import': 'Forbidden import',
    'max-lines': 'File size',
    complexity: 'Complexity',
    'max-params': 'Parameters',
    pattern: 'Pattern',
    command: 'Command',
    ai: 'AI audit',
  } as Record<string, string>,
  params: {
    maxLines: (n: number) => `${n} lines max`,
    complexity: (n: number) => `complexity ${n} max`,
    maxParams: (n: number) => `${n} parameters max`,
    budget: (usd: string) => `cap ${usd}`,
  },
}
