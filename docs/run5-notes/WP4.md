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

## Step 3: Panel, Orders, Menu, order detail, counter card

- **Panel:** `ui/panel.tsx` also exports `PANEL_ROW` (for the order row's own grid), `PANEL_HEAD` and `PanelTitle` (so the collapsible Waiting group, a `summary`, shares the title row) and `PanelValue`.
- **Deviation, order rows use a container query, not `lg`:** the brief's `lg:contents` wrapper and the row's `lg:` columns assumed a full-width page. With the 15rem sidebar the row's minimum (over 53rem of fixed columns) is wider than the content at 1024 and the list's `overflow-hidden` clipped the action. The row's one-line layout is `@[60rem]` of the list (columns narrowed by 3rem), the stacked layout (status and action on one line) below it. At 1280 the content is 59rem, so it stays stacked.
- **Deviation, Menu's two columns at `xl`:** at `lg` the sidebar leaves the item list about 19rem beside the 22rem column. `Photos in one go`'s `order-first` applies below `xl`, not below `lg`.
- **Menu rows follow the row rule:** under `@xl` the Sold out switch drops under the text, right-aligned, so the switches still form one column. It adds about 45 px a row on a phone. Keeping it beside the text leaves names about 125 px wide. Worth a look when the coordinator reviews 390.
- **`PageHeader`:** the description moved under the title row, so an action beside the title no longer squeezes it into a narrow column at 390 (Menu's counts, the Counter card sentence).
- **`AppNav`:** the bar's list is 1 px shorter, to fit the bar's top rule (the nav's bottom was 845 at 844).
- **Counter card at 390:** the QR is 46% below `@md` so the footer fits the 5:7 preview; at the printed 5 in width it is unchanged.
- `tests/ui/working-screens-type.test.ts` is not written yet: `SettingsPanel` and `LiveStep` still use `type-title`, and they belong to the Settings and Live steps. (Written in step 4.)

Edited tests (selectors and copy targets only):
- `e2e/discovery.spec.ts:134`: the draft card's `Finish setting up` link is scoped to `#app-content`, since the sidebar now has one too.
- `e2e/app-shell.spec.ts` (this package's own WIP spec): the chrome check asserts `body > header` and `body > footer` are hidden, per acceptance 7, instead of absent from the DOM; they are in the document and hidden by CSS.

## Step 4: Live, Share, Settings, states

- **Live, `Open your shop` below `xl` (deviation):** the brief has it in the header and in the compact preview. Rendered at 390 the header's button squeezed the H1 onto two lines ("Your shop / is live") and the same link sat 90 px below it. Below `xl` only the preview carries the link; from `xl` both, as briefed.
- **Live, heading levels:** the brief's rows are `h3`, and Live has no `h2` above them, so an `sr-only` `h2` "What to do next" keeps the outline in order.
- **Live, Retry is secondary:** the pending-items retry was primary, which made two black buttons on the screen.
- **Live, status from the store:** `Your shop is paused` follows the banner's Resume without a reload. `LiveStep` takes `shell` (the server's values) instead of `status`.
- **Live preview, `Example photo` pill:** when the hero is a library example the card says so, as the Menu does for sellers. The 40 px rows have no pill.
- **`shopStatusWord`** moved from `AppShell` into `shell-view.ts` so the sidebar and the Live preview say the same thing.
- **Share, Counter card on a raised `Card`** (white, no grey box), so its top lines up with the list beside it. The QR's inner `svg` is `aria-hidden`, so the region has exactly one image.
- **Share, `Dashboard` gets the QR as a prop** (`shareQr`, an SVG string from the page), since `SharePanel` is a client component.
- **Drafts:** `(dashboard)/page.tsx` sends `slug: ''` and no QR. `Menu` drops `See it on your shop`, and the Orders empty state says `Your shop takes orders once you publish it.` with `Finish setting up`, since there is no shop to try or share yet.
- **Settings, payee note:** `Your shop can’t take orders until you add your PayPal email.` now shows only on a draft. A live or paused shop already has the shell's banner saying the same thing directly above it. Both notes moved inside the form, so the form's top lines up with its heading (acceptance 19).
- **Settings, `LogoPicker` has `titled={false}`**, since the section heading already says "Your logo".
- **Pause:** the duplicate was already gone from Settings when this step started.
- **Pause race (found by a flaky e2e):** a slow pause answer arriving after the banner's Resume brought the banner back, though the server had ended on live. `togglePause` now ignores its own answer once the status has moved on. Regression: `e2e/app-shell.spec.ts`, "a slow pause answer".
- **Sign-in row:** `/login` and `/account` arrive with WP5/6. `currentShellAccount()` is still null here, so only `Log in` shows.
- **Seen, not changed (WP1's primitive):** labelled `CopyButton`s sit about 1-2 px higher than a `ButtonLink` beside them (`Copy` next to `Open` on Share).

Edited tests (selectors and copy targets only):
- `e2e/flow.spec.ts:78`: the owner-link assertion is inverted to `toHaveCount(0)`, since the brief drops it from Live. `:85`: `Open your shop` takes `.first()`, since the header and the preview both have it from `xl`.
- `e2e/screenshots.spec.ts`: removed the step that masked the owner link (brief, lines 490-497). It was a page edit, not an assertion, and the `code` element it targeted no longer exists.
- `e2e/app-shell.spec.ts` (this package's own spec): added Live, Share, Settings, draft Share, long-name, 1024 and non-owner checks.
- `tests/app/shell-view.test.ts`: added `shopStatusWord` cases. No existing assertion changed.

## Step 5: acceptance e2e

`e2e/app-shell.spec.ts` now covers acceptance 1 to 21 as numbered, with measurements (12 is the unit test `tests/ui/working-screens-type.test.ts`; the recovery-key banner, which needs an account until WP6, is in `tests/app/shell-view.test.ts`).

- **`data-shell-banner`** added to `ShellBanner`, so "only one banner renders" counts the slot, not every `role="status"` on the page (the toast region and live regions use that role too).
- **Print (10):** the print test itself is `e2e/discovery.spec.ts` "prints the card alone, on one page"; `app-shell.spec.ts` adds that the shell chrome, the skip link and the test-mode lines are hidden under print media at 390 and 1440.

Edited tests (selectors and copy targets only, nothing removed): `e2e/app-shell.spec.ts` only, this package's own spec. Tightened there: the site-chrome check now requires at least one `[data-site-chrome]` element and every one hidden; the door and shop URLs compare exact text rather than a suffix; the filter buttons also stay inside the viewport vertically.

