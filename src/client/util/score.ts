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
