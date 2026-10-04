import type { Severity } from './config'

/** Violations that halve a rule's score. */
export const HALF_LIFE: Record<Severity, number> = { critical: 1, high: 3, medium: 6, low: 12 }

/** A rule's weight in its family's score. */
export const WEIGHT: Record<Severity, number> = { critical: 8, high: 4, medium: 2, low: 1 }

export const ruleScore = (severity: Severity, count: number) =>
  Math.round(100 * 0.5 ** (count / HALF_LIFE[severity]))
