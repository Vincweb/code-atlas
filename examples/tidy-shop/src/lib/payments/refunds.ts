import { charge } from './charge'

export const refund = (cents: number, reason: string) => ({
  ok: false,
  reason,
  retry: () =>
    charge(cents, { country: 'FR', brand: 'visa', expired: false, threeDS: true }, 1, 'EUR'),
})
