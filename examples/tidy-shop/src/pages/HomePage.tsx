import { ProductGrid } from '@/components/catalog/ProductGrid'
import { useProducts } from '@/hooks/useProducts'

export const HomePage = () => ProductGrid({ products: useProducts() })
