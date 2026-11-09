# WP4 + WP1B review round 1 (merged tree)

All confirmed findings fixed at the root; no item rejected.

## What changed

- **Shell store vs cached payloads (2 major):** `shell-store.ts` now keeps one entry per shop with a `stamp` (the later of the server read and the last change). `seedShell(shopId, values, readAt)` ignores a payload that is not newer than the stamp, so a prefetched layout or the one Back restores cannot undo a Pause, Resume, save or upload. `ShellData.readAt` comes from `loadShellData`. Payload clock vs device clock are compared directly; a wrong device clock costs at most a kept payload landing or a fresh one waiting for the next full load (noted on the function).
- **Dashboard no longer holds `coverUrl`, `logoUrl`, `payeeEmail` in local state:** on Back the page returns with its first-load props, so these are read from the store and written with `patchShell`. `payeeEmail` is optional in `ShellValues` (set only once edited; until then the prop is correct). Its mount effect patches only what a poll can find (`toPrepare`, `paypalDown`), which the 5 s poll corrects anyway.
- **`(app)/error.tsx` reachable (minor):** `loadShellData` catches an orders-read failure (safe defaults, `console.warn`), so the layout renders and the page's own read fails inside the shell. Also fixes `/card`, which needs no orders.
- **Order detail skeleton:** `(app)/orders/[orderId]/loading.tsx` matches the page (no second gutter, list from `xl` at 20rem).
- **Resume focus:** focus moves to the H1 before the banner unmounts, and a persistent `sr-only` status region says `Agent orders are on again.`
- **Working-screen type:** order detail `SectionTitle` and `BriefCard`'s two `type-heading` lines are `type-section`; `tests/ui/working-screens-type.test.ts` gained a check for both files (additive).
- **Draft slug:** `loadSetupView` sends the slug only for the demo shop (`isDemoShop`), the one case the page uses it.
- **Counter card:** every size is `cqw` (preview at any width and the 5 in print are one layout), the name steps down by length (`card/name-size.ts`, clamp to 3 lines), and the QR takes the remaining height, so long names shrink the QR instead of pushing the footer off the card.
- **Order rows:** identity column back to 14rem (status 8.5rem, about 100 px was idle); below the one-line width, `via {agent}` sits on its own line under the buyer, so it no longer truncates to `via Cl…`.
- **Filter pills:** track is `w-max min-w-full`, padding tightened on phones, and counts over 99 show `99+` under `sm` (the full number stays for screen readers and wider screens), so four segments fit at 390 and the pill never spills.
- **Copy button:** `CopyLabel` wrapper is `grid`, removing the baseline strut (Share/Live labels now level with their neighbours).
- **`text-rendering`:** `button, input, select, textarea { text-rendering: inherit }` in the base layer.
- **Sidebar:** View your shop and the account row use the nav row's gap and icon size, so labels share one edge.

## Edited tests (selectors, routes and copy targets; no assertion removed)

- `e2e/sounds.spec.ts`: `getByRole('tab', {name})` -> nav links (`sectionLink`), the WP4 change; added `a section link`; `a tab` now targets the real tab in `AgentDoor` on `/s/{slug}#agent-door`; the footer toggle checks at the end of `none when off` and in the axe test moved to `/`, where the toggle shows (it is hidden in the shell), keeping the assertions.
- `tests/app/shell-store.test.ts`, `tests/app/shell-data.test.ts`, `tests/catalog/setup.test.ts`, `tests/ui/working-screens-type.test.ts`, `e2e/app-shell.spec.ts`: additions only.
- New: `tests/ui/card-name-size.test.ts`.

## Test edit by the coordinator (session 6)
`e2e/dashboard.spec.ts` "Add tracking on an order row": the expected form top goes from 16 to 72. WP4's sticky 56 px top bar and its `scroll-padding-top` (brief, WP4 tokens) move the landing point by exactly the bar's height, so 16 would mean the form sits under the bar. The assertion stays; only the number follows the brief.
