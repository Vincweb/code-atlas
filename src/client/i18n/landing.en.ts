export const landingEn = {
  eyebrow: 'Architecture · Clean code · AI audits',
  title: 'See the shape of your code.',
  titleAccent: 'And where it is slipping.',
  lead: 'code-atlas reads your TypeScript project with its own compiler, groups files into features, places them in your layers and flags every dependency that climbs back up or goes round in circles. Scripted rules, your project’s commands and AI audits add up to one score per family.',
  cta: 'Open a project',
  copyCommand: 'Copy the command',
  copied: 'Copied',
  art: 'A feature graph in three layers: one dependency climbs back up, in red; two sibling features depend on each other, in amber.',
  scores: { architecture: 'Architecture', cleanCode: 'Clean code', tooling: 'Tooling' },
  featuresTitle: 'What it shows you',
  features: [
    {
      title: 'The feature graph',
      text: 'Folders become features, sorted into your layers. In red: what climbs back up a layer or loops between two features.',
    },
    {
      title: 'Rules that measure',
      text: 'Layers, cycles, complexity, size, forbidden patterns — computed on every analysis, down to the file and the line.',
    },
    {
      title: 'Your commands, and Claude',
      text: 'Lint, types, tests: your scripts become rules. AI audits read the code through Claude Code, read-only.',
    },
    {
      title: 'A score and a guard',
      text: 'One score per family, a baseline you commit, and a CI check that fails only when things get worse.',
    },
  ],
  stepsTitle: 'Up and running in three steps',
  steps: [
    { title: 'Run it', command: 'npx @vincweb/code-atlas', text: 'in your project’s folder.' },
    {
      title: 'Describe your layers',
      command: 'code-atlas.json',
      text: 'or start from the draft generated from your graph.',
    },
    {
      title: 'Lock it in',
      command: 'npx @vincweb/code-atlas --check',
      text: 'in CI, against the baseline you saved.',
    },
  ],
  trust: [
    '100% local',
    'Zero dependencies',
    'Your project’s own TypeScript',
    'AI through your Claude Code',
  ],
  openTitle: 'Open a project',
  openText: 'Pick up where you left off, or browse to any TypeScript project on this machine.',
  mcp: {
    title: 'Give Claude Code the map',
    text: 'code-atlas is also an MCP server: Claude Code reads the graph, the violations and the scores of the project while it works, and checks that nothing regressed before it stops. One command, from the project’s folder:',
    note: 'It writes .mcp.json at the project root — commit it, and every Claude Code session on the project gets the tools. No dependency, no key: the server runs on your machine.',
    tools: [
      ['overview', 'the scores, every rule with its count, the recent history'],
      ['violations', 'each one at file:line, by rule or file'],
      ['edges', 'the dependencies between features, the red ones first'],
      ['feature', 'one feature: its layer, files and coupling'],
      ['check', 'the ratchet against the baseline, as --check'],
      ['config', 'the format of code-atlas.json, before editing it'],
    ] as [string, string][],
  },
}
