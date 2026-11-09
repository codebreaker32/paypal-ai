# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

**Shelfie** (idea A in docs/IDEAS.md): snap a photo of a price list → Claude reads it → PayPal catalog → a per-shop MCP "agent door" any AI assistant can order through → PayPal Orders v2 (approve + capture) → seller dashboard with AI briefs and tracking.
Spec: `docs/superpowers/specs/2026-11-06-shelfie-design.md`. Plan: `docs/superpowers/plans/2026-11-06-shelfie.md`. Progress: `docs/PROGRESS.md`. Decisions: `docs/DECISIONS.md`. Rubric (never edit): `docs/JUDGING.md`.

## Commands

```bash
npm install                 # Node >= 22
cp .env.example .env        # fill PAYPAL_CLIENT_ID, PAYPAL_SECRET_KEY, ANTHROPIC_API_KEY
npm run dev                 # http://localhost:3000
npm run build && npm start  # production
npm test                    # unit tests (Vitest), no network
npm run test:sandbox        # real PayPal sandbox calls (needs .env)
npm run test:ai             # real Claude extraction on public/samples (needs ANTHROPIC_API_KEY)
npm run typecheck && npm run lint
npm run e2e                 # Playwright (starts the app on port 3100; E2E_PORT overrides, E2E_REUSE_SERVER=1 attaches to a running one)
npm run screenshots:prod -- <dir>  # every judged screen (390/1440 + axe) against a production build
npm run clips               # raw demo clips (1920x1080, 30 fps) into video/clips/ (Xvfb + ffmpeg; see video/clips/README.md; --only 03- for one clip)
# Video pipeline (video/README.md): Kokoro voice + Remotion, its own package in video/remotion (npm ci there first)
cd video/remotion && npm run voice   # narration from video/project/demo.json -> video/project/audio/, SCRIPT.md, video/shelfie-demo.srt
cd video/remotion && npm run render  # video/out/shelfie-demo.mp4 + poster.png, loudness-normalised to -14 LUFS (clips in video/project/clips/; render:animatic draws missing ones as placeholders)
node video/tools/align-cuts.mjs video/project/demo.json <oldClipsDir> video/clips  # re-align the edit's cut points after re-recording clips
npm run seed                # publish the demo shop (-- --reset recreates it; -- --cancel-unpaid cancels its unpaid rehearsal orders); prints the owner link once; paid to PAYPAL_SANDBOX_SELLER_EMAIL when set, else the platform account
# photo -> live timing against a running app (see the header of the script for the DATABASE_PATH setup):
DATABASE_PATH=data/measure/m.db BASE_URL=http://localhost:3109 npx tsx scripts/measure-photo-to-live.ts [runs]
```

## Architecture

- **Next.js 16 App Router + TypeScript**, one web service (Render-ready). `cacheComponents` is off: every page reads per-request SQLite/cookies. Route handlers that touch SQLite/sharp/PayPal use `export const runtime = 'nodejs'`. In Next 16, `params`/`searchParams`/`cookies()` are async (await them); read `node_modules/next/dist/docs/` before using an unfamiliar API.
- **SQLite** via `better-sqlite3` (`src/lib/db`, schema in `schema.sql`, plain-function repos in `src/lib/db/repos`). Money is integer cents (`src/lib/domain/money.ts`).
- **Domain contracts** in `src/lib/domain/types.ts` and `src/lib/paypal/types.ts` (`PayPalPort`; `createFakePayPal()` for tests).
- **PayPal**: our typed REST client for money paths (orders, capture, catalog publish, webhook verify) with per-call `PayPal-Request-Id`; `@paypal/agent-toolkit` for seller-side tools (brief agent reads `get_order`/`get_shipment_tracking`; tracking via `create_shipment_tracking`). Sandbox only.
- **Claude** via `@anthropic-ai/sdk`, model `claude-sonnet-5-5`: `messages.parse` + `zodOutputFormat` for menu extraction; beta `toolRunner` for the brief agent and the in-app buyer console. Never send `temperature`, forced `tool_choice`, or `thinking: disabled`.
- **MCP agent door**: `POST /s/[slug]/mcp`, stateless `WebStandardStreamableHTTPServerTransport`, fresh `McpServer` per request.
- **Orders**: pure state machine + compare-and-set writes (`src/lib/orders/`); paid via return URL, webhook (deployed only) or the 15 s poller. The buyer's receipt view is `src/lib/orders/receipt.ts` (page `/o/[ref]`).
- **Paying each seller** (spec §8a): every order sets `purchase_units[0].payee.email_address` from the shop's PayPal email (`shops.payee_email`, snapshotted on `orders.payee_email`; rules in `src/lib/domain/payee.ts`). Only the demo shop (`marigold-bakehouse`) may have none and is then paid to the platform account. Seller-paid orders are paid by PayPal wallet login (verified with the US sandbox buyer, `e2e/paypal-buyer.ts` `payWithPayPalLogin`); guest card checkout works only on platform-paid orders. PayPal refuses platform tracking on a seller's capture, so their tracking is saved in Shelfie only. A payee email with no PayPal account leaves the capture PENDING (`UNILATERAL`), shown to the seller.
- **Routes**: every seller screen sits inside the shell: `src/app/shops/[id]/(app)/layout.tsx` calls `requireOwner` and renders `AppShell` (`src/components/app`: sidebar from `lg`, top and tab bars below it, one banner slot, live values in `shell-store.ts`). Inside it, the dashboard is the `(app)/(dashboard)` route group (sections Orders · Menu · Share · Settings via `?tab=`, switched client-side by `SectionLink`, with its loading and `(app)/error.tsx` states inside the shell); the printable counter card is `(app)/card`; order detail is `(app)/orders/[orderId]`. Setup is `shops/[id]/setup`, outside the group, and renders `AppShell` only for its Live step. A non-owner gets a real 404 with the public header, except that a browser that has logged in before and has no session goes to `/login`. A draft's slug never reaches the page. Accounts: `(auth)` holds `/signup`, `/login`, `/recover`; then `/shops` (list), `/shops/new`, `/account`. Public: `/` (`src/components/landing`: Hero, HowItWorks, Faq, Closing; a logged-in visitor redirects by `landingPath`), `/help`, `(legal)` `/terms` and `/privacy`. The owner link is `/claim/[token]`, for unattached shops only (the seed and harness, never shown on Live; an account shop's token answers 404); discovery (spec §10a) is JSON-LD + `<link rel="alternate">` on `/s/[slug]` and `/agents.txt`, `/llms.txt` (`src/lib/discovery/`); the buyer console API is `/api/assistant/[slug]`. Rate-limit keys use `src/lib/http/client-ip.ts` (rightmost `X-Forwarded-For`). JSON and webhook bodies are read through `src/lib/http/read-body.ts` (64 KB cap, 413). Setup rate limits (`allowSetup`) are skipped when `SHELFIE_TEST` is set. `SHELFIE_RECORDED_SAMPLES=1` makes sample menus use their recorded reading even with a key (demo recording).
- **Photos**: `items.photo_url` / `shops.cover_url` hold a site-relative URL or null. Bundled demo photos are `public/demo/<shop-slug>/` (map in `src/lib/demo/photos.ts`, credits in `docs/ASSETS.md`; only `npm run seed` applies them). Sellers upload through `POST`/`DELETE /api/shops/[id]/items/[itemId]/photo` and `/api/shops/[id]/cover` (`src/lib/catalog/photos.ts`: the menu upload's decoder, WebP, `${UPLOADS_DIR}/items/`), served by `GET /i/[file]`; browser calls in `src/lib/client/item-photos.ts`. The public shop page's menu tiles, cover and photo avatar add a `srcset` of resized WebP copies from Next's image optimizer (`src/lib/images/responsive.ts`; the `src` stays the original, which tests and agents read); `images.localPatterns` in `next.config.ts` allows only `/samples/**`, `/demo/**` and `/i/**` with no query, so any other optimized path is a 400 (`tests/images/local-patterns.test.ts`). The menu photo routes take `?size=avatar` (a 160 px square). Lighthouse on `/s/marigold-bakehouse` (mobile, production build) is 91 (`docs/judge/evidence/lighthouse-shop-mobile.json`). Agents get absolute URLs (`image_url` in `list_products`, `image` in the JSON-LD). "Snap your counter": `POST /api/shops/[id]/counter` sends a display-case photo to Claude (`src/lib/ai/counter.ts`) and returns one 4:3 WebP crop per item found (`src/lib/catalog/counter.ts`), stored nowhere; the seller keeps one by uploading it through the item-photo route.
- **Example photos (Part A3)**: an item's picture is, in order, the seller's own photo (`items.photo_url`, which also holds a kept "Snap your counter" crop), else an *example* photo from the bundled library (`public/library/<id>.webp`, catalogue `src/lib/library/catalog.ts`, Pexels-licensed, credits in `docs/ASSETS.md`), else the category drawing. `src/lib/library/picture.ts` (`itemPictures`/`pictureOf`) is the only place that decides it. Claude picks `example_photo` (a library id) while reading the menu; unpicked items match by name and category (`src/lib/library/match.ts`). With `PEXELS_API_KEY` set, unmatched items are searched live after a reading (`src/lib/library/pexels.ts`, cached in `library_cache`, files under `${UPLOADS_DIR}/library`, served by `GET /i/library/[file]`). Buyers see a small "Example photo" note (`ExampleNote`), sellers "Example photo, replace with yours"; agents (`image_url`) and the JSON-LD get only the seller's own photos, never an example.
- **Design and brand**: photo-first "Storefront" direction (white page, Figtree with `text-rendering: geometricPrecision`, one pomegranate accent `#c21a4b`); tokens in `src/app/globals.css`, system in `docs/DESIGN.md`. Primitives are shadcn-based (`components.json`, new-york) in lowercase files under `src/components/ui` (`@/components/ui/button`); `cn()` is `@/lib/utils` (clsx + tailwind-merge, `cx` is an alias); shadcn's colour names map onto our closed palette in `@theme`. Errors use `error` (vermilion, never the accent); helpful notes (AI brief, allergy) use `note`. Motion: `motion` under `MotionProvider` (root layout: `LazyMotion` strict + `MotionConfig reducedMotion="user"`, so use `m.*`, never `motion.*`); primitives `Reveal`, `Stagger`/`StaggerItem`, `Pressable`, `CountUp`, `StatusSwap` in `src/components/motion`; only transform and opacity animate. An element that starts hidden for an entrance carries `data-entrance` (or a motion `data-slot`) so the motion-off fallback shows it (`tests/ui/motion-off.test.ts`); `Reveal` reads reduced motion through `usePrefersReducedMotion` (reactive; motion's own hook reads it once). The logo ("Awning": a pomegranate scalloped awning over an ink instant print, plus a drawn wordmark; rules in `docs/DESIGN.md` "Logo") is `Logo`/`LogoMark` in `src/components/brand/Logo.tsx` (paths from `logo-paths.ts`, generated with the files in `public/brand/` and `docs/judge/logo/final/` by `node docs/judge/logo/tools-B/build.mjs final`); never set "shelfie" in Figtree as the logo. The favicon `src/app/icon.svg` turns its ink white in dark mode; the Open Graph image is `src/app/opengraph-image.png` (`node scripts/make-og-image.mjs`). **PWA**: `src/app/manifest.ts` + `src/lib/brand/pwa.ts`, icons by `npx tsx scripts/make-icons.ts public/brand/mark.svg '#ffffff'` (white tile, maskable art inside the 80% safe circle), no service worker on purpose; `E2E_PORT=3150 npx playwright test e2e/pwa.spec.ts` checks installability in full Chromium.
- **Services**: `src/lib/services.ts` is the composition root (db, PayPal client or fake, toolkit, Anthropic).
- **Seller auth** (`src/lib/auth`): accounts with email and password (scrypt `password.ts`, 15 to 128 characters `password-policy.ts`), 30-day server-side sessions (`session.ts`, the cookie is a random token and the DB holds its SHA-256) and a one-time recovery key (`recovery.ts`, no email provider). `owner.ts` decides ownership: an account's shop answers only to that account's session; an unattached shop (seed, harness) to its per-shop httpOnly owner cookie (hash stored). Guest shops need `SHELFIE_ALLOW_GUEST_SHOPS=1` (`guest.ts`, harness only, ignored when `RENDER` is set, never in production).
- **Cart**: a tile opens the item sheet (`shop/ItemSheet.tsx`, `?item=<id>`); `+` adds a single-option item directly. `shop/use-cart-state.ts` stores only `{itemId, optionId, qty}` in `localStorage` (`shelfie:cart:<slug>`, 24 h); client totals are display-only. `POST /api/checkout/[slug]` (same-origin, rate-limited before the body, strict zod refuses any price, totals from `priceOrder`) calls `createOrderForShop` as `STOREFRONT_AGENT_NAME` with a 20-minute approval window; an agent claiming that name is recorded as unnamed. From 1024 px the cart shares the assistant's dock, one panel at a time.
- **Sound** (`src/lib/feedback`): oscillators only, no audio files, no `AudioContext` before the first gesture. `Tactile` plays `tick` on every press; `feedback('add')` and the dashboard's `order` chime are the others. One per-device switch for sound and vibration (`shelfie:feedback:v1`): `SoundToggle` in the footer, `Sound and vibration` in Settings.
- **Tests** live in `tests/` (unit), `tests/sandbox` and `tests/ai-live` (network), `e2e/` (Playwright).

## Context: PayPal AI Hackathon

This project is an entry for the PayPal AI Hackathon ("Build what's next with PayPal and AI", https://paypalaihackathon.devpost.com/). There are no tracks or set problem statements.

**Hard requirement:** the project must *meaningfully* use **both** PayPal (in the free sandbox environment) and AI. Judging Stage One is a pass/fail check that the project fits the theme and really uses the PayPal APIs/SDKs. PayPal has to be central to the project, not a payment button bolted on.

### Key dates (Pacific Time)
- Submission period: Oct 1, 2026 to **Nov 12, 2026, 12:00 pm PT** (hard deadline; the submission can't be edited after it)
- Judging: Dec 1–15, 2026. Winners are announced around Dec 21, 2026.

### Submission checklist (every item is required)
- A working prototype that judges can run: either complete setup and run instructions in the repo, or a hosted demo URL. Mockups and static prototypes are disqualifying.
- A **public** GitHub/GitLab/Bitbucket repo with all source, assets and run instructions, and an **open-source LICENSE file** that GitHub detects (it shows in the About section).
- The repo README must include any sandbox test account credentials and API keys the judges need, or instructions for getting them.
- A text description of the features, plus a list of the AI tools/models used and how each one is used.
- A demo video **under 3 minutes**, public on YouTube, showing the project working end to end. No third-party trademarks or copyrighted music.
- All materials in English.

### Judging criteria (Stage Two, equally weighted)
Technological Implementation (thorough, non-trivial use of PayPal and AI) · Design (a complete, coherent product, not just a technical PoC) · Potential Impact (a specific real problem for a real audience) · Innovation · Presentation (the video shows the project working end to end and makes clear the problem, the audience and why it matters).

### Prizes worth targeting
Overall prizes are 1st $12k, 2nd $8k and 3rd $5k. There are also $5k awards for Most Creative, Most Impactful, Best Demo Delivery, **Best Use of PayPal + AI** and **Best Use of Agentic Commerce**. Sponsor prizes: AG Grid ($5k/$2k/$1k), APIMatic, Bryntum, Channel3 and Render (credits). Sponsor tools are optional: AG Grid, APIMatic, Astropods, Bryntum, Channel3, Elastic, KERNEL, Postman, Render, Zapier.

### PayPal building blocks
- Core: REST API, JavaScript SDK v6, Checkout, the Developer Dashboard and sandbox accounts.
- Capabilities: Pay Later, Subscriptions, Invoicing, Payouts, Disputes, Donations, Webhooks.
- AI/agents: the PayPal Agent Toolkit (`paypal/agent-toolkit` on GitHub) and the PayPal MCP server. These are the most direct route to "Best Use of Agentic Commerce" and "PayPal + AI".
- Always use sandbox credentials. Keep the client ID and secret in env vars and commit a `.env.example`.
