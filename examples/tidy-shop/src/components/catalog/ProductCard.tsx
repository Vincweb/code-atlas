import { Button } from '@/components/ui/Button'
import { Price } from '@/components/ui/Price'
import { addToCart } from '@/state/cartStore'
import type { Product } from '@/lib/api/products'

export const ProductCard = ({ product }: { product: Product }) => [
  Price({ cents: product.cents }),
  Button({ label: 'Add', onClick: () => addToCart(product) }),
]
