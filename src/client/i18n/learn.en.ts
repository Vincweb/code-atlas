const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export const learnEn = {
  bands: { good: 'Good', warn: 'Watch', bad: 'Needs work', none: 'Incomplete' },
  verdict: {
    good: 'The code is in good shape.',
    warn: 'The code holds, but some things are slipping.',
    bad: 'The code needs attention.',
    none: 'No rule has a result yet.',
  },
  strongest: (family: string, score: number) => `Strongest: ${family} (${score}).`,
  weakest: (family: string, score: number) => `Weakest: ${family} (${score}).`,
  tally: (failing: number, total: number, pending: number) =>
    `${plural(failing, 'rule', 'rules')} failing out of ${total}${
      pending ? `, ${pending} not run yet` : ''
    }.`,
  sinceBaseline: (diff: number) =>
    diff === 0
      ? 'Same as the baseline.'
      : `${diff > 0 ? '+' : ''}${diff} points since the baseline.`,

  howTitle: 'How is this score computed?',
  how: [
    'Every rule starts at 100 and loses half its score with each step of problems: 1 for a critical rule, 3 for a high one, 6 for a medium one, 12 for a low one. A score never reaches zero, so every fix shows.',
    'A family is the average of its rules, weighted by severity (critical ×8, high ×4, medium ×2, low ×1). A rule that has not run yet does not count.',
    'The overall score is the average of the families that have a result.',
  ],
  tableHead: ['Severity', 'Score halves every', 'Weight in its family'] as [string, string, string],
  problems: (n: number) => plural(n, 'problem', 'problems'),
  scale: '80 and above: good · 50 to 79: watch · below 50: needs work.',

  familiesTitle: 'The families',
  familyText: {
    architecture: 'Whether your layers hold: what climbs back up, what goes both ways, cycles.',
    'clean-code':
      'How readable the code is: file size, function complexity and signatures, banned patterns.',
    tooling: 'Your project’s own commands — lint, types, tests — run as rules.',
    ai: 'Reviews by Claude, on demand, of what a rule cannot measure.',
  } as Record<string, string>,
  familyIdle: {
    tooling: 'Not run yet: commands run from the Rules tab.',
    ai: 'Not run yet: each audit costs a little, so it runs on demand.',
    other: 'No result yet.',
  },
  seeRules: 'See the rules',

  prioritiesTitle: 'Where to start',
  prioritiesText: 'The failing rules that weigh most on the score, best return first.',
  noPriorities: 'No failing rule: nothing urgent.',
  gain: (points: number) => `up to +${points} on its family`,
  what: 'What it means',
  why: 'Why it matters',
  fix: 'How to fix it',
  seeCases: (n: number) => `See ${plural(n, 'case', 'cases')}`,
  seeGraph: 'See it in the graph',
  kinds: {
    layers: {
      what: 'An import going from a lower layer up to a higher one.',
      why: 'The bottom of the stack should know nothing of the top, or changing a screen breaks the foundation.',
      fix: 'Move the shared code down, or invert the dependency (callback, injection, event).',
    },
    mutual: {
      what: 'Two features of the same layer importing each other.',
      why: 'They can no longer change, be tested or move separately.',
      fix: 'Extract what they share into a third feature, or keep a single direction.',
    },
    siblings: {
      what: 'A feature importing another one of its layer, where they should stay independent.',
      why: 'Each link between siblings makes the next one harder to isolate.',
      fix: 'Go through a lower layer (shared UI, state) instead of reaching into the neighbour.',
    },
    'no-cycle': {
      what: 'A loop of imports between files: A imports B, which ends up importing A.',
      why: 'Load order becomes fragile and the code impossible to split.',
      fix: 'Move the shared piece into a file both of them import.',
    },
    'forbid-import': {
      what: 'An import your config explicitly forbids.',
      why: 'It is a boundary you chose to protect.',
      fix: 'Cross it through the interface meant for it.',
    },
    'max-lines': {
      what: 'A file longer than the limit.',
      why: 'A long file usually mixes several responsibilities and reads poorly.',
      fix: 'Split it by responsibility: one component, hook or helper per file.',
    },
    complexity: {
      what: 'A function with too many possible paths (if, loops, ?:, &&…).',
      why: 'Each path is a case to understand and test; past 15, bugs hide there.',
      fix: 'Extract sub-functions, return early, replace conditions with a lookup table.',
    },
    'max-params': {
      what: 'A function taking too many parameters.',
      why: 'Calls become hard to read and argument order a source of mistakes.',
      fix: 'Group the parameters into one named object.',
    },
    pattern: {
      what: 'A code pattern you chose to ban (any, for instance).',
      why: 'It bypasses a guarantee, often the type system’s.',
      fix: 'Replace each occurrence with the safe form.',
    },
    command: {
      what: 'One of your project’s commands failed.',
      why: 'A red lint, type check or test is a problem your tools already found.',
      fix: 'Open the command’s output in the Rules tab and fix the errors it lists.',
    },
    ai: {
      what: 'A problem Claude found while reading the code.',
      why: 'It covers what an automatic rule cannot measure: naming, responsibilities, intent.',
      fix: 'Read each finding: they are leads to weigh, not verdicts.',
    },
  } as Record<string, { what: string; why: string; fix: string }>,

  stepsTitle: 'Next steps',
  stepsDone: (done: number, total: number) => `${done} of ${total} done`,
  steps: {
    layers: {
      title: 'Describe your layers',
      done: 'Your layers are described.',
      todo: 'Without layers, code-atlas cannot tell what is up and what is down. Start from the generated draft.',
      action: 'Open the config',
    },
    commands: {
      title: 'Run your commands',
      done: 'Your commands have run.',
      todo: 'Lint, types, tests: run them once to complete the tooling family.',
      action: 'Go to the rules',
    },
    ai: {
      title: 'Try an AI audit',
      done: 'An AI audit has run.',
      todo: 'Claude reads the code from one angle, with a spending cap.',
      action: 'Go to the rules',
    },
    baseline: {
      title: 'Save a baseline',
      done: 'A baseline exists: changes are measured against it.',
      todo: 'Freeze the current state; from then on only a regression fails CI.',
    },
    ci: {
      title: 'Wire it into CI',
      text: 'Add this to your pipeline: it fails as soon as a rule has more violations than the baseline.',
    },
  },

  figuresTitle: 'The project in numbers',
  figures: {
    files: 'source files analysed',
    lines: 'lines, comments included',
    imports: 'links between files at runtime',
    typeImports: 'type imports, which couple nothing once compiled',
    features: 'features, per your config',
    functions: 'functions measured',
    cycles: 'import loops between files',
  },

  glossaryTitle: 'Glossary',
  glossary: [
    [
      'Feature',
      'A folder grouping one piece of functionality, defined by the config’s “features” patterns.',
    ],
    ['Layer', 'A level of the architecture. A feature should only depend on the layers below it.'],
    ['Upward dependency', 'An import going from the bottom of the stack to the top.'],
    ['Mutual dependency', 'Two features importing each other.'],
    ['Sibling features', 'Features of one layer marked “siblings”, which should stay independent.'],
    [
      'Instability',
      'The share of outgoing dependencies: near 0, a foundation everything depends on; near 1, a feature that depends on everything.',
    ],
    ['Complexity', 'The number of execution paths through a function.'],
    ['Baseline', 'A committed snapshot of violations that --check compares against.'],
  ] as [string, string][],
}
