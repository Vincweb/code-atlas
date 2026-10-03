import type { EdgeClass } from '../../shared/types'
import { learnEn } from './learn.en'
import { configHelpEn } from './configHelp.en'
import { auditsEn } from './audits.en'

/**
 * Every word the page shows, in English. The French file mirrors this object key for key, and the
 * type check keeps the two in step. Strings that need a number or a name are functions.
 */
export const en = {
  locale: 'en-GB',

  titles: { welcome: 'code-atlas — map and audit a TypeScript codebase' },

  common: {
    retry: 'Retry',
    cancel: 'Cancel',
    copy: 'Copy',
    copied: 'Copied',
    loading: 'Loading…',
    notRun: 'not run',
    unlayered: 'Unlayered',
    none: 'none',
  },

  welcome: {
    madeFor: 'Made for TypeScript projects and Claude Code · MIT',
    hasConfig: 'configured',
    localOnly: 'Reads your code locally; writes only under .code-atlas/ when you run a rule.',
  },

  prefs: {
    theme: 'Theme',
    themes: { light: 'Light', system: 'System', dark: 'Dark' },
    language: 'Language',
  },

  recent: {
    title: 'Recent projects',
    empty: 'No project opened yet. Browse your folders to pick one — it will show up here.',
    remove: 'Remove from recent projects',
    score: 'Overall score at the last analysis',
  },

  explorer: {
    show: 'Browse my folders',
    hide: 'Hide the explorer',
    title: 'Explore your folders',
    places: 'Places',
    home: 'Home',
    filter: 'Filter this folder…',
    editPath: 'Type a path',
    pathLabel: 'Folder path',
    go: 'Go',
    up: 'Parent folder',
    open: 'Open',
    thisIsProject: 'This folder is a TypeScript project.',
    empty: 'No subfolders here.',
    noMatch: 'No folder matches.',
    project: 'TypeScript',
    git: 'git',
    hint: '↑ ↓ to move · Enter to go in · ⌘/Ctrl + Enter to open · ⌫ to go up',
  },

  landing: {
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
        text: 'Lint, types, tests: your scripts become rules. AI audits read the code through Claude Code — read-only, with a spending cap.',
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
  },

  project: {
    back: 'Projects',
    analysing: 'Analysing the project…',
    modified: 'modified',
    analysedIn: (duration: string) => `analysed in ${duration}`,
    reanalyse: 'Re-analyse',
  },

  tabs: {
    label: 'Project sections',
    overview: 'Overview',
    graph: 'Graph',
    rules: 'Rules',
    audits: 'AI audits',
    metrics: 'Metrics',
    config: 'Config',
  },

  families: {
    architecture: 'Architecture',
    'clean-code': 'Clean code',
    tooling: 'Tooling',
    ai: 'AI audits',
  } as Record<string, string>,

  severity: { critical: 'critical', high: 'high', medium: 'medium', low: 'low' },

  status: { pass: 'pass', fail: 'fail', 'not-run': 'not run', error: 'error' },

  ruleTitles: {
    layers: 'Upward imports',
    mutual: 'Mutual dependencies',
    siblings: 'Sibling coupling',
    noCycle: 'Import cycles',
    forbid: (from: string, to: string) => `Forbidden imports ${from} → ${to}`,
    maxLines: (max: number) => `Files over ${max} lines`,
    complexity: (max: number) => `Functions over complexity ${max}`,
    maxParams: (max: number) => `Functions with more than ${max} parameters`,
    pattern: (pattern: string) => `Pattern /${pattern}/`,
    aiArch: 'Architecture review by Claude',
    aiClean: 'Clean code review by Claude',
  },

  learn: learnEn,

  overview: {
    overall: 'Overall score',
    files: 'Files',
    lines: 'Lines',
    imports: 'Imports',
    typeImports: 'Type imports',
    features: 'Features',
    functions: 'Functions',
    cycles: 'Cycles',
    warnings: (n: number) => `${n} ${n === 1 ? 'warning' : 'warnings'}`,
  },

  rules: {
    summary: (total: number) => `${total} rules`,
    failingCount: (n: number) => `${n} failing`,
    passingCount: (n: number) => `${n} passing`,
    pendingCount: (n: number) => `${n} not run`,
    filters: { all: 'All', fail: 'Failing', pass: 'Passing', pending: 'Not run' },
    allFamilies: 'All families',
    search: 'Find a rule…',
    intro:
      'Every rule starts at 100 and loses points with each violation, faster when it is severe. Expand a rule to see what it checks and every case.',
    noMatch: 'No rule matches these filters.',
    files: (n: number) => `${n} ${n === 1 ? 'file' : 'files'}`,
    showAllFiles: (n: number) => `Show all ${n} files`,
    showLess: 'Show less',
    never: 'never run',
    lastRun: (when: string) => `ran ${when}`,
    seeAudits: 'AI audits',
    fixTitle: 'Fix with Claude',
    fixText: 'Claude gets the rule, how to fix it and the list of cases, then fixes the code.',
    fixPrompt: (p: {
      root: string
      id: string
      title: string
      what: string
      fix: string
      describe: string
      count: number
      list: string
    }) =>
      [
        `In the project ${p.root}, fix the violations of the code-atlas rule ${p.id} — ${p.title}.`,
        `What it reports: ${p.what}`,
        `How to fix it: ${p.fix}`,
        `For context (layers, edges, rules), run: ${p.describe}`,
        '',
        `Violations (${p.count}):`,
        p.list,
        '',
        'Fix the code, not code-atlas.json. Keep the behaviour identical and check with the project’s lint and tests. Then run the command again to confirm the violations are gone, and sum up your changes.',
      ].join('\n'),
    connectionLost: 'The connection to the server was lost.',
    cancelled: 'Cancelled.',
    running: 'Running…',
    cancel: 'Cancel',
    stale: 'stale',
    violations: (n: number) => `${n} ${n === 1 ? 'violation' : 'violations'}`,
    run: 'Run',
    showing: (shown: number, total: number) => `Showing ${shown} of ${total}`,
    runAllCommands: 'Run all commands',
    cancelAll: (left: number) => `Cancel the run (${left} left)`,
  },

  metrics: {
    intro:
      'The raw numbers of the code: size, complexity and coupling of each part. They score nothing on their own; the rules build on them.',
    tiles: {
      files: 'Files',
      filesHint: 'source files analysed',
      lines: 'Lines',
      linesHint: (avg: string) => `${avg} per file on average`,
      functions: 'Functions',
      complexity: 'Average complexity',
      complexityHint: (max: number) => `max ${max}`,
      features: 'Features',
      featuresHint: (n: number) => `${n} ${n === 1 ? 'layer' : 'layers'}`,
      noLayers: 'no layers',
      instability: 'Average instability',
      instabilityHint: '0 stable · 1 unstable',
    },
    complexityTitle: 'Function complexity',
    complexityText:
      'The number of possible paths through a function (if, loops, ?:, &&…). Past 10 it is hard to test, past 15 hard to read.',
    sizeTitle: 'File size',
    sizeText: 'A long file usually mixes several responsibilities.',
    aboveLimit: (n: number, max: number, id: string) => `${n} above ${max} (rule ${id})`,
    bucket: (min: number, max: number | null) => (max === null ? `${min}+` : `${min}–${max}`),
    countFunctions: (n: number) => `${n} ${n === 1 ? 'function' : 'functions'}`,
    countFiles: (n: number) => `${n} ${n === 1 ? 'file' : 'files'}`,
    features: 'Features',
    featuresText:
      'Each feature with its size and coupling. “Used by” (Ca): how many features depend on it. “Depends on” (Ce): how many it depends on. Instability = Ce / (Ca + Ce): near 0, a foundation everything depends on; near 1, a feature that depends on everything and nothing uses.',
    search: 'Filter features…',
    feature: 'Feature',
    layer: 'Layer',
    files: 'Files',
    lines: 'Lines',
    ca: 'Used by',
    ce: 'Depends on',
    instability: 'Instability',
    topFunctions: 'Most complex functions',
    topFunctionsText: 'The top 30; the mark shows the complexity rule’s limit.',
    largestFiles: 'Largest files',
    largestFilesText: 'The top 20; the mark shows the file size rule’s limit.',
    limit: (max: number) => `limit ${max}`,
    paramsCount: (n: number) => `${n} params`,
    linesCount: (n: number) => `${n} lines`,
  },

  claude: {
    open: 'Open in Claude Code',
    opened: 'Opened in the Claude app',
    failed: (reason: string) =>
      `The Claude app did not open (${reason}). Check that it is installed, or copy the prompt.`,
    copy: 'Copy the prompt',
    copied: 'Prompt copied',
    show: 'See the prompt',
    hide: 'Hide the prompt',
    hint: 'The button opens a session in the Code tab of the Claude app, with this prompt ready to send; the app asks you to confirm the folder. Otherwise, copy it into any Claude conversation.',
  },

  audits: auditsEn,

  configHelp: configHelpEn,

  config: {
    sources: {
      file: 'Read from the project’s config file',
      cli: 'Read from a file given on the command line',
      default: 'Default configuration (no config file found)',
    },
    generate: 'Generate a draft',
    draftHint: (file: string) => `Save it as ${file} at the project root, then correct it.`,
  },

  viewer: { close: 'Close' },

  edgeClass: {
    down: 'down',
    up: 'up',
    mutual: 'mutual',
    sibling: 'sibling',
    lateral: 'lateral',
    allowed: 'allowed',
    unlayered: 'unlayered',
  } satisfies Record<EdgeClass, string>,

  graph: {
    unlayered: 'Unlayered',
    depth: (n: number) => `Level ${n + 1}`,
    edgeTitle: (from: string, to: string, weight: number) =>
      `${from} → ${to} · ${weight} ${weight === 1 ? 'import' : 'imports'}`,
    files: (n: number) => `${n} ${n === 1 ? 'file' : 'files'}`,
    instabilityHelp:
      'Instability = Ce / (Ca + Ce): 0 when everything depends on it, 1 when it depends on everything.',
    dependsOn: (n: number) => `Depends on (${n})`,
    usedBy: (n: number) => `Used by (${n})`,
    problemImports: 'Imports behind the red edges',
    clickHint: 'Hover a feature to see its links; click it for the details.',
    close: 'Close',
    mostCoupled: 'Most coupled features',
    coupling: (ca: number, ce: number) => `${ca} incoming · ${ce} outgoing`,
    cycles: (n: number) => `File cycles (${n})`,
    noCycles: 'No file cycle.',
    redEdges: (n: number) => `Red edges (${n})`,
    noRedEdges: 'No upward or mutual dependency.',
    noLayersBanner:
      'No layers configured: each band is a dependency level, and level 1 holds what nothing depends on. Describe your layers to see what climbs back up.',
    openConfig: 'Open the config',
    modes: { all: 'All', problems: 'Problems only' },
    minWeight: (n: number) => `Min. imports: ${n}`,
    minWeightHelp: 'Hide the grey links with fewer imports than this. Red and amber stay.',
    search: 'Find a feature…',
    showHelp: 'How to read this graph',
    hideHelp: 'Hide the help',
    panel: 'Details',
    collapsePanel: 'Collapse the panel',
    expandPanel: 'Open the panel',
    empty: 'No feature found.',
    help: [
      ['A box is a feature', 'A folder grouping one piece of functionality, with its file count.'],
      [
        'An arrow is an import',
        'From the feature that imports to the one it imports. The thicker it is, the more import statements behind it.',
      ],
      [
        'Red, amber, grey',
        'Red climbs back up a layer or goes both ways. Amber links two sibling features. Grey is a normal dependency; dashed, an allowed one.',
      ],
      [
        'Hover, click, search',
        'Hovering a feature isolates its links and shows their weight. Clicking opens its details. The search dims everything else.',
      ],
    ] as [string, string][],
    helpLayers: [
      'Bands are your layers',
      'From the top of the stack, at the top, down to the foundation, at the bottom. A healthy arrow always points down.',
    ] as [string, string],
    helpDepth: [
      'Bands are levels',
      'Without layers, a feature sits one band below the deepest feature importing it. Arcs inside one band go both ways.',
    ] as [string, string],
    legend: {
      red: 'climbs back up / both ways',
      amber: 'between siblings',
      grey: 'normal',
      light: 'allowed / unlayered',
      flagged: 'feature involved in a red edge',
    },
  },
}

export type Strings = typeof en
