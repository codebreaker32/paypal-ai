# Dashboard loading skeleton (`dashboard-loading`)

An addition to the round-3 set (`round-3/README.md` is a judged record and is left as it was, including its line that the skeleton "could not be captured reliably"). From now on `e2e/screenshots.spec.ts` takes this screen with the rest, so a full run has 68 screens.

- `dashboard-loading`: **mocked**. The seller is on an order and taps "Orders" to go back. The link's prefetch (the dashboard layout and `(dashboard)/loading.tsx`) is answered by the server. The page request the tap makes (an RSC GET with no `Next-Router-Prefetch` header) is held in the page's `fetch` and never answered (`holdNavigation` in `e2e/helpers.ts`), so the skeleton stays on screen. The test waits for the prefetch's answer before tapping, and taps again if the router took the tap before it had stored the prefetch. It checks that the URL is the dashboard and the hidden status reads "Loading your orders". This needs a production build: Next only prefetches links in view in production, so a dev-server run skips this screen. The app code is unchanged; axe found no violations at either width.

Files: `dashboard-loading-390.png`, `dashboard-loading-1440.png`. They come from one production run of the whole spec (`npm run screenshots:prod`, a fresh e2e database): 68 screens passed with no retries.
