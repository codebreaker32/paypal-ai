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
- `tests/ui/working-screens-type.test.ts` is not written yet: `SettingsPanel` and `LiveStep` still use `type-title`, and they belong to the Settings and Live steps.

Edited tests (selectors and copy targets only):
- `e2e/discovery.spec.ts:134`: the draft card's `Finish setting up` link is scoped to `#app-content`, since the sidebar now has one too.
- `e2e/app-shell.spec.ts` (this package's own WIP spec): the chrome check asserts `body > header` and `body > footer` are hidden, per acceptance 7, instead of absent from the DOM; they are in the document and hidden by CSS.
