import type { EdgeClass } from '../../../shared/types'

export type Tone = 'red' | 'amber' | 'grey' | 'light'

export const TONE: Record<EdgeClass, Tone> = {
  up: 'red',
  mutual: 'red',
  sibling: 'amber',
  down: 'grey',
  lateral: 'grey',
  allowed: 'grey',
  unlayered: 'light',
}

export const DASHED: Record<EdgeClass, boolean> = {
  up: false,
  mutual: false,
  sibling: false,
  down: false,
  lateral: false,
  allowed: true,
  unlayered: true,
}

export const isProblem = (edgeClass: EdgeClass) =>
  TONE[edgeClass] === 'red' || TONE[edgeClass] === 'amber'

export const isRed = (edgeClass: EdgeClass) => TONE[edgeClass] === 'red'

const ORDER: Record<Tone, number> = { light: 0, grey: 1, amber: 2, red: 3 }

export const drawOrder = (a: EdgeClass, b: EdgeClass) => ORDER[TONE[a]] - ORDER[TONE[b]]

export const STROKE: Record<Tone, string> = {
  red: 'stroke-edge-red',
  amber: 'stroke-edge-amber',
  grey: 'stroke-edge-grey',
  light: 'stroke-edge-light',
}

export const FILL: Record<Tone, string> = {
  red: 'fill-edge-red',
  amber: 'fill-edge-amber',
  grey: 'fill-edge-grey',
  light: 'fill-edge-light',
}

export const CHIP: Record<Tone, string> = {
  red: 'border-edge-red text-edge-red',
  amber: 'border-edge-amber text-edge-amber',
  grey: 'border-edge-grey text-muted',
  light: 'border-edge-light text-muted',
}

export const strokeWidth = (weight: number) => Math.min(4, 1 + Math.log2(Math.max(1, weight)) * 0.5)
