# Installable on a phone (spec §4c)

`e2e/pwa.spec.ts`, run on main on 6 Nov 2026 (16:45 IST) with `PWA_OUT=docs/judge/evidence/pwa E2E_PORT=3150 npx playwright test e2e/pwa.spec.ts`: **1 passed**.

- **`Page.getInstallabilityErrors` returned `[]`** in full Chromium (new-headless, a persistent profile). Playwright's default headless shell answers `[]` even for a page with no manifest, and its normal contexts are incognito, so the test uses neither.
- **The check can fail:** with `public/icons/` moved away, the same test failed with `["no-acceptable-icon"]`.
- `manifest.json`: the manifest as served (`/manifest.webmanifest`, from `src/app/manifest.ts`): name and short name Shelfie, `start_url` `/`, `display: standalone`, theme and background `#ffffff` (the page surface token).
- `icons.png`: the icons as served, at 256 px each: 192 any, 512 any, 512 maskable (the glyph kept inside the 80% safe zone), and the 180 px apple-touch-icon. Drawn from the brand mark (`public/brand/glyph.svg` on the accent `#c21a4b`) by `scripts/make-icons.ts`.
- The page has `apple-mobile-web-app-capable` (or `mobile-web-app-capable`) `yes`, a status-bar style and a `theme-color` that matches the manifest.
- **No service worker is registered**, so no order, payment or dashboard page is ever served from a cache.
