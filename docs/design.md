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

## Two kinds of rules

- **Static** (`layers`, `siblings`, `no-cycle`, `forbid-import`, `max-lines`, `complexity`,
  `max-params`, `pattern`): computed on every analysis, reproducible.
- **Run** (`command`, `ai`): they execute something, so they run on an explicit click or under
  `--check`, never when a page opens. A `code-atlas.json` from a cloned repository is code
  execution, like its npm scripts. The routes that run are refused to other origins
  (`Sec-Fetch-Site`). Results are kept under `.code-atlas/runs/`, keyed by the rule's hash, and
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

## Context for an AI assistant

`code-atlas describe` prints the config reference and the project's state as plain text. The
prompts the page hands to Claude Code cite it — with the CLI's own path, since the package may not
be installed where Claude runs — before and after editing, and carry a short summary of the state so
they still work if Claude does not run it. The summary is trimmed to keep the whole prompt under
the deep link's 5000 characters.
