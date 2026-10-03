import { formatMoney } from '@/lib/format/money'

export const Price = ({ cents }: { cents: number }) => formatMoney(cents)
