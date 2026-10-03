import { CartLine } from './CartLine'
import { CheckoutButton } from '@/components/checkout/CheckoutButton'
import { Modal } from '@/components/ui/Modal'
import type { Line } from '@/state/cartStore'

export const CartDrawer = ({ lines }: { lines: Line[] }) =>
  Modal({ body: [...lines.map(CartLine), CheckoutButton()] })
