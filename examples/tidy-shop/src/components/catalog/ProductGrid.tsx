import { ProductCard } from './ProductCard'
import type { Product } from '@/lib/api/products'

export const ProductGrid = ({ products }: { products: Product[] }) =>
  products.map((p) => ProductCard({ product: p }))
