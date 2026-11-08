# WP2 notes (surfaces task)

Built: assistant tokens in `globals.css`; `src/components/shop/assistant-shell.css` (the brief's CSS, verbatim); `data-page-frame` on `Frame`, the shop page wrapper and the `Cover` wrapper; `shop/AssistantShell.tsx`, used by the dock (`<aside data-assistant-dock>`, from 1024 px), the side sheet (640 to 1023) and the bottom sheet (under 640); `Sheet` gains `bare`, `labelledBy`, `initialFocusRef`, `fallbackFocusRef`; `ui/sheet.css` is the shared CSS motion for every other sheet (`open:animate-rise-in` is gone, no `data-closing`, no `media` prop).

Existing tests edited: none.

Tests added: `e2e/assistant-layout.spec.ts` (11 tests): acceptance 1, 2, 3, 4, part of 13 (phone focus on the `H2`), 6, 7, 8, 10, 18 at the widths the brief names.

Checked: `npm test` (1279), typecheck, lint, `e2e/assistant-layout.spec.ts`, `e2e/shop.spec.ts`, `e2e/menu-tab.spec.ts` (the `Sheet` callers), and screenshots of the three forms, empty and with a replayed order.

## Deviations and choices the brief left open

| Where | What | Why |
|---|---|---|
| `ui/sheet.css` | New file, not in the brief's list | The "every other sheet" motion needs a home next to `Sheet`; same pattern as `console-motion.css`. A `bare` Sheet does not get it, so the assistant keeps its own motion. |
| `BuyerConsole.tsx` | New export `ConsoleActions` | Footer row needs the same conditions the log used; they moved with it. `Start a new conversation` (conversation full) stays in the log, as the brief says errors and full stay inline. |
| `Start over` | `ml-auto` on the ghost | Keeps it at the right edge when the payment button is absent (`justify-between` would drop it left on its own). The two buttons need about 400 px, so they wrap to two rows at every width today (measured at 1440, 1024 and 390); the brief's `flex-wrap` allows it. |
| `AssistantShell.tsx` | Footer also has `flex flex-col gap-3` | Space between the action row and the composer; the brief's list is otherwise exact. |

## For the next task

- Still to do from the WP2 brief: only the auto-growing `<textarea>` composer (WP3's).
- `AssistantShell` already takes `inputRef` and `titleRef`; `Sheet` already has `initialFocusRef` and `fallbackFocusRef` (wired to the `h2` and the order bar button).
- `[scrollbar-gutter:stable]` reserves about 15 px on the right where scrollbars are classic (desktop Chrome on Linux or Windows), so the log's right edge sits that far inside the footer's. Overlay scrollbars (phones) have no gap. Kept, as the brief specifies the class.

## Entry points task

Built: `shop/OrderCta.tsx` (`orderCtaShown` pure rule, context, `HeroOrderCta`, `CompactOrderCta`); `ShopAssistant` is one column in `mx-auto max-w-page px-gutter`, `@container/shop` on the inner div, side card and grid gone; order bar centred at `max-w-md` from 640 px; `SectionTabs` keeps its sticky styles on a wrapper with `nav` and the button as siblings; the not-taking-orders greeting (`ConsoleConversation`/`AssistantShell` take `takesOrders`).

Tests added: `tests/components/order-cta.test.ts`, `tests/components/console-greeting.test.ts`, the `entry points` block in `e2e/assistant-layout.spec.ts` (acceptance 5, neither while docked, focus back to the button showing, bar at 640 and 1023, one-section shop). Existing tests edited: none.

| Where | What | Why |
|---|---|---|
| `globals.css` | `--shop-tabs-h` is 3.5rem from 1024 px | A 44 px md button in a 48 px row touched the row's edges. Section `scroll-mt` already reads the token. |
| `SectionTabs` | Compact button keeps its width while hidden | The tabs do not reflow when it fades in. Scrolling a long tab row a little earlier is the cost. |
| `CompactOrderCta row` (one section or none) | A `sticky h-0 -mb-6` anchor with the row absolutely inside it, fading in as a whole | The brief says the row renders only for the button. An in-flow row would leave an empty 56 px band under the hero while the button is hidden, and would shift the page when it appears. |
| Docked focus on close | The order button showing now (hero if in view, else compact) | The opener is unmounted while docked (neither shows), so the brief's fallback order applies directly. Under 1024 px `Sheet` already falls back to the order bar. |
| Copy | Greeting uses `’`, as the rest of the page's copy does | Same words as the brief's straight apostrophes. |

## Remaining behaviour task

Built: message scrolling (`shop/console-scroll.ts`, pure rules; `useConversationScroll` in `BuyerConsole.tsx`, replacing the old effect), the keyboard (`viewport` export, `shop/use-keyboard-viewport.ts`), `keepPlace`, the whole Focus table, Back and deep link. The `<textarea>` composer stays WP3's.

Tests added: `tests/components/console-scroll.test.ts`, `tests/components/keyboard-viewport.test.ts`; in `e2e/assistant-layout.spec.ts`, blocks `message scrolling`, `keyboard`, `the page holds still`, `focus`, `back and deep link` (acceptance 9, 11, 12, 13, 14, 15, 16). Existing tests edited: none.

Checked: `npm test`, typecheck, lint, `e2e/assistant-layout.spec.ts`, `e2e/shop.spec.ts`, `e2e/menu-tab.spec.ts`: 76 passed, 1 failed (below).

| Where | What | Why |
|---|---|---|
| `Sheet` | New optional `dialogRef` | `useKeyboardViewport(dialogRef, open)` needs the `<dialog>`, and only `Sheet` owns it. The brief's list of `Sheet` additions did not include it. |
| `shop/console-scroll.ts` | New file, not in the brief's list | The rules are pure, so they can be unit-tested (`scrollCause`, `scrollTarget`, `nearBottom`). |
| `keepPlace` | Sets `overflow-anchor: none` on the root for the change, removed on the next frame | Chromium's scroll anchoring corrects the same shift, so the brief's `scrollBy` alone corrected it twice. |
| `assistant-shell.css` | Under reduced motion, `body, [data-page-frame] { transition: none !important }` | `globals.css` gives every element a 0.01 ms transition there, which delays the dock's layout change by a frame or two, so `keepPlace` read a half-applied layout and scrolled the page by 69 px on close. |
| Scroller | Also follows a `ResizeObserver` on the scroller | A closed sheet has no height, so a restored log must go to its end when the sheet opens. The observer also keeps a following buyer at the bottom when the keyboard or the action row changes the scroller's height. |
| Closing | `history.back()` only while the open assistant owns an entry (`ownEntry`); a `goingBack` guard ignores a second close until `popstate` | A deep-linked or docked assistant has no entry to step back off, and a double tap on the X would otherwise leave the shop. |

Note for the merge: while the menu grid stays viewport-based, opening the dock moves nothing, so `keepPlace` has no effect until WP3's container-query grid lands. The e2e forces a height change to test it.

## Acceptance e2e task

`e2e/assistant-layout.spec.ts` now covers acceptance 1 to 18; test titles carry the numbers (`--grep "A6"`), 9 and 16 fake the visual viewport and the stream as the brief allows, with real wheel input in 16.

Added: composer box, input and Send inside the viewport (A2, A8); A3 for every `main`, `header` and `footer`; proof each scroll position was reached (A1, A12); the thinking state (A6); Esc on phone and at 768 (A13); `Pastries` with nothing forced (A15); wheel over the log at its end with the page mid-way, docked and on the sheet, each with a control wheel proving the wheel reached the log; wheel up during a stream (A16); axe and `smallTargets` empty and in conversation at 390 and 1440 (A17); reduced motion at each surface, with no running animation anywhere in it, and a motion-on control showing the sheet really transitions (A18).

Existing tests edited: `e2e/assistant-layout.spec.ts`, this package's own: titles prefixed with their acceptance number, assertions added, `longConversation` moved to the file's top level with a surface parameter, and A1's `scrollTo` made `behavior: 'instant'` so the position can be asserted. No assertion removed. `expectDocked`'s `+1` tolerance stays and a stricter check sits beside it (`EPSILON`, 1/32 px, because layout rounds at fractional widths such as 30vw at 1366).

Product fixed because a test found it:

| Where | What | Why |
|---|---|---|
| `globals.css` | `::backdrop` added to the reduced-motion rule | `*, ::before, ::after` does not match it, so the sheet's scrim faded for 220 ms under reduced motion. Applies to every sheet. |
| `OrderCta.tsx` | `invisible` moves from the hero column to its button | The `agent door` link left the page when the hero scrolled out, which failed `e2e/shop.spec.ts:286` (the known failure recorded earlier) and removed it from the tab order. The one-button rule is about buttons, so this is the smallest change; `shop.spec.ts` is unedited. |

A18 measures the surface element with nothing allowed running, and its subtree (where the `::backdrop` scrim shows up) for anything over 1 ms. The subtree limit is there because the reduced-motion rule makes every transition 0.01 ms, and an input's border colour under the pointer was caught in that instant in about 1 run in 7.

Known limits: the brief's "Unverified" list stands (iOS keyboard pinning and scroll lock, Safari `overlay`, Android Back). Chromium only.

## Review round 1

All seven findings were real and are fixed. Tests added: `tests/components/assistant-history.test.ts` (14), and the blocks after the `Review round 1` comment in `e2e/assistant-layout.spec.ts` (each seen failing before its fix).

| Finding | Fix |
|---|---|
| Back from a receipt: `?assistant=1` on a closed sheet, X needs two taps | A mount effect sets `open` from the URL, in both directions (a deep link closed with X had the opposite stale state). No focus moves, as for a `?assistant=1` load. |
| Back or Forward across section tabs toggles the dock | `shop/assistant-history.ts` `afterHistoryMove`: from 1024 px history never opens or closes the dock, and the entry's URL is rewritten to match it. A close already on its way through `history.back()` still closes, which covers a sheet that grew into a dock. |
| `ownEntry` set on an entry the page never pushed | `pushState` writes a mark into `history.state`; `ownEntry` reads the mark instead of guessing from the URL. |
| Start over, a starter or the payment check drops focus to `body` | From 1024 px, `send` and `reset` through the panel move focus to the message box. Sheets are left alone so a phone's keyboard does not come up. |
| `e2e/shop.spec.ts` comment | Updated (comment only). |
| Opening the dock at the top scrolls the page | `keepPlace` holds nothing while `scrollY` is under 72 px (the site header still in view), so the header stays put. Scrolled further, A15 is unchanged. |
| Buyer bubbles never shrink | `w-fit` on `UserBubble`. |

| Where | What | Why |
|---|---|---|
| `setAssistantParam` | Calls `History.prototype[method]`, not `window.history[method]` | Next's patch turns a `null` state (a section tab's entry) into `{}`, and Next reloads the page on returning to a truthy state without `__NA`. The rewrite above would otherwise cause that reload. On normal entries Next's patch already passes straight through. |
| Back from a client-side link | Reopens the assistant rather than removing the param | The buyer left from inside it, and the URL says it is open. Either was allowed by the finding. |
| Limit | Pushing from a section tab's entry on a phone, then Forward back onto it, reloads the page (the sheet reopens from the URL) | Next has no state to give that entry. Same before this change; nothing is lost. |

Existing tests edited: `e2e/shop.spec.ts` (the `consoleRegion` comment, as the brief lists); `e2e/assistant-layout.spec.ts`, this package's own, tests added only.
