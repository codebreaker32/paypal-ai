# Final design review screenshots (run 16, 11 Nov 2026)

Every screen at 390 × 844 (`-390`) and 1440 × 900 (`-1440`), against `next build && next start` production servers.

Two sets, one folder:

- **Seeded set** (`docs/reviews/final/capture-public.ts`): a throwaway DB seeded with `npm run seed -- --reset` (six live shops, real PayPal sandbox catalog). Home (`home`, `home-hero`, `home-section-*`, `home-footer`), the home chat (`home-chat-open`, `home-chat-mid-order`, `home-chat-confirm`: a real Claude turn), `browse`, the Marigold shop page (`shop-seeded*`, `shop-item-sheet`, `shop-add-toast`, `shop-dock-order` / `shop-dock-assistant` at 1440, `shop-cart-sheet` / `shop-assistant-sheet` at 390), `shop-ravis-first-screen`, `login`, `login-empty-submit`, `signup`, `recover`, `shops-new`, `shops-list`, `account`, `help`, `terms`, `privacy`, `404`, `404-shop`.
- **Suite set** (`npm run screenshots:prod`, `e2e/screenshots.spec.ts`, fake PayPal, labelled fixtures): setup (`start*`, `setup-*`, `review-paypal-email`), dashboard (`dashboard-*`, `counter-card`), order detail (`order-*`), receipts (`receipt-*`), shop states (`shop*`, `item-sheet`, `cart*`, `console-*`). Its axe results are `axe-results-suite.json` (no serious or critical violations; 102 of 102 passed).

Masking: owner links and tokens never appear on screen; every email shown is an invented fixture (`@example.com`), and the seeded set replaces any email text with `•••@•••`.
