# A real sandbox order on a new seeded shop (run 11)

`e2e/new-shop-order.spec.ts`, run on 2026-11-11 at 07:18 UTC against the PayPal sandbox (no mocks), `E2E_PORT=3202`:

1. `seedSellerShop` (the same `publishShop` path as Marigold) published **Little Ember Coffee** (`/s/little-ember-coffee`, category `drinks`, 8 items) to the PayPal sandbox catalog, paid to `PAYPAL_SANDBOX_SELLER_EMAIL`.
2. A buyer opened the shop page, added Americano ($3.50) and Blueberry muffin ($3.50) to the cart, and pressed "Approve $7.00 on PayPal".
3. On PayPal's sandbox the buyer logged in (wallet checkout, `payWithPayPalLogin`) and approved; PayPal sent the browser back to Shelfie's return URL, which captured the payment.
4. The receipt read "Paid. Little Ember Coffee has your order." and "Paid to Little Ember Coffee's own PayPal account"; the stored order is `paid`, payee the sandbox seller.

| Shop | Order | Ref | Total | Status | PayPal capture | Date |
| --- | --- | --- | --- | --- | --- | --- |
| Little Ember Coffee | SHF-ZKA83L | ord_yhfcwtcvd7ile7z6 | $7.00 | paid | 88U23499J4241541T | 2026-11-11T07:18:21Z |

`npm run seed` in the same worktree also published all six shops live (Marigold Bakehouse 9 items in PayPal, Tía Lupe's Tacos 10, Ravi's Bike Repair 7, Little Ember Coffee 8, Sunny Side Lemonade 9, Fern & Wick 9).
