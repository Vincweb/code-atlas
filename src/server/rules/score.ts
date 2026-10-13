import { KNOWN_FAMILIES, isDbKind } from '../../shared/config'
import { WEIGHT } from '../../shared/score'
import type { FamilyScore, RuleResult, Scores } from '../../shared/types'

const familyOrder = (families: string[]) => {
  const known: string[] = KNOWN_FAMILIES.filter((family) => families.includes(family))
  const others = families.filter((family) => !known.includes(family)).sort()
  return [...known, ...others]
}

export const computeScores = (rules: RuleResult[]): Scores => {
  const families: FamilyScore[] = familyOrder([...new Set(rules.map((rule) => rule.family))]).map(
    (family) => {
      const own = rules.filter((rule) => rule.family === family)
      const scored = own.filter(
        (rule): rule is RuleResult & { score: number } =>
          (rule.status === 'pass' || rule.status === 'fail') && rule.score !== null,
      )
      const weight = scored.reduce((sum, rule) => sum + WEIGHT[rule.severity], 0)
      const total = scored.reduce((sum, rule) => sum + WEIGHT[rule.severity] * rule.score, 0)
      return {
        family,
        score: scored.length ? Math.round(total / weight) : null,
        rules: own.length,
        failing: own.filter((rule) => rule.status === 'fail').length,
        pending: own.filter((rule) => rule.status === 'not-run' || rule.status === 'error').length,
        beta: own.every((rule) => isDbKind(rule.kind)),
      }
    },
  )
  // A family in beta is scored for the page, never for the overall number.
  const values = families.flatMap((family) =>
    family.score === null || family.beta ? [] : [family.score],
  )
  return {
    overall: values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null,
    families,
  }
}
