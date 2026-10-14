import { isDbKind } from '../../shared/config'
import { packageRules } from '../../shared/packages'
import type { Baseline, PackageBaseline, Regression, RuleResult, Scores } from '../../shared/types'
import type { PackageScores } from './score'

const countsOf = (rules: RuleResult[]) =>
  Object.fromEntries(
    rules
      .filter((rule) => rule.kind !== 'ai' && !isDbKind(rule.kind))
      .filter((rule) => rule.status === 'pass' || rule.status === 'fail')
      .map((rule) => [rule.id, rule.count]),
  )

export const makeBaseline = (
  rules: RuleResult[],
  scores: Scores,
  commit: string | null,
  packages: PackageScores[] = [],
): Baseline => ({
  commit,
  savedAt: new Date().toISOString(),
  scores,
  violations: countsOf(rules),
  ...(packages.length
    ? {
        packages: Object.fromEntries(
          packages.map(({ dir, scores: own }): [string, PackageBaseline] => [
            dir,
            { scores: own, violations: countsOf(packageRules(rules, dir)) },
          ]),
        ),
      }
    : {}),
})

/**
 * Whether the baseline never counted this rule. Every static rule is counted when a baseline is
 * recorded, so a missing one was added since — to the config, or to the defaults by a newer
 * code-atlas — and is reported, not checked, until the baseline is recorded again: upgrading must
 * not fail a CI whose code did not change. A command rule may be missing because the baseline was
 * recorded with --skip-commands; a red lint stays red, so it still compares with zero.
 */
export const isNewToBaseline = (rule: RuleResult, baseline: Baseline | null) =>
  baseline !== null && rule.kind !== 'command' && !(rule.id in baseline.violations)

/** Every count above the baseline's: the whole repository's, then each package's it recorded. */
export const regressionsOf = (
  rules: RuleResult[],
  baseline: Baseline | null,
  packages: PackageScores[],
): Regression[] => {
  const ran = rules.filter(
    (rule) =>
      (rule.status === 'pass' || rule.status === 'fail') && !isNewToBaseline(rule, baseline),
  )
  const global = ran.flatMap((rule) => {
    const before = baseline?.violations[rule.id] ?? 0
    return rule.count > before ? [{ id: rule.id, before, after: rule.count }] : []
  })
  const recorded = baseline?.packages
  if (!recorded) return global
  const own = packages.flatMap(({ dir }) =>
    packageRules(ran, dir).flatMap((rule) => {
      const before = recorded[dir]?.violations[rule.id] ?? 0
      return rule.count > before ? [{ id: rule.id, package: dir, before, after: rule.count }] : []
    }),
  )
  return [...global, ...own]
}
