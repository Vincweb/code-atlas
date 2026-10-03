import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { LayerConfig, RuleConfig } from '../../shared/config'

const packageManager = (root: string) => {
  if (existsSync(join(root, 'pnpm-lock.yaml'))) return 'pnpm'
  if (existsSync(join(root, 'yarn.lock'))) return 'yarn'
  if (existsSync(join(root, 'bun.lock')) || existsSync(join(root, 'bun.lockb'))) return 'bun'
  return 'npm'
}

const scriptsOf = (root: string): Record<string, unknown> => {
  try {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
      scripts?: Record<string, unknown>
    }
    return pkg.scripts ?? {}
  } catch {
    return {}
  }
}

const toolingRules = (root: string): RuleConfig[] => {
  const scripts = scriptsOf(root)
  const pm = packageManager(root)
  const rules: RuleConfig[] = []
  const add = (id: string, names: string[], severity: 'high' | 'medium') => {
    const script = names.find((name) => typeof scripts[name] === 'string')
    if (script)
      rules.push({
        id,
        family: 'tooling',
        severity,
        kind: 'command',
        run: `${pm} run ${script}`,
      })
  }
  add('TL-LINT', ['lint'], 'high')
  add('TL-TYPES', ['typecheck', 'type-check'], 'high')
  add('TL-TEST', ['test'], 'high')
  add('TL-KNIP', ['knip'], 'medium')
  return rules
}

export const defaultRules = (root: string, layers: LayerConfig[]): RuleConfig[] => {
  const rules: RuleConfig[] = []
  if (layers.length)
    rules.push({ id: 'ARCH-LAYERS', family: 'architecture', severity: 'high', kind: 'layers' })
  rules.push({ id: 'ARCH-MUTUAL', family: 'architecture', severity: 'medium', kind: 'mutual' })
  if (layers.some((layer) => layer.siblings))
    rules.push({ id: 'ARCH-SIBLINGS', family: 'architecture', severity: 'low', kind: 'siblings' })
  rules.push(
    { id: 'ARCH-CYCLES', family: 'architecture', severity: 'high', kind: 'no-cycle' },
    { id: 'CC-LINES', family: 'clean-code', severity: 'medium', kind: 'max-lines', max: 400 },
    { id: 'CC-COMPLEXITY', family: 'clean-code', severity: 'medium', kind: 'complexity', max: 15 },
    { id: 'CC-PARAMS', family: 'clean-code', severity: 'low', kind: 'max-params', max: 4 },
    {
      id: 'CC-ANY',
      family: 'clean-code',
      severity: 'high',
      kind: 'pattern',
      pattern: String.raw`:\s*any\b|\bas\s+any\b|<any>`,
      files: '**/*.{ts,tsx}',
    },
    ...toolingRules(root),
    {
      id: 'AI-ARCH',
      family: 'ai',
      severity: 'medium',
      kind: 'ai',
      prompt:
        "Review the architecture of this codebase: layering, the responsibility of each folder, and coupling between features. Report concrete violations: a feature reaching into another one's internals, a folder mixing unrelated responsibilities, a dependency pointing the wrong way.",
    },
    {
      id: 'AI-CLEAN',
      family: 'ai',
      severity: 'medium',
      kind: 'ai',
      prompt:
        'Review the code for clean-code issues: unclear naming, functions that are too long or do several things, weak error handling, dead or duplicated code. Report concrete, specific occurrences only.',
    },
  )
  return rules
}
