import { Price } from '@/components/ui/Price'

export const CartSummary = ({ total }: { total: number }) => Price({ cents: total })
