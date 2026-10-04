import type { Severity } from '../../../shared/config'
import type { Analysis, FamilyScore, RuleResult } from '../../../shared/types'
import { ruleScore } from '../../../shared/score'

const WEIGHT: Record<Severity, number> = { critical: 8, high: 4, medium: 2, low: 1 }

export const hasRun = (rule: RuleResult) => rule.status === 'pass' || rule.status === 'fail'

export type Priority = { rule: RuleResult; score: number; gain: number }

export const prioritiesOf = (rules: RuleResult[], limit = 4): Priority[] => {
  const familyWeight = new Map<string, number>()
  for (const rule of rules.filter(hasRun))
    familyWeight.set(rule.family, (familyWeight.get(rule.family) ?? 0) + WEIGHT[rule.severity])
  return rules
    .filter((rule) => rule.status === 'fail')
    .map((rule) => {
      const score = ruleScore(rule.severity, rule.count)
      const total = familyWeight.get(rule.family) ?? WEIGHT[rule.severity]
      return { rule, score, gain: Math.round((WEIGHT[rule.severity] * (100 - score)) / total) }
    })
    .sort((a, b) => b.gain - a.gain || b.rule.count - a.rule.count)
    .slice(0, limit)
}

export const extremesOf = (families: FamilyScore[]) => {
  const scored = families.filter(
    (family): family is FamilyScore & { score: number } => family.score !== null,
  )
  if (scored.length < 2) return null
  const sorted = [...scored].sort((a, b) => b.score - a.score)
  const best = sorted[0]
  const worst = sorted[sorted.length - 1]
  if (!best || !worst || best.score === worst.score) return null
  return { best, worst }
}

export type Step = {
  id: 'layers' | 'commands' | 'ai' | 'baseline'
  done: boolean
}

export const stepsOf = (analysis: Analysis): Step[] => {
  const commands = analysis.rules.filter((rule) => rule.kind === 'command')
  const audits = analysis.rules.filter((rule) => rule.kind === 'ai')
  const steps: Step[] = [
    {
      id: 'layers',
      done: analysis.configSource !== 'default' && analysis.config.layers.length > 0,
    },
  ]
  if (commands.length > 0)
    steps.push({ id: 'commands', done: commands.every((rule) => rule.status !== 'not-run') })
  if (audits.length > 0) steps.push({ id: 'ai', done: audits.some(hasRun) })
  steps.push({ id: 'baseline', done: analysis.baseline !== null })
  return steps
}
