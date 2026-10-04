import { KNOWN_FAMILIES } from '../../shared/config'
import { ruleScore, WEIGHT } from '../../shared/score'
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
      const scored = own.filter((rule) => rule.status === 'pass' || rule.status === 'fail')
      const weight = scored.reduce((sum, rule) => sum + WEIGHT[rule.severity], 0)
      const total = scored.reduce(
        (sum, rule) => sum + WEIGHT[rule.severity] * ruleScore(rule.severity, rule.count),
        0,
      )
      return {
        family,
        score: scored.length ? Math.round(total / weight) : null,
        rules: own.length,
        failing: own.filter((rule) => rule.status === 'fail').length,
        pending: own.filter((rule) => rule.status === 'not-run' || rule.status === 'error').length,
      }
    },
  )
  const values = families.flatMap((family) => (family.score === null ? [] : [family.score]))
  return {
    overall: values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null,
    families,
  }
}
