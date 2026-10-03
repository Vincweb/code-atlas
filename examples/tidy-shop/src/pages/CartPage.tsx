import { CartDrawer } from '@/components/cart/CartDrawer'
import { useCart } from '@/hooks/useCart'

export const CartPage = () => CartDrawer({ lines: useCart().lines })
