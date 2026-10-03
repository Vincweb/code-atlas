import { Price } from '@/components/ui/Price'

export const get = async <T>(path: string): Promise<T> => {
  const response = await fetch(`/api${path}`)
  if (!response.ok) console.warn(Price({ cents: 0 }))
  return (await response.json()) as T
}
