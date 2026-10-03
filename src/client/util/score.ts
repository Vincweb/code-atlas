import type { Severity } from '../../shared/config'

export const HALF_LIFE: Record<Severity, number> = { critical: 1, high: 3, medium: 6, low: 12 }

/** Mirrors the server's per-rule score so a row can show it without another round trip. */
export const ruleScore = (severity: Severity, count: number) =>
  Math.round(100 * 0.5 ** (count / HALF_LIFE[severity]))

export type Band = 'good' | 'warn' | 'bad' | 'none'

export const bandOf = (score: number | null): Band =>
  score === null ? 'none' : score >= 80 ? 'good' : score >= 50 ? 'warn' : 'bad'

export const BAND_TEXT: Record<Band, string> = {
  good: 'text-good',
  warn: 'text-warn',
  bad: 'text-bad',
  none: 'text-none',
}

export const BAND_BOX: Record<Band, string> = {
  good: 'border-good-line bg-good-bg',
  warn: 'border-warn-line bg-warn-bg',
  bad: 'border-bad-line bg-bad-bg',
  none: 'border-line bg-none-bg',
}
