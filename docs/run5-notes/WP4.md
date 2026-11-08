# WP4 notes

## Step 1: the no-visual route-group move

URLs are unchanged: `(app)` and `(dashboard)` are route groups. `(app)/layout.tsx` is a pass-through that calls `requireOwner`; `AppShell` arrives in a later step.

Edited tests:
- `tests/discovery/card-page.test.ts`: import path only, the counter card page moved to `src/app/shops/[id]/(app)/card/page`.

## Step 2: app shell

- **Sidebar landmark:** the brief lists both "the sidebar is `<nav>`, not `<aside>`" and a named `<nav aria-label="Shop sections">` inside it holding exactly the four links. A `<nav>` inside a `<nav>` adds a landmark without purpose, and `appNav` must match only the four links. Smallest resolution: the sidebar is a plain `<div>` whose landmark is the inner nav. `aside` is still avoided.
- **Account:** `currentShellAccount()` is null until WP5/6, so the slot shows `Log in` (to `/login`, which arrives with WP5). The account branch links to `/account`; the real `AccountMenu` replaces it in WP6. In the top bar the 44 px icon is named `Log in` without an account, `Account` with one.
- **Skip link:** `position:fixed` and off-screen until focused (rather than `sr-only`), because it now sits inside the root `<main>`, where the `a11y` helpers measure controls and would count a 1 px target.
- **`document.title`:** set in `Dashboard` (an effect on the section) rather than in the click handler, so Back and Forward update it too.
- **`SectionLink` `prefetch`:** off while already on the dashboard (it would fetch the page it is on). From order detail and the card, links prefetch as usual.

Edited tests (selectors and copy targets only):
- `e2e/helpers.ts`: adds `appNav(page)`.
- `e2e/dashboard.spec.ts`: role=tab to the app nav (`aria-current`), tabpanel to `[data-section-panel]`, H1 to `Orders`.
- `e2e/discovery.spec.ts`, `e2e/menu-tab.spec.ts`, `e2e/screenshots.spec.ts`: role=tab selectors; `menu-tab` header selector becomes `shop-switcher`; the screenshot's order-detail back link is now `Back to Orders`.
- `e2e/flow.spec.ts:79`: asserts the `Orders` nav link href. Line 78 (the owner link) stays until the Live section drops the owner link.
- `scripts/clips/record.ts`: role=tab selectors to the app nav.
