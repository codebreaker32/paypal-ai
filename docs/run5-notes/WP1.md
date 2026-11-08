# WP1 notes (foundation task)

Built: press tokens and utilities in `globals.css`; `src/lib/feedback/{press-machine,route-progress,index,use-action}.ts`; `src/components/motion/tactile.tsx`, mounted in `layout.tsx` inside `<Suspense fallback={null}>`. No component uses the `press*` utilities yet: that is the sweep.

Existing tests edited: none.

Tests added: `tests/ui/press-machine.test.ts`, `tests/ui/route-progress.test.ts`, `tests/ui/feedback.test.ts`, `tests/ui/use-action.test.ts`.

## Deviations and choices the brief left open

| Where | What | Why |
|---|---|---|
| `src/lib/feedback/route-progress.ts` | New module, not in the brief's file list | The bar's timing and the "which click navigates" rule are pure logic, so they are tested without a DOM. |
| `tactile.tsx` listener | Also listens for `click` and `pageshow`, beyond the brief's six press events | Link navigation is detected on `click` (it also covers Enter); the brief ends progress on `pageshow`. Still one function on the window, in capture. |
| `tactile.tsx` `blur` | Only the pressed control's own blur or the window's counts. A keyboard press ends as a release (keeps the 110 ms hold), a pointer press as a cancel | Pressing a control moves focus, which blurs the previous element mid-press. Enter can open a dialog and move focus, and the press should still be seen. |
| `tactile.tsx` pointerdown | ctrl + mouse is not a press | On a Mac it opens the context menu and the pointerup may never arrive. |
| `tactile.tsx` keyboard | Space never presses a link (it scrolls). Focused file and radio inputs press their wrapping label; Enter does not press a radio's label (it submits the form) | Matches what those keys do. |
| `press-text` | Transition list is `color, text-decoration-color, opacity` | "Opacity only" read as the press effect. Dropping `color` would make the hover colour snap once `transition-colors` is replaced. |
| `press-surface` | Transition list also names `translate`; pressed selector is `[data-pressed][data-pressed]` | `Pressable`'s hover lift uses `translate` (the brief's root cause). Tailwind emits `hover:` variants after plain utilities, so at equal specificity `hover:bg-*` would beat the pressed fill; a browser check confirmed the doubled selector shows the fill while hovered. |
| `[data-navigating]` | A delayed CSS animation, unlayered | A delayed transition would also delay the `scale` return on the same element. |
| `useAction` | `error` is a message string or null; `run` never rejects and resolves to `undefined` on failure | Every planned call site turns the error into a sentence for a `FieldError`. |

## For the sweep

- Use a `press*` utility instead of a `transition-*` class on the same element, not beside it: both set the transition list.
- Set `--press-local` only to a token (`var(--press-scale-wide)`), or reduced motion stops applying.
- Next's `Link` always calls `preventDefault`, so `Tactile` cannot tell whether a link's own handler cancelled the navigation. No link does that today; one that did would show the bar until the 10 s failsafe.
- `e2e/tactile.spec.ts` is not written. Tactile was checked with a throwaway page and spec (16 passing, removed): mouse, keyboard, touch tap, swipe that scrolls, disabled, right button, stretched link, `label[for]`, unmount mid-press, reduced motion, soft and document navigation, `beginNavigation`, `useAction`.

# WP1 notes (primitives task)

Built: `Button` status layers, `ButtonStatus`, guard and `layerClass` (`ui/button-status.ts`); `ui/{icon-button,text-link,copy-button,paypal-link}.tsx` (`dashboard/CopyButton.tsx` re-exports); `Switch`, `Pressable` and the toast rework. `CopyButton` replaces the copies in `AgentDoor` and `LiveStep`; `PayPalLink` is used in `Receipt` and `BuyerConsole`; the sold-out and pause toasts are gone.

Existing tests edited: none.

Tests added: `tests/ui/button.test.ts`, `tests/ui/primitives.test.ts`, `tests/ui/pausable-timer.test.ts`, `e2e/primitives.spec.ts` (acceptance 9, 10, 11 on the real dashboard).

## Deviations and choices the brief left open

| Where | What | Why |
|---|---|---|
| `Button`, no icon and no `loadingLabel` / `successLabel` | The layer is the glyph alone, with the label sr-only (so the name survives) | The layers hold the width, so a spinner beside a bare label would widen every icon-less button at rest. A button with an icon keeps its label beside the spinner, same width as idle. |
| `Button` `disabled` and `loading` together | `aria-disabled` only, no native `disabled` | "Not native disabled while not idle" means a busy button keeps focus. Native `disabled` stays for idle buttons only. |
| `CopyButton` | Uses an idle `Button` with its own Copy/Copied layers, not `status="success"` | Success is `aria-disabled` with a progress cursor for 2 s. After a copy nothing is busy, and copying again is fine. |
| `Switch` | New `failed` prop; the caller still rolls back and renders the `FieldError` | The inline error already sits in different places in `Dashboard` and `MenuRow`. `Switch` only owns the shake (`data-nope`, `animate-nope`). |
| `press-switch` utility, `--press-flex: 1.18` | Not in the brief's token list | A switch with no `press*` class would get the whole-control dim fallback. A token lets the thumb flex stop under reduced motion. |
| `globals.css` base rule | `:disabled, [aria-disabled="true"]` re-point the `--button-*-bg-hover/active` tokens at the resting fill | `pointer-events-none` is gone, so an unavailable button can be hovered. A token rule keeps a caller's `hover:bg-line` working, and custom hover variants would have beaten it. |
| `PayPalLink` | Also resets after 10 s | If the browser never leaves (Stop pressed, a blocked navigation) the money button would say "Opening PayPal…" forever. |
| `lib/feedback/pausable-timer.ts` | New module, not in the brief's file list | The toast's hover and focus holds are pure timing, so they are tested without a DOM. |
| Toast card | Its own link and dismiss button carry `press-text` / `press-icon` | Otherwise they get the dim fallback. |

## For the sweep (from the primitives task, done below)

- `useAction` call sites (`MarkPickedUpButton`, `SettingsPanel`, `ItemLists`, `CounterSnap`) still pass `loading`. Pass `status` and `successLabel` instead. The `PayPal email saved` toast in `SettingsPanel` goes with that change (Toast rule).
- `OrderCard.tsx:83` still has `transition-[transform,background-color]` and `active:scale-[0.99]`, which fight `press-surface`.
- `SettingsPanel.tsx:113` makes a Button wide with `className="w-full sm:w-auto"`. Prefer `fullWidth` so it gets the wide press scale.
- `IconButton` and `TextLink` have no call sites yet except `CopyButton`'s icon-only form.


# WP1 notes (sweep task)

Built: press states on every control in the Controls table; `useAction` at its call sites (`MarkPickedUpButton`, `SettingsPanel`, `ItemLists` add form, `CounterSnap` keep; `TrackingForm` keeps its toast); `tests/ui/press-coverage.test.ts`; order detail `loading.tsx` with a guard `layout.tsx`; `StartActions` calls `beginNavigation()` before `router.push`. Raw close buttons became `IconButton`; matching text links became `TextLink`.

Existing tests edited:

| File | Change | Why |
|---|---|---|
| `e2e/menu-tab.spec.ts:81` | `toContainText('Added')` is now `getByRole('status')` … `toContainText('Kept')` | Copy target (the brief's `CounterSnap` label is `Kept`) and selector: the row's `status` line, because the Button's hidden success layer also contains "Kept" at rest, which would make a plain `toContainText` true before the press. |

Tests added: `tests/ui/press-coverage.test.ts`.

## Deviations and choices the brief left open

| Where | What | Why |
|---|---|---|
| `press-coverage` | Also checks radio labels; allowlist has one entry (the skip link); a `data-stretched-link` counts as covered (its press is on the row) | Fulfilment radios are in the Controls table; the skip link only appears on keyboard focus and moves focus. |
| `TrackingForm` | Calls `feedback('success' / 'error')` directly, no `useAction` | Its 400 path needs the error object for the field message; `useAction` keeps only a sentence. The toast and form-goes-away behaviour are unchanged. |
| `MarkPickedUpButton` | `successMs` 3000 with the 500 ms hold before `onDone`; the toast moves into that hold | The detail page calls `router.refresh`, which can take longer than the default 1400 ms; a flip back to "Mark picked up" would invite a second press. |
| `CounterSnap` | The row's resting line says `Kept` (was `Added`); a small `ProposalActions` holds `useAction` per proposal | One word for one action; `useAction` is a hook and each proposal needs its own. The Button says `Kept` for 1.2 s, then the row settles on the line. |
| `ReviewStep.makeItem` | The new item joins `items` 700 ms after the save | `openSkipped` drops the line as soon as the item exists, which would unmount the row before the Button could say `Added`. |
| Filter segments and radios | Selected fill on `::before`, scale from `--press-scale` to 1 | Using the token means reduced motion holds the scale; colour and fade still answer. |
| `FileLabel` | `aria-disabled` and `cursor-progress` while busy; `pointer-events-none` gone | `press` already excludes `[aria-disabled="true"]`, and the input stays natively disabled. |
| File labels styled with `buttonClasses()` | `border-0` | The absolute file input fills the padding box, so the 1 px button border made its hit area 42 px (`a11y()` in `dashboard.spec`). |
| `TextLink` swaps | `StartActions`, `Dashboard`, `MenuPanel`, `LiveStep`, `ReadingStep`, `RetakeStep`, card page | Same layout; the underline becomes the system's `decoration-line-strong` where it was the text colour, and `hover` darkens it as the table says. |
| `PhotoPicker` thumbnail button | `hover:brightness-95` now snaps | `press` replaces the `transition-[filter]` list; the press animation matters more than the hover fade. |
| Reduced `w-full sm:w-auto` buttons | `fullWidth` + `sm:w-auto` (`SettingsPanel`, `TrackingForm`, `PrintButton`, `SharePanel`, `OrderCard`, `OrdersPanel`, `orders/[orderId]/page.tsx`) | Wide press scale where the button is wide. `MarkPickedUpButton` stays as it was, so acceptance 5 reads .96 at 1440. |
| `docs/DESIGN.md` | `Pressable` row and a short Press paragraph updated | The doc said "0.98 press". |
| `orders/[orderId]/page.tsx` | Keeps its own `requireOwner` and order check | It needs the order anyway (`stored` is typed nullable), and a working guard on an owner check is not worth removing. The layout adds the early 404 only. |

## Not done here

`e2e/tactile.spec.ts` (the brief's acceptance 5 to 8, 12, 13). The sweep was checked in the browser with a throwaway spec instead: Mark picked up .96 at 1440 and row scale `none`; segments press .96 and the thumb fades and scales; the stretched link presses the row at .985 with the sunken fill; Space presses a Button and keeps focus; reduced motion holds segments at 1 and keeps their state.


# WP1 notes (end-to-end task)

Built: `e2e/tactile.spec.ts`, acceptance 5 to 14 on the real dashboard and shop. No product code changed: every check passed once the spec itself measured correctly.

Existing tests edited: none (`e2e/helpers.ts` only gained exports).

Regression sweep, each run once on port 3201: `npm test` 1279 passed; typecheck and lint clean; `dashboard` 21 passed, 1 skipped (it was already `test.skip`); `shop` 30, `menu-tab` 7, `start` 9, `setup-review` 8, all passed.

## Deviations and choices the brief left open

| Where | What | Why |
|---|---|---|
| `e2e/helpers.ts` | Added `a11y` and `smallTargets` | The task names them as helpers there, but they only existed inside `dashboard.spec.ts` and `shop.spec.ts`. Those keep their own copies, untouched. `smallTargets` takes the stretched-link rule from `dashboard.spec.ts` (the target is the row), which the dashboard needs. |
| `tactile.spec.ts` timing | Measured in the page (a `requestAnimationFrame` sampler and a `MutationObserver`), not with Playwright polling | A round trip on a loaded machine is longer than the 100 to 350 ms windows being checked. |
| Acceptance 6, swipe | Real touch events through CDP `Input.dispatchTouchEvent` | `Input.synthesizeScrollGesture` did not scroll the page, so the test proved nothing about a swipe. The test also asserts `scrollY` grew. |
| Acceptance 9 | `el.click()`, so no press scale is in the width; readings after the row leaves are dropped | `MarkPickedUpButton` moves the row to Done 500 ms into success, so the button can be gone before sampling stops. |
| Acceptance 10 | The tick must be visible from 300 ms into the hold, not its first frame | `animate-pop` starts it faded for its 220 ms pop-in. |
| Acceptance 10, denied clipboard | `navigator.clipboard.writeText` rejected through an init script | Same as `primitives.spec.ts`. A real browser permission denial was not tried. |
| Acceptance 12 | The delay covers document and RSC requests to the order path (`url.pathname`) | In dev a soft navigation is an RSC fetch, and the brief's "delayed document" means the page is slow either way. |
| Acceptance 14 | Runs at 390 and 1440, with `smallTargets` at 390 only | Matches the targets rule in `shop.spec.ts` (phone width). |
