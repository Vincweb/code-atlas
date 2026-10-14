---
description: The drawer that holds what the customer picked, with its lines and its total, until checkout.
owner: shop-front
status: stable
---

# Cart

The cart is a drawer, opened from any page. It lists the lines of the cart held by
[`state/cart`](../../state/cart.ts) and sums them; it never talks to the API itself.

## Entry points

| File                                   | Used by                   |
| -------------------------------------- | ------------------------- |
| [`CartDrawer.tsx`](./CartDrawer.tsx)   | the layout of every page  |
| [`CartLine.tsx`](./CartLine.tsx)       | the drawer only           |
| [`CartSummary.tsx`](./CartSummary.tsx) | the drawer and `checkout` |

## Rules

- Prices are formatted by `lib/format`, never here.
- The cart does not know `checkout`: the checkout button is passed in, not imported.

```tsx
<CartDrawer footer={<CheckoutButton />} />
```
