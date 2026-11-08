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
| `Start over` | `ml-auto px-3` on the ghost | `ml-auto` keeps it at the right edge when the payment button is absent (`justify-between` would drop it left on its own). `px-3` lets both buttons fit one row at dock width; at 390 they still wrap, which the brief allows. |
| `ShopAssistant.tsx` | Interim: the closed side card stays, the dock only replaces it when open, and the content column spans all 12 tracks while docked | The next task replaces the card and the grid. Without the 12-track span, the content would leave a third of its width empty next to the dock. |
| `AssistantShell.tsx` | Footer also has `flex flex-col gap-3` | Space between the action row and the composer; the brief's list is otherwise exact. |

## For the next task

- Still to do from the WP2 brief: entry points and removing the side card (`OrderCta.tsx`, `SectionTabs.tsx` wrapper, order bar `max-w-md` from 640 px), the Message scrolling rules, the keyboard (`use-keyboard-viewport.ts`, `viewport` export), `keepPlace`, the Focus table beyond the phone heading (docked Esc, the fallback order), Back and deep link (`pushState` for modals), the not-taking-orders greeting, and the auto-growing `<textarea>` composer.
- `AssistantShell` already takes `inputRef` and `titleRef`; `Sheet` already has `initialFocusRef` and `fallbackFocusRef` (wired to the `h2` and the order bar button).
- `[scrollbar-gutter:stable]` reserves about 15 px on the right where scrollbars are classic (desktop Chrome on Linux or Windows), so the log's right edge sits that far inside the footer's. Overlay scrollbars (phones) have no gap. Kept, as the brief specifies the class.
