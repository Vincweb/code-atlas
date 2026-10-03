import { A } from '@/components/a/A'

export type Row = { id: number }

export function pick(a: number, b: number, c?: number) {
  if (a && b) {
    for (let i = 0; i < a; i++) b += i
  }
  return A ? (c ?? b) : 0
}
