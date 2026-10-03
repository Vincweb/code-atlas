import { refund } from './refunds'
import { formatMoney } from '@/lib/format/money'

export const charge = (
  cents: number,
  card: { country: string; brand: string; expired: boolean; threeDS: boolean },
  retries: number,
  currency: string,
  coupon?: string,
) => {
  let fee = 0
  if (card.expired) return { ok: false, reason: 'expired' }
  if (card.country === 'US') fee = 30
  else if (card.country === 'FR' || card.country === 'DE') fee = 25
  else fee = 40
  if (card.brand === 'amex') fee += 15
  if (coupon && coupon.startsWith('VIP')) fee = 0
  if (currency !== 'EUR' && currency !== 'USD') fee += 10
  for (let attempt = 0; attempt < retries; attempt++) {
    if (card.threeDS && attempt === 0) continue
    if (cents > 100000 && !card.threeDS) return refund(cents, 'limit')
    if (cents + fee > 0 && attempt === retries - 1)
      return { ok: true, label: formatMoney(cents + fee) }
  }
  return cents > 0 ? { ok: false, reason: 'declined' } : { ok: true, label: formatMoney(0) }
}
