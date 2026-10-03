import { listProducts } from '@/lib/api/products'
import type { Product } from '@/lib/api/products'

let cache: Product[] = []
void listProducts().then((products) => (cache = products))
export const useProducts = () => cache
