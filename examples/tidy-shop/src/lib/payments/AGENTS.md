# Payments

Charges a card and refunds an order through the payment provider. Every amount is in cents;
nothing here formats a price or touches the UI.

- `charge.ts` — one charge per order, idempotent on the order id.
- `refunds.ts` — full or partial refunds of a charge.

> An agent changing this folder runs the payment tests before anything else.
