import { get } from './client'

export type Product = { id: string; name: string; cents: number }
export const listProducts = () => get<Product[]>('/products')
