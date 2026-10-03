import { CheckoutForm } from '@/components/checkout/CheckoutForm'
import { useCart } from '@/hooks/useCart'

export const CheckoutPage = () => CheckoutForm({ total: useCart().total })
