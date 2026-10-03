import { Price } from '@/components/ui/Price'
import type { Line } from '@/state/cartStore'

export const CartLine = (line: Line) => [line.name, Price({ cents: line.cents * line.quantity })]
