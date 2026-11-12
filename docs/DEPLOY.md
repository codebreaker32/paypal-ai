# Deploying Shelfie to Render

**Status: never deployed.** These are the exact steps for a person to follow. `render.yaml` validates against Render's Blueprint schema, and the Render-specific code paths (the `RENDER_EXTERNAL_URL` fallback, the `CF-Connecting-IP` rate-limit key) are unit-tested, but nothing here has run on Render yet.

Time: about 20 minutes, most of it waiting for the first build.

## What you need

| Thing | Where it comes from |
|---|---|
| The GitHub repo | `codebreaker32/paypal-ai` (or your fork). Render needs read access to it. |
| A Render account with billing | [dashboard.render.com](https://dashboard.render.com). The Blueprint uses the **Starter** instance type (`0.5c-512mb`) and a **1 GB persistent disk**, because SQLite and the uploaded menu photos live on that disk. The free instance type has no disk: every deploy and restart would wipe the shops and orders. |
| PayPal sandbox app keys | [developer.paypal.com](https://developer.paypal.com) → **Apps & Credentials** → **Sandbox** → your app → **Client ID** and **Secret**. |
| An Anthropic API key | [console.anthropic.com](https://console.anthropic.com) → **API keys**. |
| Optional: a sandbox Business account email | **Testing Tools** → **Sandbox Accounts** in the PayPal Developer Dashboard. If you set it as `PAYPAL_SANDBOX_SELLER_EMAIL`, the seeded demo shop is paid into that account (like any seller's shop) instead of the app's own account. |
| A sandbox Personal account (email and password) | Same page. You pay with it in the smoke test. Use one in the **same country as the seller account** (PayPal refuses some cross-country sandbox wallet payments, for example India to India). |

## 1. Create the service from `render.yaml`

1. Sign in to the Render Dashboard and choose **New → Blueprint**.
2. Connect GitHub if Render asks, then pick the repo and the `main` branch. Render finds `render.yaml` at the repo root and shows one web service, `shelfie`, with the disk `shelfie-data`.
3. Render asks once for every variable marked `sync: false`. Enter:

   | Key | Value |
   |---|---|
   | `PAYPAL_CLIENT_ID` | The sandbox app's Client ID |
   | `PAYPAL_SECRET_KEY` | The sandbox app's Secret |
   | `ANTHROPIC_API_KEY` | Your Anthropic API key |
   | `PAYPAL_WEBHOOK_ID` | Leave empty. You create the webhook in step 3, after the service has a URL. |
   | `PAYPAL_SANDBOX_SELLER_EMAIL` | Optional (see above). Leave empty to have the demo shop paid into the app's own sandbox account. |

   Don't set `APP_URL`. The app uses `RENDER_EXTERNAL_URL` (`https://<service>.onrender.com`), which Render sets on every web service. Set `APP_URL` only if you add a custom domain, and then to `https://your.domain`.

   `render.yaml` already sets `NODE_VERSION=22`, `PORT=10000`, `DATABASE_PATH=/var/data/shelfie.db` and `UPLOADS_DIR=/var/data/uploads`.

   **Never set `SHELFIE_ALLOW_GUEST_SHOPS` or `SHELFIE_TEST` in production.** They are for test harnesses: the first lets anyone start a shop with no account, and the second turns off the setup rate limits. Shelfie ignores `SHELFIE_ALLOW_GUEST_SHOPS` when `RENDER` is set, which Render does for you; on any other host only your own configuration keeps it off.

   `SUPPORT_EMAIL` is optional and isn't in the Blueprint. To show a contact address on `/help`, add it on the service's **Environment** page. Unset, Help points at GitHub Issues.
4. Click **Apply**. Render runs `npm ci && npm run build` (about 3–5 minutes on Starter), then `npm start`. It routes traffic only after `GET /api/health` returns `{"ok":true}`.
5. When the service shows **Live**, copy its URL from the top of the service page. The rest of this guide calls it `$BASE`, for example `https://shelfie-abcd.onrender.com`.

Later changes to secrets go on the service's **Environment** page; Render prompts for `sync: false` values only when the Blueprint is first created. Saving that page redeploys the service.

## 2. Publish the demo shop

1. Open the service → **Shell**.
2. Run:

   ```bash
   npm run seed
   ```

   It publishes Marigold Bakehouse's 9 products to your sandbox catalog and prints the shop link, the agent door link and, this one time only, the **owner link** (`/claim/<token>`). Keep the owner link private: it opens the seller dashboard. The demo shop belongs to no account, so this link is the only way into its dashboard; everyone else signs up and makes their own shop. The landing page shows its "See an example shop" link only after this step. If the printed links say `localhost`, the Shell didn't get `RENDER_EXTERNAL_URL`; replace the origin with `$BASE` by hand (the links are otherwise right).
3. Check the payee line the seed prints: either the seller account (masked) or "the app's own PayPal account".

## 3. Create the PayPal webhook

Locally, payments are confirmed by the return URL and a 15-second poller. A public URL lets PayPal tell Shelfie directly.

1. In the PayPal Developer Dashboard: **Apps & Credentials** → **Sandbox** → your app → scroll to **Sandbox Webhooks** → **Add Webhook**.
2. **Webhook URL:** `$BASE/api/paypal/webhook`
3. **Event types:** tick `Checkout order approved` (`CHECKOUT.ORDER.APPROVED`), `Payment capture completed` (`PAYMENT.CAPTURE.COMPLETED`) and `Payment capture denied` (`PAYMENT.CAPTURE.DENIED`). Save.
4. Copy the new webhook's **Webhook ID** from the list.
5. In Render: the service → **Environment** → set `PAYPAL_WEBHOOK_ID` to that ID → **Save Changes**. Wait for the redeploy to go **Live**.

Until `PAYPAL_WEBHOOK_ID` is set, the webhook route answers 503, PayPal retries the delivery later, and the poller still confirms payments, so nothing is lost.

## 4. Smoke test

Run these from your own machine. Each step says what passing looks like.

```bash
BASE=https://<service>.onrender.com
DOOR=$BASE/s/marigold-bakehouse/mcp
H='-H Content-Type:application/json -H Accept:application/json,text/event-stream'
```

1. **Health:** `curl -s $BASE/api/health` → `{"ok":true}`.
2. **Pages:** open `$BASE` (the landing page), `$BASE/s/marigold-bakehouse` (the menu with its photo and the agent door block), `$BASE/help`, `$BASE/terms` and `$BASE/privacy`.
3. **Discovery:**
   - `curl -s $BASE/s/marigold-bakehouse | grep -c 'application/ld+json'` → `1` or more;
   - `curl -s $BASE/s/marigold-bakehouse | grep -o '<link rel="alternate"[^>]*>'` → a link whose `href` is `$DOOR`;
   - `curl -s $BASE/agents.txt` and `curl -s $BASE/llms.txt` → text that lists Marigold Bakehouse with `$DOOR`.
4. **The door lists the menu:**

   ```bash
   curl -s -X POST $DOOR $H -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_products","arguments":{}}}'
   ```

   → JSON with sections and items that have `item_id`, `option_id` and prices.
5. **The door refuses a price:** the same call to `create_order` with `"price": 0.01` in an item → `INVALID_ARGUMENTS` ("`price` is not accepted; prices are set by the shop").
6. **A real order, paid:**
   1. Open `$BASE/s/marigold-bakehouse?assistant=1` and type: `Two almond croissants for pickup, please. Yes, place it.` The assistant reads the order back, then shows **Approve $… on PayPal**.
   2. Click it. On PayPal, log in as the sandbox Personal account and click **Complete Purchase**. (If the demo shop is paid into the app's own account, **Pay with Credit or Debit Card** also works: country United States, card `4012000033330026`, any future expiry, CVV `123`, a US address.)
   3. PayPal returns you to `$BASE/o/<ref>`, which says **Paid** and who was paid.
7. **The webhook arrived:**
   - PayPal Developer Dashboard → **Testing Tools** → **Webhooks Events** (sandbox): the `CHECKOUT.ORDER.APPROVED` and `PAYMENT.CAPTURE.COMPLETED` events for this order show delivery status **200**. (The return URL usually captures first; the webhook then finds the order already paid, which is the expected answer.)
   - Or, in the Render Shell:

     ```bash
     node -e "const D=require('better-sqlite3');const db=new D(process.env.DATABASE_PATH);console.log(db.prepare('SELECT event_type, verified, received_at FROM webhook_events ORDER BY received_at DESC LIMIT 5').all())"
     ```

     → rows with `verified: 1`.
   - **Not verified yet for seller-paid orders:** whether PayPal sends the `PAYMENT.CAPTURE.*` events for a capture paid into a seller's account to the platform app's webhook. If it doesn't, the poller still confirms those payments. Record what you see.
8. **The seller side:** open the owner link from step 2 → the dashboard shows the order with its AI brief.
9. **A hosted assistant:** in Claude (claude.ai) → **Settings** → **Connectors** → **Add custom connector**, paste `$DOOR`, then ask it to order from Marigold Bakehouse. It should call `get_shop_info`, `list_products` and, after you say yes, `create_order`, and give you a PayPal link.
10. **Rate-limit key (review 2, X1):** from two different networks (for example a laptop on Wi-Fi and a phone on mobile data), each sends a few console turns. One network hitting the limit (20 turns an hour) must not block the other. Render's `X-Forwarded-For` ends in a shared Cloudflare address, so the app keys on `CF-Connecting-IP` when `RENDER` is set; this is the first time that runs for real.
11. **Guest shops are off:** `curl -s -o /dev/null -w '%{http_code}\n' -X POST $BASE/api/shops -H 'Content-Type: application/json' -d '{"sample":"marigold-bakehouse"}'` → `401`.
12. **An account:** open `$BASE`, tap **Add your shop** and sign up. Save the recovery key, tap **Continue**, publish a sample with a sandbox Business email, and check the shop appears at `$BASE/shops`. Log out, then log back in at `$BASE/login`.
13. **The cart:** on the shop you just published, add an item, tap **View order**, then **Approve $… on PayPal**, and pay by logging in as the sandbox Personal account. The receipt says **Paid**.

## 5. After it passes

- In `README.md`, replace "**Not yet run.**" under **Deploy to Render** with the URL and the date you verified it, and put the URL at the top of the README.
- `/terms` and `/privacy` are templates, not legal advice. Review them before real sellers sign up.

## If something goes wrong

| What you see | Why, and what to do |
|---|---|
| The build fails at `npm ci` with an engine error | `NODE_VERSION` isn't 22. Check the service's **Environment** page. |
| The deploy never goes Live; `/api/health` answers 503 `DB_UNAVAILABLE` | The disk isn't mounted at `/var/data`. Check **Disks** on the service; a free instance type can't have one. |
| PayPal sends the buyer back to `http://localhost…` | `APP_URL` is set to localhost. Delete it on the **Environment** page (or set it to `$BASE`). |
| The webhook shows 400 in PayPal's event list | `PAYPAL_WEBHOOK_ID` belongs to a different app or webhook. Copy the ID again from the same app whose Client ID the service uses. |
| The webhook shows 503 | `PAYPAL_WEBHOOK_ID` is empty. PayPal retries; set it and redeploy. |
| The assistant answers "isn't set up" | `ANTHROPIC_API_KEY` is missing or wrong. |
| PayPal says "This seller doesn't accept payments in your currency" | The buyer and seller sandbox accounts are in countries PayPal won't pair (India to India is one). Use a US Personal account with a US seller, or the card option on the demo shop. |
