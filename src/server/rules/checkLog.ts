import type { Baseline, EngineResult, Regression, RuleResult, Scores } from '../../shared/types'
import { isNewToBaseline } from './baseline'
import type { PackageScores } from './score'

type Log = (line: string) => void

/** What one --check found, as its console report needs it. */
export type CheckRun = {
  engine: EngineResult
  rules: RuleResult[]
  scores: Scores
  packages: PackageScores[]
  regressions: Regression[]
  baseline: Baseline | null
  errored: boolean
  /** The run is about to become the baseline: the counts, not a verdict against the old one. */
  recording: boolean
}

const reportFamilies = (
  rules: RuleResult[],
  scores: Scores,
  countOf: (rule: RuleResult) => string,
  log: Log,
) => {
  for (const family of scores.families) {
    log(`${family.family}: ${family.score ?? '—'}`)
    for (const rule of rules.filter((r) => r.family === family.family)) {
      if (rule.status === 'error') log(`  ✗ ${rule.id} ${rule.title} — error: ${rule.error}`)
      else if (rule.status === 'fail') log(`  ✗ ${rule.id} ${rule.title} — ${countOf(rule)}`)
      else if (rule.status === 'pass') log(`  ✓ ${rule.id} ${rule.title}`)
    }
  }
  log(`overall: ${scores.overall ?? '—'}`)
}

const reportPackages = (engine: EngineResult, packages: PackageScores[], log: Log) => {
  if (!packages.length) return
  log('packages:')
  for (const { dir, scores } of packages) {
    const name = engine.packages.find((pkg) => pkg.dir === dir)?.name ?? dir
    log(`  ${name} (${dir}): ${scores.overall ?? '—'}`)
  }
}

/** The packages that regressed, the rules the baseline does not know yet, and the verdict. */
const reportVerdict = (run: CheckRun, log: Log) => {
  const { rules, regressions, baseline, errored } = run
  for (const regression of regressions.filter((r) => r.package !== undefined))
    log(
      `  ✗ ${regression.package}: ${regression.id} ${regression.after} (baseline ${regression.before})`,
    )
  const fresh = rules.filter((rule) => isNewToBaseline(rule, baseline))
  if (fresh.length)
    log(
      `⚠ Not in the baseline, so not checked: ${fresh.map((rule) => `${rule.id} (${rule.count})`).join(', ')} — run --update-baseline to start checking ${fresh.length === 1 ? 'it' : 'them'}`,
    )
  log(
    regressions.length === 0 && !errored
      ? '✓ No regression'
      : `✗ ${regressions.length} regression(s)${errored ? ', a command could not run' : ''}`,
  )
}

/** The console report of --check: each family's rules, each package's score, then the verdict. */
export const logCheck = (run: CheckRun, log: Log) => {
  const { rules, scores, baseline, recording } = run
  const countOf = (rule: RuleResult) => {
    if (recording) return `${rule.count}`
    if (isNewToBaseline(rule, baseline)) return `${rule.count} (not in the baseline)`
    return `${rule.count} (baseline ${baseline?.violations[rule.id] ?? 0})`
  }
  reportFamilies(rules, scores, countOf, log)
  reportPackages(run.engine, run.packages, log)
  if (!recording) reportVerdict(run, log)
}
