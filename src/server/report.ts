import path from 'node:path'
import type { Severity } from '../shared/config'
import type { CheckReport, EngineResult, RuleResult, Scores, Violation } from '../shared/types'
import type { PackageScores } from './rules'
import type { Baseline, Regression } from '../shared/types'

export const FORMATS = ['text', 'json', 'github', 'sarif'] as const

export type Format = (typeof FORMATS)[number]

export const isFormat = (value: string | undefined): value is Format =>
  FORMATS.includes(value as Format)

/** GitHub keeps ten annotations of each kind per step and drops the rest. */
const MAX_ANNOTATIONS = 10

export const checkReport = (opts: {
  root: string
  engine: EngineResult
  git: { commit: string | null; dirty: boolean }
  recording: boolean
  result: {
    ok: boolean
    rules: RuleResult[]
    scores: Scores
    packages: PackageScores[]
    regressions: Regression[]
    baseline: Baseline | null
  }
}): CheckReport => {
  const { root, engine, git, recording, result } = opts
  return {
    ok: result.ok,
    recording,
    root,
    commit: git.commit,
    dirty: git.dirty,
    at: new Date().toISOString(),
    scores: result.scores,
    rules: result.rules,
    packages: result.packages.map(({ dir, scores }) => ({
      dir,
      name: engine.packages.find((pkg) => pkg.dir === dir)?.name ?? dir,
      scores,
    })),
    regressions: result.regressions,
    baseline: result.baseline
      ? { commit: result.baseline.commit, savedAt: result.baseline.savedAt }
      : null,
  }
}

/**
 * A violation's path as the CI host sees it: the project may be a folder of the checkout
 * (`--root apps/web`), and an annotation on `src/a.ts` would then point nowhere.
 */
const hostPath = (root: string, file: string, workspace: string) =>
  path.relative(workspace, path.resolve(root, file)).split(path.sep).join('/')

const workspaceOf = () => process.env.GITHUB_WORKSPACE ?? process.cwd()

// Workflow commands: https://docs.github.com/actions/reference/workflow-commands-for-github-actions
const escapeData = (text: string) =>
  text.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')
const escapeProperty = (text: string) => escapeData(text).replace(/:/g, '%3A').replace(/,/g, '%2C')

const command = (name: string, properties: Record<string, string>, message: string) => {
  const props = Object.entries(properties)
    .map(([key, value]) => `${key}=${escapeProperty(value)}`)
    .join(',')
  return `::${name}${props ? ` ${props}` : ''}::${escapeData(message)}`
}

const regressedRules = (report: CheckReport) => {
  const ids = new Set(report.regressions.map((regression) => regression.id))
  return report.rules.filter((rule) => ids.has(rule.id))
}

const located = (violation: Violation): violation is Violation & { file: string } =>
  violation.file !== null

/**
 * The regressions as GitHub Actions annotations: one error per regressed rule, and one on each
 * violation of those rules that has a file, up to the ten GitHub keeps. The lines go to stdout,
 * where the runner reads them.
 */
export const githubAnnotations = (report: CheckReport): string[] => {
  const workspace = workspaceOf()
  const lines: string[] = []
  for (const regression of report.regressions) {
    const where = regression.package ? ` in ${regression.package}` : ''
    lines.push(
      command(
        'error',
        { title: `code-atlas: ${regression.id} regressed${where}` },
        `${regression.after} violation${regression.after === 1 ? '' : 's'} (baseline ${regression.before})`,
      ),
    )
  }
  let left = MAX_ANNOTATIONS
  for (const rule of regressedRules(report)) {
    for (const violation of rule.violations.filter(located)) {
      if (left === 0) return lines
      left--
      lines.push(
        command(
          'error',
          {
            file: hostPath(report.root, violation.file, workspace),
            ...(violation.line === null ? {} : { line: String(violation.line) }),
            title: `code-atlas: ${rule.id}`,
          },
          violation.message,
        ),
      )
    }
  }
  return lines
}

const scoreOf = (score: number | null) => (score === null ? '—' : String(score))

/** The job summary, Markdown for `$GITHUB_STEP_SUMMARY`. */
export const summaryMarkdown = (report: CheckReport): string => {
  const verdict = report.recording
    ? 'baseline recorded'
    : report.ok
      ? '✓ no regression'
      : `✗ ${report.regressions.length} regression${report.regressions.length === 1 ? '' : 's'}`
  const byId = new Map(report.rules.map((rule) => [rule.id, rule]))
  const lines = [
    `## code-atlas: ${scoreOf(report.scores.overall)} — ${verdict}`,
    '',
    '| Family | Score | Failing |',
    '| --- | ---: | ---: |',
    ...report.scores.families.map(
      (family) =>
        `| ${family.family}${family.beta ? ' (beta)' : ''} | ${scoreOf(family.score)} | ${family.failing} / ${family.rules} |`,
    ),
  ]
  if (report.packages.length) {
    lines.push(
      '',
      '| Package | Score |',
      '| --- | ---: |',
      ...[...report.packages]
        .sort((a, b) => (a.scores.overall ?? 101) - (b.scores.overall ?? 101))
        .map((pkg) => `| ${pkg.name} (\`${pkg.dir}\`) | ${scoreOf(pkg.scores.overall)} |`),
    )
  }
  if (report.regressions.length) {
    lines.push('', '### Regressions', '')
    for (const regression of report.regressions) {
      const rule = byId.get(regression.id)
      const where = regression.package ? ` in \`${regression.package}\`` : ''
      lines.push(
        `- **${regression.id}** ${rule?.title ?? ''}${where}: ${regression.after} (baseline ${regression.before})`,
      )
      const shown = (rule?.violations ?? [])
        .filter((violation) => !regression.package || violation.package === regression.package)
        .slice(0, MAX_ANNOTATIONS)
      for (const violation of shown)
        lines.push(
          `  - ${violation.file ? `\`${violation.file}${violation.line === null ? '' : `:${violation.line}`}\` — ` : ''}${violation.message}`,
        )
    }
  }
  return lines.join('\n') + '\n'
}

const SARIF_LEVEL: Record<Severity, 'error' | 'warning' | 'note'> = {
  critical: 'error',
  high: 'error',
  medium: 'warning',
  low: 'note',
}

/**
 * SARIF 2.1.0, every violation of every rule that ran: code scanning keeps the alerts and shows
 * the new ones on a pull request, so no ratchet is needed on this side.
 */
export const sarifReport = (report: CheckReport, version: string) => {
  const workspace = workspaceOf()
  const ran = report.rules.filter((rule) => rule.status === 'pass' || rule.status === 'fail')
  return {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'code-atlas',
            version,
            informationUri: 'https://github.com/Vincweb/code-atlas',
            rules: ran.map((rule) => ({
              id: rule.id,
              name: rule.title,
              shortDescription: { text: rule.title },
              defaultConfiguration: { level: SARIF_LEVEL[rule.severity] },
              properties: { family: rule.family, severity: rule.severity, kind: rule.kind },
            })),
          },
        },
        originalUriBaseIds: { SRCROOT: { uri: `file://${workspace.replace(/\/?$/, '/')}` } },
        results: ran.flatMap((rule) =>
          rule.violations.map((violation) => ({
            ruleId: rule.id,
            level: SARIF_LEVEL[rule.severity],
            message: { text: violation.message },
            ...(violation.file
              ? {
                  locations: [
                    {
                      physicalLocation: {
                        artifactLocation: {
                          uri: hostPath(report.root, violation.file, workspace),
                          uriBaseId: 'SRCROOT',
                        },
                        ...(violation.line === null
                          ? {}
                          : { region: { startLine: violation.line } }),
                      },
                    },
                  ],
                }
              : {}),
          })),
        ),
        properties: {
          overall: report.scores.overall,
          commit: report.commit,
          regressions: report.regressions,
        },
      },
    ],
  }
}
