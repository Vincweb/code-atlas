# Design

Decisions and external facts only — the code says what it does.

## Shape

A CLI that starts a local `node:http` server and serves a React page built by Vite, like
drizzle-graph and claude-context-viewer. **Zero runtime dependencies.** The project shown is in the
URL (`/project?root=<path>&tab=<tab>`), never in the server's memory.

## TypeScript comes from the analyzed project

The engine loads `typescript` with `createRequire(<root>/package.json)`, so it parses and resolves
with the compiler the project itself uses — its `paths`, its `references`, its module resolution.
No type checker: `createSourceFile` and `resolveModuleName` only, which keeps an analysis to seconds.

Consequence: a project without `typescript` installed cannot be analyzed, and TypeScript 7 (the Go
port) ships no compiler API — such a project is refused with a named error.

## The config decides what is red

`code-atlas.json` at the project root, JSON so that loading it needs nothing.

- **Features**: without a config, a folder under `src` holding three subfolders or more is split
  into one feature per subfolder (`src/components/*`), everything else is one feature per folder.
  Ordered patterns; `*` binds exactly one _directory_ segment and the file must sit
  deeper than it; first match wins; a file nothing matches belongs to its parent directory. A
  pattern without `*` names a file or a folder literally.
- **Layers**: ordered top → bottom; a layer lists feature globs; `siblings: true` marks a layer whose
  features should not depend on each other.
- **Edge classes**: `allowed` (listed in `allow`), `mutual` whenever both directions exist outside
  two different layers — with or without layers, a pair that knows each other is a smell —
  `unlayered` (either end in no layer while layers exist — shown, never a violation), `down`, `up`,
  and inside one layer `sibling` or `lateral`. Without any layer, every other edge is `down`. Three rules read them: `layers` reports `up`, `mutual` reports `mutual`, `siblings`
  reports `sibling`. Kept apart so a config can mirror a lint that forbids climbing a layer without
  forbidding two features of one layer from knowing each other.
- Type-only imports vanish at build time and couple nothing: counted, never an edge.

Without a config, defaults apply and the page offers a generated draft — layers from the longest
path in the condensed feature graph — to copy and correct.

## Monorepos: one pass, scored per package

- **One engine pass, not one per package.** Every package's tsconfig is loaded into one list of
  projects, each file resolved with its own package's options (its `paths`), into one file set with
  root-relative paths and one graph. Then everything is partitioned by package. N analyses would
  lose the edges between packages, which are the point of a monorepo's graph.
- **Packages are what the package manager says**: `pnpm-workspace.yaml`'s `packages`, read by hand
  (no YAML dependency), else `package.json`'s `workspaces`; `!pattern` takes folders out. A folder
  counts when it holds a `package.json` and the tsconfig: config packages without code
  (`eslint-config`, `typescript-config`) drop out. The root counts as a package of its own (`.`) when
  its tsconfig holds files no package does.
- **Imports through node_modules.** A workspace package is linked into `node_modules`, so
  TypeScript resolves `@acme/ui` to its real source and still flags it `isExternalLibraryImport`.
  The analyzed file set decides whether an import is an edge, not that flag.
- **Ownership.** A violation counts against the package of its file; an edge, against the importing
  file's; a cycle, against the package holding all of it, else none. A rule narrowed by `files`
  (or `from`) applies to the packages with a matching file, so a frontend-only rule does not lift
  every backend package to 100. Violations are kept up to 500 per package, so a package's page shows
  its own and not the remains of the whole list.
- **Scores.** A package is scored on its own violations with the usual formula. The repository's
  score of a rule is the mean of its packages' scores weighted by their lines, times the score of
  the violations no package owns. The half-lives were set for one project: summed over ten apps,
  every monorepo would score near zero whatever its health. Outside a monorepo nothing changes.
  The server sends each rule's score, so the page never recomputes it from a count.
- **The page scopes, the server does not.** One analysis carries every package's scores, figures
  and distributions; the page derives a package's view from it (`?pkg=apps/web`), so switching
  package is instant and every tab works unchanged. Config and Security stay project-wide.
- **`--check`** keeps the repository's ratchet and adds one per package, recorded in the baseline's
  `packages`: fixing two violations in one package does not pay for adding one in another. A
  baseline recorded before packages existed is only checked as a whole.
- **Commands** run once at the root. turbo prefixes a task's lines with `<package>:<task>:` and
  `pnpm -r` with `<folder> <script>:`, and the paths after the prefix are relative to that package:
  they are mapped back before the file is checked to exist. ESLint's stylish format, a file on its
  own line and its messages under it, is read too.

## Two kinds of rules

- **Static** (`layers`, `siblings`, `no-cycle`, `forbid-import`, `max-lines`, `complexity`,
  `max-params`, `pattern`): computed on every analysis, reproducible.
- **Run** (`command`, `ai`): they execute something, so they run on an explicit click or under
  `--check`, never when a page opens. A `code-atlas.json` from a cloned repository is code
  execution, like its npm scripts. The routes that run are refused to other origins
  (`Sec-Fetch-Site`), and a server bound to loopback answers no `Host` but a loopback name — a
  page whose domain was rebound to 127.0.0.1 would otherwise pass as same-origin. Results are kept under `.code-atlas/runs/`, keyed by the rule's hash, and
  marked stale when the commit moved.

## AI rules run Claude Code headless

`claude -p` with `--output-format stream-json --verbose`, `--json-schema` (the findings land in the
`result` event's `structured_output`), `--tools Read,Grep,Glob`, `--strict-mcp-config`,
`--disable-slash-commands`, `--no-session-persistence`, `--model` and `--max-budget-usd`. It uses
the user's own Claude Code login; the tool handles no key. The child's environment drops
`CLAUDECODE` and `CLAUDE_*`, which mark a nested session.

## Score

Per rule: `100 × 0.5^(violations / half-life)`, half-life by severity — critical 1, high 3, medium
6, low 12 — so a score never reaches zero and every fix shows. Per family: the mean of its rules
weighted 8 / 4 / 2 / 1 by severity, over the rules that have a result. Overall: the mean of the
families. One global number alone hides which family regressed, so the page leads with families.

## `--check`

Compares every non-AI rule's violation count with `.code-atlas/baseline.json` and fails on any
increase — a ratchet. Without a baseline, any violation fails. `--update-baseline` writes the
current state. AI rules never gate: two runs on the same commit can differ.

## Writing into the project

One route writes, and only on a click: `POST /api/config/create` turns the draft into
`code-atlas.json`, refuses other origins, and never overwrites a file (`wx`). Everything else the
tool writes lives under `.code-atlas/`.

## Handing work to Claude Code

A prompt is offered two ways: copied, or opened in the Code tab of the Claude desktop app through
its `claude://code/new` link (`q` = the prompt, cut at about 14,000 characters; `folder` = the
project's absolute path, which the app asks to confirm). The prompt is filled in, never sent. The
copy button stays as the fallback for anyone without the desktop app.

## Security tests run Strix, outside the score

Strix is a Python CLI that drives LLM agents inside Docker; code-atlas runs it as a process, like
`claude -p`, and bundles nothing. A scan is not a rule: it takes minutes to hours, costs money, and
two runs on one commit find different things, so it has its own tab and stays out of the score and
`--check`, like the AI rules.

- **A copy, not the project.** Strix mounts local targets writable and has no read-only switch, so
  the scan targets a temporary copy: `git ls-files -co --exclude-standard`, or a walk without git,
  minus `.code-atlas`, `strix_runs`, `node_modules` and symbolic links, deleted afterwards. The copy
  has no history, hence `--scope-mode full`.
- **Owned by the server, not the page.** The rules stream one run per open `EventSource` and
  closing it cancels; a 30-minute scan would die when the user switches tabs. The server keeps one
  scan per project, the page polls `GET /api/security` while it runs, and stopping is a `POST`.
  Shutting code-atlas down stops it.
- **Progress from files, not stdout.** Headless Strix draws a rich panel meant for a terminal; the
  run's `run.json` (status, cost) and `vulnerabilities.json` (findings) are read every two seconds
  instead. The run folder is the one that appears in `strix_runs/` — Strix has no `--run-name`.
  Strix starts in `<state>/runs`, so its reports land under the folder the README says to ignore.
- **Stopping** sends SIGTERM to the process group — Strix's handler marks the run interrupted and
  tears its sandbox down — and SIGKILL only 20 seconds later. A run still marked running that no
  scan drives reads as interrupted.
- **Telemetry** is turned off with `STRIX_TELEMETRY=0` unless the user set it, in keeping with a
  tool where nothing leaves the machine but what a scan or an audit sends to its model.
- Paths in findings are relative to Strix's workspace (`<name>/src/a.ts`, `/workspace/<name>/…`);
  they are mapped back to the project and checked to exist before the page links them.

## Context for an AI assistant

`code-atlas describe` prints the config reference and the project's state as plain text. The
prompts the page hands to Claude Code cite it — with the CLI's own path, since the package may not
be installed where Claude runs — before and after editing, and carry a short summary of the state so
they still work if Claude does not run it. The page trims the summary to keep the whole prompt
under 5000 characters, well inside the link's 14,000.
