export const CONFIG_REFERENCE = `# code-atlas.json — format reference

code-atlas.json sits at the project root. Plain JSON, no comments. Every key is optional.

## Keys
- include: string[] — globs of the files to analyse. Default ["src/**"], or ["**"] without a src folder.
- exclude: string[] — globs to skip. Default tests, *.d.ts, node_modules, dist.
- tsconfig: string — the tsconfig used to resolve imports; its "references" are followed. Default "tsconfig.json".
- features: string[] — ordered patterns grouping files into features.
  - "*" binds exactly one folder and the file must sit deeper: "src/components/*" makes one feature per subfolder of src/components.
  - A pattern without "*" names a file or a folder literally: "src/routes".
  - The first matching pattern wins; a file no pattern matches belongs to its parent folder.
  - Feature ids are paths: "src/components/board", "src/lib", "src".
- layers: { "name": string, "features": string[], "siblings"?: boolean }[] — from the top of the stack to the foundation.
  - "features" are globs over feature ids: "src/lib/*", "src/{pages,routes}".
  - A feature belongs to the first layer that matches it; a feature in no layer is "unlayered".
  - "siblings": true means the features of that layer must not depend on each other.
- allow: [from, to][] — pairs of feature-id globs accepted despite the layers (drawn dashed, never a violation).
- rules: Rule[] — when present, replaces the default rule set entirely.
- ai: { "model"?: string, "budgetUsd"?: number, "language"?: string } — defaults for "ai" rules: "sonnet", 1, "English".

## Edges between features (type-only imports are ignored)
- down: to a lower layer — normal.
- up: to a higher layer — reported by the "layers" rule.
- mutual: both directions exist (unless the two features sit in different layers, where one direction is "up") — reported by "mutual". Without any layer, every pair importing both ways is mutual.
- sibling: inside a "siblings" layer — reported by "siblings".
- lateral: inside a normal layer. allowed: listed in "allow". unlayered: one end has no layer.

## Rules
Every rule: { "id": unique string, "family": "architecture" | "clean-code" | "tooling" | "ai" (or any name), "severity": "critical" | "high" | "medium" | "low", "kind": one of the kinds below, "title"?: string }, plus the fields of its kind:
- "layers" — upward edges.
- "mutual" — mutual edges.
- "siblings" — sibling edges.
- "no-cycle" — import cycles between files (static imports and re-exports).
- "forbid-import" { "from": glob, "to": glob, "types"?: boolean } — an import from a file matching "from" to a file matching "to".
- "max-lines" { "max": number, "files"?: glob } — files longer than max lines.
- "complexity" { "max": number, "files"?: glob } — functions whose cyclomatic complexity exceeds max.
- "max-params" { "max": number, "files"?: glob } — functions with more parameters than max.
- "pattern" { "pattern": regex, "flags"?: string, "files"?: glob, "exclude"?: glob } — code that must not appear; one violation per match.
- "command" { "run": string, "timeoutSec"?: number } — a shell command run in the project; fails on a non-zero exit (lint, type check, tests).
- "ai" { "prompt": string, "files"?: glob, "model"?: string, "budgetUsd"?: number } — Claude reads the code read-only and reports findings for the prompt.

Scoring: a rule scores 100 × 0.5^(violations / half-life), half-life 1, 3, 6, 12 for critical, high, medium, low. A family is the severity-weighted mean of its rules (8, 4, 2, 1).

## Example
{
  "features": ["src/components/*", "src/lib/*", "src/*"],
  "layers": [
    { "name": "Screens", "features": ["src", "src/{routes,pages}"] },
    { "name": "Features", "siblings": true, "features": ["src/components/*"] },
    { "name": "Foundation", "features": ["src/lib", "src/lib/*"] }
  ],
  "allow": [["src/lib/api", "src/lib/http"]],
  "rules": [
    { "id": "ARCH-LAYERS", "family": "architecture", "severity": "high", "kind": "layers" },
    { "id": "ARCH-MUTUAL", "family": "architecture", "severity": "medium", "kind": "mutual" },
    { "id": "NO-UI-IN-LIB", "family": "architecture", "severity": "high", "kind": "forbid-import", "from": "src/lib/**", "to": "src/components/**" },
    { "id": "CC-COMPLEXITY", "family": "clean-code", "severity": "medium", "kind": "complexity", "max": 15 },
    { "id": "TL-LINT", "family": "tooling", "severity": "high", "kind": "command", "run": "pnpm lint" }
  ]
}
`
