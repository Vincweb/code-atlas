const example = {
  id: 'AI-ERRORS',
  family: 'ai',
  severity: 'medium',
  kind: 'ai',
  title: 'Error handling',
  prompt:
    'Review error handling: empty catch blocks, swallowed errors, messages without context. Do not report the catch blocks left empty on purpose around an optional storage.',
  files: 'src/**/*.{ts,tsx}',
  budgetUsd: 0.5,
}

export const auditsEn = {
  summary: (n: number, ran: number) => `${n} ${n === 1 ? 'audit' : 'audits'} · ${ran} run`,
  familyScore: 'AI audits score',
  spent: (usd: string) => `${usd} in total (estimate at API prices)`,
  runAll: (budget: string) => `Run every audit (max ${budget})`,
  runAllConfirm: (n: number, budget: string) =>
    `Run ${n} audits one after the other? They use your Claude usage, up to ${budget} in total.`,
  connection: {
    title: 'Connection',
    checking: 'Looking for Claude Code…',
    found: (version: string) => `Claude Code ${version} found`,
    missing: 'Claude Code not found',
    text: 'Audits go through your Claude Code: your subscription, or ANTHROPIC_API_KEY if you pay per use. No key to set up here.',
    missingText: 'Install Claude Code and sign in (run claude, then /login), then reload the page.',
    check: 'To check from a terminal:',
  },
  howTitle: 'How an AI audit works',
  findingsTitle: 'Findings',
  noFindings: 'No finding: Claude found nothing to report.',
  progressFiles: (n: number) => `${n} ${n === 1 ? 'file read' : 'files read'}`,
  progressSearches: (n: number) => `${n} ${n === 1 ? 'search' : 'searches'}`,
  ideasTitle: 'Audit ideas',
  ideasText: 'Ready-made audits. Add them with Claude Code, or copy the rule into code-atlas.json.',
  inConfig: 'already in the config',
  copyRule: 'Copy the rule',
  ruleCopied: 'Rule copied',
  addPrompt: (p: { root: string; target: string; rule: string; describe: string }) =>
    [
      `In the project ${p.root}, add this AI audit rule to the "rules" array of ${p.target}, changing nothing else:`,
      p.rule,
      `If the file has no "rules" array, run ${p.describe} first: without an array the default rules apply, so keep them alongside this one.`,
      'Then run the command again to check the config is still valid.',
    ].join('\n'),
  ideas: [
    {
      id: 'AI-ERRORS',
      title: 'Error handling',
      text: 'Empty catches, swallowed errors, messages without context.',
      severity: 'medium',
      prompt:
        'Review error handling: empty catch blocks or ones swallowing the error, promises never awaited, error messages without context, errors turned into success. Ignore catch blocks left empty on purpose with a comment.',
    },
    {
      id: 'AI-NAMING',
      title: 'Naming',
      text: 'Misleading, vague or abbreviated names.',
      severity: 'low',
      prompt:
        'Find misleading or vague names: functions whose name does not say what they do, booleans without an is/has/can prefix, obscure abbreviations, generic names (data, info, utils, helper). Suggest a better name in each finding.',
    },
    {
      id: 'AI-SECURITY',
      title: 'Security',
      text: 'Hard-coded secrets, injections, disabled checks.',
      severity: 'high',
      prompt:
        'Look for obvious flaws: hard-coded secrets or keys, user input injected into HTML, SQL or a shell command, disabled TLS or authentication checks, sensitive data in logs.',
    },
    {
      id: 'AI-RESPONSIBILITY',
      title: 'Responsibilities',
      text: 'Files and functions doing too much.',
      severity: 'medium',
      prompt:
        'Find files and components mixing several responsibilities (interface, network access, business logic), and functions over 50 lines doing several things. Say how to split them.',
    },
    {
      id: 'AI-DEAD',
      title: 'Dead and duplicated code',
      text: 'Code never used, copy-pasted blocks.',
      severity: 'low',
      prompt:
        'Find dead code (functions never called, impossible branches, ignored parameters) and duplicated blocks longer than 10 lines that should be factored out.',
    },
    {
      id: 'AI-CONVENTIONS',
      title: 'Project conventions',
      text: 'The code against the CLAUDE.md and the docs.',
      severity: 'medium',
      prompt:
        'Read the project’s CLAUDE.md and documentation, then report code that breaks the written conventions. Quote the convention in each finding.',
    },
    {
      id: 'AI-TESTS',
      title: 'Missing tests',
      text: 'Business logic without tests, tests checking nothing.',
      severity: 'medium',
      prompt:
        'Find non-trivial business logic (calculations, parsing, business rules) without any test, and tests that check nothing. Name the case to test in each finding.',
    },
    {
      id: 'AI-A11Y',
      title: 'Accessibility',
      text: 'Images without alternative, unnamed buttons, lost focus.',
      severity: 'medium',
      prompt:
        'In the interface components, find accessibility problems: images without alternative text, buttons without an accessible name, clickable elements that cannot take focus, forms without labels, content relying on colour alone.',
    },
  ] as {
    id: string
    title: string
    text: string
    severity: 'critical' | 'high' | 'medium' | 'low'
    prompt: string
  }[],
  intro:
    'An AI audit is a rule Claude checks by reading your code, where a script cannot judge: a misleading name, a function doing three things, a feature digging into another one’s internals. You write the instruction; code-atlas starts Claude, collects its findings and scores them like any other rule.',
  points: [
    ['Read by Claude', 'Claude Code explores the project read-only, like a human reviewer.'],
    ['Precise findings', 'Every problem comes back with a file, a line and a message.'],
    [
      'Scored, never blocking',
      'Findings count in the “AI audits” family, but --check ignores them: two runs can differ.',
    ],
  ] as [string, string][],
  pipelineTitle: 'How an audit runs',
  pipeline: [
    [
      'The prompt',
      'code-atlas assembles the rule’s instruction and a shared frame: scope, rigour, format, language.',
    ],
    [
      'Claude Code, read-only',
      'Started headless in the project folder with three tools only: Read, Grep, Glob. It cannot change anything.',
    ],
    [
      'A structured answer',
      'Claude must answer in the imposed JSON format: a list of findings { file, line, message }.',
    ],
    [
      'Score and history',
      'The result is kept per commit and turns “stale” when the code moves. It weighs in the AI audits score.',
    ],
  ] as [string, string][],
  inputsTitle: 'What Claude receives',
  inputs: [
    [
      'The system prompt',
      'Claude Code’s own, unchanged. It also loads the project’s CLAUDE.md when there is one, so the audit knows your conventions.',
    ],
    [
      'The audit prompt',
      'The instruction written in the rule, followed by the frame code-atlas adds. The exact text is on each audit below.',
    ],
    [
      'The answer format',
      'A JSON schema imposed with --json-schema: Claude can only return a list of findings.',
    ],
    [
      'Tools and limits',
      'Read, Grep and Glob only; no MCP server, no slash command, no saved session; a spending cap per audit.',
    ],
  ] as [string, string][],
  frame: 'The frame code-atlas adds to every prompt',
  showSchema: 'See the schema',
  hideSchema: 'Hide the schema',
  listTitle: 'This project’s audits',
  listText: 'Each audit is an “ai” rule of code-atlas.json. Run it here or from the Rules tab.',
  none: 'No AI audit in the config.',
  rulePrompt: 'The rule’s instruction',
  showFull: 'See the full prompt',
  hideFull: 'Hide the full prompt',
  showCommand: 'See the command',
  hideCommand: 'Hide the command',
  run: (budget: string) => `Run the audit (max ${budget})`,
  results: 'See the findings',
  lastRun: (when: string) => `Last run ${when}`,
  neverRun: 'Never run',
  model: 'Model',
  cap: 'Cap',
  settingsTitle: 'Settings',
  settingsText:
    'Defaults for every audit, under the “ai” key of code-atlas.json. Each rule can set its own model and cap.',
  costTitle: 'Cost and safety',
  cost: [
    'An audit uses your own Claude Code login: code-atlas handles no key.',
    'The cap is checked between two of Claude’s steps, so an audit can end slightly above it.',
    'Nothing starts on its own: an audit runs on a click, after confirming its budget.',
  ],
  createTitle: 'Write your own audit',
  createText:
    'Add a rule with "kind": "ai" to code-atlas.json. The prompt tells Claude what to look for; code-atlas provides the rest.',
  example: JSON.stringify(example, null, 2),
  createPrompt: (root: string, describe: string) =>
    [
      `In the project ${root}, add to code-atlas.json an AI audit rule ("kind": "ai", family "ai") that checks <what you want>.`,
      `First run ${describe}: it prints the rule format (including "ai") and the project’s current state.`,
      'Write a precise prompt: what to look for, what does not count as a problem, and how to word a finding.',
      'Keep the JSON valid.',
    ].join('\n'),
}
