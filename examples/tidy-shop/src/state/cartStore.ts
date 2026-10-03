import type { Product } from '@/lib/api/products'
import { track } from '@/lib/analytics/track'

export type Line = { name: string; cents: number; quantity: number }
export const cart = { lines: [] as Line[], total: 0 }
export const addToCart = (product: Product) => {
  cart.lines.push({ name: product.name, cents: product.cents, quantity: 1 })
  cart.total += product.cents
  track('add_to_cart', product)
}
