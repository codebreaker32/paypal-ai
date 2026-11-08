# Shelfie build brief: production pass

## Goal

The owner's words, verbatim:

> "1. chatbot box looks weird, start from mid screen and end at weirdly above the footer, 2. I can't feel the UX, touching buttons etc. feel silent, please improve it /ui-ux-pro-max and /ui-styling and using /impeccable 3. Give an option to login and add the shop, dont just flaunt the demo, make it production ready with researched /impeccable , /ui-ux-pro-max:brand and premium UI, 4. "Open your dashboard" etc looks weird and feels like a pptx slide, 5. Improve the cards layout and make it production ready with proper placing"

Judge every choice by one question: would a paying small-business owner trust this?

Rules for the whole run:
- Keep the Awning logo, the photo-first storefront, the PayPal and MCP flows, and every feature. PayPal stays sandbox-only.
- Add no new dependency, paid service or sign-up.
- Work on branch `run-5-production`. Each work package ends with `npm test`, `npm run typecheck`, `npm run lint`, its targeted e2e, and a commit. WP3, WP4 and WP7 also run the full e2e.
- You may edit existing tests only for selectors, routes and copy targets. Never remove an assertion. List every edit in `docs/PROGRESS.md`.
- Never edit `docs/JUDGING.md`.
- User-facing copy names no other product or company as a comparison, and never says "seamless", "leverage" or "AI-powered".
- Use `m.*`, never `motion.*`. Read `node_modules/next/dist/docs/` before using an unfamiliar Next API.

## Decisions

| Topic | Decision | Reason |
|---|---|---|
| Sign-in | Email and password, server-side sessions, `node:crypto` scrypt | Runs for a judge on localhost today, with no dashboard step and no new dependency. |
| Log in with PayPal | Not sign-in | Sandbox allows only sandbox accounts, live needs weeks of review, and localhost is unverified. |
| Passkeys | Not now | Needs a new library and still needs a password fallback. |
| Password recovery | One-time recovery key: 100 bits, shown once, hash stored, replaced on use | No email provider exists. |
| Login emails | Unverified; sign-up may say an email is taken | Nothing can send mail; rate limits mitigate it. |
| Session length | 30 days fixed, no idle timeout | A phone at the counter must stay logged in. |
| Sensitive actions | A `currentPassword` field on the action; no reauth sheet, no `reauth_at` | Same protection with less machinery. |
| Guest shops | None in production; `SHELFIE_ALLOW_GUEST_SHOPS=1` is for harnesses only | Real accounts are the point of complaint 3. |
| Owner links | Stay for unattached shops only (the seed and the harness) | Clips and `tests/auth/owner.test.ts` depend on them. |
| Attach flow | Not built | Never deployed, so no sellers to migrate, and it was the takeover path. |
| Demo | Marigold stays a public seeded shop with no account. No demo login. | "Don't just flaunt the demo", and a shared account is a security liability. |
| Where Marigold appears | Hero preview, the paper frame, one `See an example shop` link | Nowhere else. |
| Judges | Sign up in 15 seconds and use a sample, or run `npm run seed` and open its owner link | No shared credentials. |
| Cart | Not built. A tile tap drafts into the assistant. | A new money path nobody asked for. |
| Sound | One order chime, seller area, behind one switch (S2). No tap sounds. | The chime tells busy hands that money arrived; tap sounds are noise. |
| Haptics | `navigator.vibrate` on flip, success, error and order, seller area (S2). None on iOS. None for buyers. | iOS has no supported API, and buyers have no setting to turn it off. |
| What "silent" is fixed by | Visual press on every control, route progress, button states | These work everywhere, including iPhone. |
| Route transitions | None. Route progress bar only. | Least proven and over-animated. |
| `loading.tsx` | Add for order detail, with a guard layout. Do not add one for `/s/[slug]`. | Next starts streaming with status 200 (`loading.md`). `e2e/shop.spec.ts:467` needs a real 404 and `e2e/discovery.spec.ts:49-54` needs the agent door `<link>` in `<head>`. |
| Origin check | `assertSameOrigin` inside each handler. No `src/proxy.ts`. | A proxy truncated a 14 MB upload to 10 MB when measured. |
| `viewportFit: 'cover'` | Nowhere | iOS inset behaviour is unverified, and a white bar on a white page needs no cover. |
| Assistant form | Full-height dock from 1024 px, side sheet 640 to 1023, fixed-height bottom sheet under 640 | Attached to a viewport edge, never to page flow. |
| Start over | Labelled ghost button in the footer row | An icon beside X could wipe a live approval card. |
| Composer | Auto-growing `<textarea rows=1>`, up to 4 lines, Enter sends | Appended items would clip in an input. |
| Menu grid | Container queries: 2 tracks under 36rem, 3 from 36 to 56rem, 4 from 56rem | Content width changes when docked. |
| Orphan tile | Spans the row only under 36rem | Span rows on desktop make the last item change shape. |
| `/shops` with one shop | Shows the one-row list. `landingPath` (login and `/`) goes straight into the shop. | The switcher links to `/shops`, so a redirect there would make it a no-op and strand "Add a shop". |
| Test-mode wording | `TEST_MODE_LINE` verbatim: `Payments run in the PayPal sandbox, so no real money moves.` | One honest sentence. "Sandbox" is explained once, in the FAQ and `/help`. |
| Pricing claims | Do not ship "free during early access", "PayPal's usual fees" or "everything you set up stays" | Unconfirmed. |
| Landing | Exactly four parts | Six chapters recreated the slide feel. |
| Auth screens | One centred column at both widths, no photo | Split-screen with a stock photo reads as template. |
| Seller chrome | App shell on `/shops/[id]/**`. Public header on `/`, legal, help, `/shops`, `/shops/new`, `/account`. | A seller should be inside a product. |
| Shop and account menus | One disclosure, `brand/AccountMenu.tsx`. No popover API. | One pattern. |
| Banners | One slot, one banner. Priority: PayPal unreachable, payee missing, paused, recovery key. | Four stacked banners is noise. |
| Row system | One `PanelList` in `ui/panel.tsx` for Orders, Menu, Share, Live and `/shops` | Today there are several. |
| Grey sentences | Keep only where a term needs defining (agent door) or a seller would be stuck (where you get paid) | Banned Part C pattern. |
| `error.tsx` prop | `retry` (and `reset` not used) | Next 16's `error.md` says to use `retry`. |

## Work packages, in build order

Baseline first: run the full suite, then copy `video/out/shelfie-demo.mp4` to `video/out/shelfie-demo-v2.mp4` so a working video always exists. Record the start time. **At hour 12, revert any unfinished item to the last green commit and go to WP8.**

---

### WP1. Press, loading and response (must-have, 2 h)

**Root cause.** Tailwind 4's `translate-*` and `scale-*` write the CSS `translate` and `scale` properties. Transition lists naming `transform` do not cover them, so almost every press snaps.

**Tokens** (`globals.css :root`): `--press-in:70ms`, `--press-out:180ms`, `--press-scale:.96`, `--press-scale-wide:.98`, `--press-scale-icon:.9`, `--press-scale-surface:.985`, `--press-opacity:.6`, `--pending-delay:160ms`, `--button-secondary-bg-active:var(--color-line-strong)`, `--button-ghost-bg-active:var(--color-line)`. Under `prefers-reduced-motion` all four scale tokens become `1`; colour and opacity still answer.

**Utilities** (`@utility`). Each uses `transition-duration:var(--press-out)`, and its pressed selector sets `--press-in`.
- `press`: selector `&:is(:active:not(:disabled,[aria-disabled="true"]),[data-pressed])`. Sets `scale:var(--press-local,var(--press-scale))` and `user-select:none`. Transitions `background-color,border-color,color,box-shadow,opacity,scale`.
- `press-icon`: same, icon scale.
- `press-text`: same, opacity only.
- `press-surface`: `[data-pressed]` only, never `:active`, so inner controls do not move it. Sets scale and `background-color:var(--press-bg,var(--color-surface-sunken))`.
- Base-layer fallback: `:where(a[href],button,summary,[role="tab"]):not([class*="press"])[data-pressed]{opacity:var(--press-opacity)}`.
- Add `a[href]` to the `touch-action:manipulation` rule (`globals.css:554-560`).

**`src/components/motion/tactile.tsx`**, mounted once in `layout.tsx` inside `<Suspense fallback={null}>`. One delegated capture listener for `pointerdown`, `pointerup`, `pointercancel`, `keydown`, `keyup`, `blur`.
- Targets the innermost `a[href],button,summary,[role="button"],[role="tab"],[role="switch"],label[for],label:has(input[type=file]),label:has(input[type=radio])`. Skips disabled ones. Primary button only.
- `[data-stretched-link]` maps to its closest `[data-slot="pressable"]`. `label[for]` maps to its control.
- Pure timing in `src/lib/feedback/press-machine.ts`:
  - Mouse applies `data-pressed` immediately.
  - Touch or pen arms for 50 ms. `pointercancel` first means never apply. Lift first means apply on lift.
  - Minimum visible hold is 110 ms from apply.
  - Space or Enter applies on keydown and clears on keyup or after the hold.
- A control that unmounts mid-press must not throw.

**Controls.**

| Control | Hover (1440) | Press (390 and 1440) | Pending | Result |
|---|---|---|---|---|
| Button, ButtonLink, PayPal | Fill token | `press` (wide when `fullWidth`), active fill | Spinner and `loadingLabel` after `--pending-delay` | Tick and `successLabel` |
| Icon buttons, new `IconButton` | `bg-surface-sunken` circle | `press-icon` | Spinner replaces icon | Tick swap |
| Text links, new `TextLink` | Underline darkens | `press-text` | `data-navigating` | Destination |
| `AgentDoor` tabs (only remaining `Tabs` user after WP4) | Text darkens | `press-text` | None | Existing swap |
| Filter segments, fulfilment radios | Text darkens | `press` | None | Thumb on `::before` fades and scales .96 to 1 |
| Chips, starters | `bg-line` | `press` | Existing spinner | Destination |
| Switch | Track border darkens | Thumb `scale:1.18 1`, origin toward travel | Spinner in thumb after 300 ms, no dimming | Failure: `animate-nope`, snap back, inline error |
| Navigating rows | `surface-subtle` | `press-surface` | `data-navigating` | Destination |
| File pickers | `buttonClasses()` | `press` | Existing `Busy` | Thumbnail updates |
| `summary` | Chevron darkens | `press-text` | None | Body fades in, chevron rotates |
| Disabled | None | None; `cursor:not-allowed` (remove `pointer-events-none` from `button.tsx:15`) | None | None |

**Button** (`button.tsx`, stays server-safe, no hooks).
- Props: `status?:'idle'|'loading'|'success'`, `successLabel?`. `loading` stays as an alias.
- Label layers share one grid cell (`[&>*]:[grid-area:1/1]`), so width never changes. The inactive layer is `invisible opacity-0`.
- While not idle: `aria-disabled="true"` (not native `disabled`), `aria-busy` while loading, clicks prevented by a guard, `cursor:progress`, `data-status`.
- Native `disabled` stays for genuinely unavailable buttons.

**`src/lib/feedback/use-action.ts`**: `useAction(fn,{successMs=1400})` returns `{status,run,error}` and calls `feedback('success'|'error')`. `src/lib/feedback/index.ts` `feedback(event)` only dispatches `CustomEvent('shelfie:feedback',{detail:{event}})` for now; S2 adds channels.

| Call site | Label after success |
|---|---|
| `MarkPickedUpButton` | `Picked up`, held 500 ms before `onDone` |
| `SettingsPanel` | `Saved` |
| `TrackingForm` | Existing toast (the form goes away) |
| `ItemLists` add form | `Added` |
| `CounterSnap` keep | `Kept` |

**Other changes.**
- **Copy.** One `ui/copy-button.tsx` replaces `dashboard/CopyButton.tsx` (re-export), `shop/AgentDoor.tsx:10-28` and `setup/LiveStep.tsx:66-114`. Label becomes `Copied` with a tick (`animate-pop`, 220 ms) for 2000 ms. `aria-label` keeps `{what} copied`. sr-only `role="status"`. No success toast. Failure toast: `Couldn’t copy` / `Select the text and copy it yourself.`
- **PayPal link.** New `ui/paypal-link.tsx`, a real `<a>`. On click the label becomes `Opening PayPal…` with a spinner, reset on `pageshow`. Use at `Receipt.tsx:102` and `BuyerConsole.tsx:270`.
- **Switch.** Remove the 60% dim and native `disabled`. Use `aria-disabled` plus guard.
- **Pressable.** Becomes `press-surface` with no `active:` classes. For real controls only: remove it from `MenuPanel.tsx:68` (plain `<li>`).
- **Toast rule.** Toast only when the result is out of view: new paid order, tracking sent, picked up, `Couldn’t copy`. Remove sold-out and pause toasts (`MenuPanel.tsx:155`, `Dashboard.tsx:186`). `AnimatePresence`: in 220 ms (`y:16`, scale .98, fade), out 140 ms. Timer pauses on hover and focus-within. Keep `role="status"`, add `data-entrance`.
- **Route progress.** `Tactile` detects same-origin plain-left-click link navigations (no modifier, no `target`, not hash-only, not the same URL). It sets `data-navigating` on the control, which dims to .7 after 120 ms. It starts a 2 px `bg-accent` `origin-left` bar fixed at the top, delayed 120 ms: `scaleX` to .7 in 800 ms, creep to .92 by 6 s, then finish and fade on `usePathname`/`useSearchParams` change or `pageshow`, with a 10 s failsafe. `StartActions.tsx:89,100` call `beginNavigation()`.
- **Order detail loading.** Add `src/app/shops/[id]/orders/[orderId]/loading.tsx` (moved with its route in WP4) and a sibling `layout.tsx`. The layout runs `requireOwner` and checks `stored.shopId === shop.id`, calling `notFound()` before streaming (`e2e/dashboard.spec.ts:57,62`).

**Files.**
- Add: `src/lib/feedback/{press-machine,index,use-action}.ts`, `src/components/motion/tactile.tsx`, `src/components/ui/{icon-button,text-link,copy-button,paypal-link}.tsx`, `tests/ui/{press-machine,press-coverage}.test.ts`, `e2e/tactile.spec.ts`.
- Change: `globals.css`, `layout.tsx`, `motion/pressable.tsx`, `ui/{button,tabs,toast}.tsx`, `dashboard/{Switch,CopyButton,Dashboard,OrdersPanel,OrderCard,MenuPanel,MarkPickedUpButton,TrackingForm,SettingsPanel}.tsx`, `dashboard/menu/CounterSnap.tsx`, `shop/{BuyerConsole,AgentDoor,SectionTabs,ActivityPanel}.tsx`, `setup/{LiveStep,PhotoPicker,MenuPhotos,ItemLists,ShopDetails,RetakeStep,ReadingStep}.tsx`, `_start/StartActions.tsx`, `o/[ref]/Receipt.tsx`, `shops/[id]/card/page.tsx`, `shops/[id]/orders/[orderId]/page.tsx`, `brand/SiteHeader.tsx`.

**States.** 390: no hover, touch timing as above. 1440: hover plus immediate mouse press. Static layout does not change at either width.

**Acceptance.**
1. `tests/ui/press-coverage.test.ts` (AST, style of `motion-off.test.ts`): every `<button>`, `<a>`, `<Link>`, `<summary>` and file `<label>` in `src` has a `press*` class, uses a primitive, or is in a short named allowlist.
2. The same test fails on any `transition-[…transform…]` and any `active:translate-*` or `active:scale-*`.
3. `press-machine`: mouse immediate; touch at 50 ms; 20 ms tap applies on lift and clears 110 ms later; cancel before arming never applies; 300 ms hold clears at once on release.
4. `Button` with `loading` has the same layer structure as idle, sets `aria-busy` and `aria-disabled`, and does not set `disabled`. All existing `renderToStaticMarkup` tests pass with no provider added.
5. At 1440, `mouse.down` on `Mark picked up` gives computed `scale` .96 within 150 ms and back to `none` or 1 within 350 ms of `mouse.up`. The row's `scale` stays `none`.
6. At 390 with touch, a tap records `data-pressed` for at least 100 ms. A swipe that scrolls over an order row records none.
7. Pressing the Sold out switch leaves its row's `scale` alone and its thumb at 1.18. Pressing the label flexes the same thumb.
8. Space on a focused Button sets `data-pressed`, and focus stays through loading.
9. With a 1 s held response: width constant within .5 px across idle, loading and success. Spinner not visible at 100 ms, visible at 400 ms.
10. Copy shows `Copied` and a tick for about 2 s with no toast. With the clipboard denied, the failure toast appears.
11. Failed pause keeps `aria-checked` rolled back and shows the inline alert, with `data-nope` seen. A successful switch adds no toast.
12. Slow route (delayed document): the progress bar is visible by 300 ms and the pressed row has `data-navigating`; both clear on arrival.
13. Reduced motion: pressing a Button leaves `scale` at 1 while `background-color` still changes.
14. `a11y()` passes on dashboard and shop.

---

### WP2. The assistant surface (must-have, 2.25 h)

**Thesis.** The assistant attaches to a viewport edge. It is never a card in the page and never depends on header, footer or scroll.

| Width | Form | Modal | Box |
|---|---|---|---|
| Under 640 | Bottom sheet, one fixed height | `<dialog>` | Top 12 px (or safe-area) to bottom of visible area, top corners `--sheet-radius` |
| 640 to 1023 | Right side sheet | `<dialog>` | Full height, `min(27.5rem,100vw)`, square corners, scrim |
| 1024 and up | Docked panel | No, `<aside>` | Fixed top 0, right 0, bottom 0, `clamp(23.75rem,30vw,27.5rem)`; the document narrows beside it |

No drag handle.

```css
/* globals.css :root */
--assistant-w: clamp(23.75rem, 30vw, 27.5rem);
--assistant-sheet-w: 27.5rem;
--assistant-top-gap: max(0.75rem, env(safe-area-inset-top));
--assistant-header-h: 4rem; /* equals SiteHeader h-16 */
--z-dock: 30;

/* src/components/shop/assistant-shell.css */
.assistant-dock { display: none; }
@media (min-width: 64rem) {
  html:has([data-assistant-dock]) body { padding-inline-end: var(--assistant-w); }
  html:has([data-assistant-dock]) [data-toast-region] { right: calc(var(--assistant-w) + 1.5rem); }
  /* Stable left edge: the logo must not jump when the dock opens */
  html:has([data-assistant-dock]) [data-page-frame] {
    width: auto; margin-inline-start: max(0px, calc((100vw - var(--container-page)) / 2)); margin-inline-end: 0; }
  .assistant-dock { display: block; position: fixed; inset-block: 0; right: 0; z-index: var(--z-dock); width: var(--assistant-w);
    background: var(--color-surface); border-inline-start: 1px solid var(--color-line);
    transition: transform var(--duration-base) var(--ease-out); }
  @starting-style { .assistant-dock { transform: translateX(100%); } }
}
.assistant-sheet { position: fixed; inset: var(--assistant-top-gap) 0 auto 0; margin: 0; padding: 0;
  width: 100%; max-width: 100%; max-height: none;
  height: calc(var(--assistant-vh, 100dvh) - var(--assistant-top-gap));
  translate: 0 var(--assistant-vy, 0);
  border-radius: var(--sheet-radius) var(--sheet-radius) 0 0;
  background: var(--sheet-bg); box-shadow: var(--sheet-shadow);
  transform: translateY(100%);
  transition: transform var(--duration-base) var(--ease-in),
    overlay var(--duration-base) allow-discrete, display var(--duration-base) allow-discrete; }
.assistant-sheet[open] { transform: none; transition-duration: var(--duration-slow); transition-timing-function: var(--ease-out); }
@starting-style { .assistant-sheet[open] { transform: translateY(100%); } }
.assistant-sheet::backdrop { opacity: 0; transition: opacity var(--duration-base) var(--ease-out); }
.assistant-sheet[open]::backdrop { opacity: 1; }
@starting-style { .assistant-sheet[open]::backdrop { opacity: 0; } }
@media (min-width: 40rem) {
  .assistant-sheet { inset: 0 0 0 auto; width: min(var(--assistant-sheet-w), 100vw);
    height: var(--assistant-vh, 100dvh); border-radius: 0; transform: translateX(100%); }
  .assistant-sheet[open] { transform: none; }
  @starting-style { .assistant-sheet[open] { transform: translateX(100%); } }
}
.assistant-sheet [data-assistant-header], .assistant-sheet [data-assistant-footer] { touch-action: none; }
@media (max-height: 26rem) {
  .assistant-sheet { --assistant-header-h: 2.75rem; }
  .assistant-sheet [data-assistant-subtitle] { display: none; }
}
@media print { html:has([data-assistant-dock]) body { padding: 0; } .assistant-dock { display: none; } }
```

- Put `data-page-frame` on `Frame` (`brand/Frame.tsx`), the shop page wrapper, and the `Cover` wrapper.
- **Every other sheet** uses the same CSS motion (rise from `translateY(100%)` on phones; from 640 px centred with fade and 8 px rise; `@starting-style`, `overlay` and `display` allow-discrete). Remove `open:animate-rise-in` from `sheet.tsx`. No `data-closing`. No `media` prop.
- Where `overlay` is unsupported, the sheet closes instantly. That is acceptable.

**Shell (`AssistantShell.tsx`, one component for all three forms).** `grid-rows-[auto_minmax(0,1fr)_auto]`, `h-full`.
- **Header** (`div`, not `<header>`): `--assistant-header-h`, `border-b border-line`. `LogoMark` size-8 (hidden under 360 px). Title `h2.type-heading.truncate`, `tabIndex={-1}`, `outline-none`, with an id for `aria-labelledby`. Subtitle `type-meta truncate text-ink-muted`: `Claude, for {shopName}`. One 44 px icon button: Close (`X`, label `Close the assistant`).
- **Scroller**: `overflow-y-auto overscroll-contain px-5 py-4 [scrollbar-gutter:stable]`. Keep the literal `overflow-y-auto` class (`e2e/shop.spec.ts:261,268`, `e2e/screenshots.spec.ts:572`). Its only child is `flex min-h-full flex-col justify-end`.
- **Footer**: `border-t border-line bg-surface px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]`. Top row `flex flex-wrap items-center justify-between gap-2`: `Did my payment go through?` (secondary, moved out of the log, same condition as today) and `Start over` (ghost, labelled, today's condition: `!busy`, entries exist, conversation not full). `scripts/clips/record.ts:515` depends on it. Below that, `ConsoleComposer`.

**Message scrolling** (replaces `BuyerConsole.tsx:370-371`).
- A new buyer message always scrolls to it.
- While a reply streams, follow only if the buyer was within 96 px of the bottom at their last scroll. Never go past the start of the latest turn.
- A fresh approval card always scrolls to the end, overriding the turn-start rule. On `(pointer:coarse)` it also blurs the input.
- On mount with restored entries, scroll to the end.

**Other behaviour.**
- PayPal approval card stays in the log, full column width, the only approve button.
- Greeting for a shop not taking orders: `Hi! I'm Claude. {shopName} isn't taking orders right now, but I can answer questions about the menu.` This fixes `BuyerConsole.tsx:378`.

**Entry point (the side card goes in this package, because removing it needs a replacement in the same commit).**
- `ShopAssistant` becomes a single column in `mx-auto max-w-page px-gutter`, wrapped `@container/shop`. Remove the grid and aside card.
- Under 1024: keep `[data-order-bar]` and its ` · PayPal</span>` markup. From 640 px, centre the button at `max-w-md`.
- From 1024, hero: `HeroOrderCta` at the right end of the name row in `Intro`, bottom-aligned with the meta line. `Button size="lg"`: `Order with an assistant · PayPal`, or `Ask the assistant` for a shop not taking orders. Under it, right-aligned `type-meta`: `Or connect your own assistant to the agent door.`, with link text exactly `agent door`.
- From 1024, after the hero scrolls out (IntersectionObserver on the hero wrapper, which stays mounted): a `size="md"` button named after the title fades in at the right end of the sticky section-tabs row. Move sticky styles in `SectionTabs.tsx` to a wrapper, with `nav` and the button as siblings. A shop with fewer than two sections renders that row at `lg` only for the button.
- Exactly one of the two shows at a time; neither shows while docked. No floating chat bubble.

**Keyboard.**
- `export const viewport: Viewport = { interactiveWidget: 'resizes-content' }` in `src/app/s/[slug]/page.tsx`.
- `use-keyboard-viewport.ts`: `useKeyboardViewport(dialogRef, open)` listens to `visualViewport` `resize` and `scroll` (rAF).
- Pure `keyboardViewport({innerHeight,height,offsetTop,scale})` returns null when `scale>1.01` or `innerHeight-height<120`, else `{h,y}`. Set `--assistant-vh` and `--assistant-vy` on the dialog; remove on null.
- Keep the 16 px input.

**Scroll lock.** Keep `html:has(dialog[open]){overflow:hidden}`. Docked mode has no lock.

**`keepPlace`** (1024 and up, wraps open and close). Find the first `main h3, main li` whose bottom is below 72 px, record its top, `flushSync` the state change, then `window.scrollBy({top:delta,behavior:'instant'})`.

**Focus.**

| Event | Focus |
|---|---|
| Docked, opened by click or key | Composer input, caret at end. No trap. Esc closes when focus is inside. |
| Docked via `?assistant=1` on load | Nothing moves |
| Modal open | The `h2`, never the input. `Sheet` calls `initialFocusRef.current.focus()` after `showModal()`. |
| Any close | The opener. If gone or body: hero CTA if in view, else compact CTA, else order bar button. |

**Back and deep link.**
- Modal, opened by tap: `history.pushState(history.state,'',url+'?assistant=1')`. X, Esc and scrim call `history.back()`. `popstate` sets `open` from the URL.
- Loaded with `?assistant=1`: no push, and closing uses `replaceState`.
- Docked: `replaceState` only.

**`sheet.tsx` additions:** `bare`, `labelledBy`, `initialFocusRef`, `fallbackFocusRef`. Other callers unchanged by default.

**Files.**
- Add: `shop/AssistantShell.tsx`, `shop/assistant-shell.css`, `shop/OrderCta.tsx` (context, `HeroOrderCta`, `CompactOrderCta`), `shop/use-keyboard-viewport.ts`, `tests/components/keyboard-viewport.test.ts`, `e2e/assistant-layout.spec.ts`.
- Change: `shop/{ShopAssistant,BuyerConsole,SectionTabs}.tsx`, `ui/sheet.tsx`, `brand/Frame.tsx`, `s/[slug]/page.tsx`, `globals.css`, `docs/DESIGN.md`, `e2e/shop.spec.ts` (comment only).

**States.** 390x844: y 12 to 844 for empty, thinking and conversation alike. 1440x900: x 1008 to 1440, y 0 to 900, content 800 px wide. 1024x768: 380 wide, content about 562. 1920x1080: 440 wide. Empty: greeting and starters directly above the composer. Error, rate limit and conversation full stay inline at the end of the log.

**Acceptance.**
1. At 1440x900, 1366x768 and 1024x768, with scroll at 0, mid and end: aside `y=0`, `y+height=innerHeight`, `x+width=innerWidth`, width 380 to 440.
2. Same runs: composer fully inside the viewport.
3. Docked: `main`, `header`, `footer` right edges at or left of the aside's x. `scrollWidth<=innerWidth`. At scroll 0 the panel header's bottom equals the site header's bottom (±1).
4. Logo x moves at most 8 px between open and closed at 1440 and 1920.
5. Closed at 1440: no `complementary` named `Order with an assistant`, and exactly one visible button with that name at scroll 0, 900 and page end.
6. 390x844: dialog `y` 12 (±1), bottom 844, height identical for empty, thinking and full conversation.
7. 768x1024: dialog right edge 768, width 440, height 1024, `y` 0.
8. Sheet open at 390x480: composer bottom at or above 480.
9. Faked `visualViewport` height 500: dialog height 488, composer bottom at or above 500. Unit: null for `scale>1.01`, null for gap under 120, `{h,y}` otherwise.
10. After a replayed order, `Did my payment go through?` and `Start over` are fully visible and outside the scroller at 390 and 1440.
11. Approval link fully inside the scroller on arrival at 1440x900, 390x844, 390x560.
12. Phone: scroll to 500, open, close: `scrollY` 500, focus on order bar button.
13. Phone open: `activeElement` is the `H2`. Desktop click: the input. Esc closes and focus returns to the opener.
14. Phone: tap open, `page.goBack()`: dialog gone, no `assistant` in URL, a `window.__marker` survives. Deep link then X: no `assistant`, `history.length` unchanged.
15. Desktop: scroll "Pastries" into view, open: its top moves at most 8 px. Close: same.
16. Wheel over the log at its end leaves `window.scrollY` unchanged. Buyer scrolled up during a stream keeps position.
17. Axe (wcag2a, 2aa, 21a, 21aa) passes in empty and conversation at 390 and 1440. `smallTargets` empty.
18. Reduced motion: dock and sheet computed transform `none`, no running animation.

**Unverified, run in Chromium only:** iOS keyboard pinning, iOS scroll lock (a small page-scroll leak behind the sheet is possible), Safari `overlay` transition, Android Back on `<dialog>` beyond the `pushState` path.

---

### WP3. Shop page tiles and first screen (must-have, 1.75 h)

**First screen.**

| | 390x844 | 1440x900 |
|---|---|---|
| Cover | Full-bleed, `h-32` (`sm:h-44`) | Full content frame, rounded, `lg:h-60` |
| Shop name | `type-display` (30 px) | `type-display` (40 px) |
| Avatar | Overlaps cover's lower edge | Same |
| Original price list | Same row as avatar, right-aligned, 32 px thumb in 44 px link, label `max-sm:sr-only` | Right of pickup and shipping lines, as now |
| About | 16 px | 18 px |
| Pickup and shipping | Always visible | Same |
| Tracks | 2 | 4 closed, 3 docked |

Keep `COVER_SIZES` as it is.

**Tile** (`Menu.tsx`, stays a server module; no client island; `takesOrders` prop defaults to true so `tests/components/example-photos.test.ts` is unchanged). `li[data-menu-item]`, using `Pressable lift={false}` with `[--press-bg:transparent]`, class `group/tile relative`, in order:
1. `.tile-photo`: `relative overflow-hidden rounded-(--photo-radius) aspect-[4/3] bg-surface-sunken`.
2. `.tile-text`: `h4`, price row, description.
3. For orderable tiles and paused-shop tiles, a stretched sibling `<button type="button" data-stretched-link data-order-item={name} class="absolute inset-0 rounded-(--photo-radius) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink press-…">`.

Never put the button inside the `h4` (`e2e/shop.spec.ts:459` measures the h4). No card background or shadow. Update `docs/DESIGN.md`.

Spacing: photo to name 8 px, name to price 2 px, price to description 4 px. Section gap 40 px, then 56 px at 56rem and up. Heading to grid 12, then 16.

Name 16/24 bold, not clamped. Show every price option (existing `Prices`). Description 14/20 `ink-muted`, `line-clamp-3`.

| State | Photo | Text | Button |
|---|---|---|---|
| Orderable | Normal | Name, price, description | `aria-label` `Order {name} with the assistant` |
| Sold out | `dim` | Muted name and price; white pill bottom-left `Sold out today`, ink, bold | None |
| Ask in person | Normal | `Ask in person` replaces the price | None |
| Shop not taking orders, live item | Normal | Prices shown | `aria-label` `Ask the assistant about {name}` |

Hover: photo `motion-safe:hover:scale-[1.03]` with `transition-[scale]`, photo only.

**Example photos.** `ExampleNote` becomes a server-safe non-interactive `<span data-example-note class="pointer-events-none">` that keeps `opacity-0`, `group-hover/tile:opacity-100` and adds `group-has-[:focus-visible]/tile:opacity-100`. Under the section tabs, when any example shows: `Some photos are examples, not the shop's own.`

**Grid** (`shop/menu-grid.css`):

```css
.menu-grid { --tile-gap-x:.75rem; --tile-gap-y:1.25rem; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:var(--tile-gap-y) var(--tile-gap-x); }
@container shop (width < 36rem) {
  .menu-grid > li:last-child:nth-child(odd) { grid-column:span 2; display:flex; align-items:center; gap:var(--tile-gap-x); }
  .menu-grid > li:last-child:nth-child(odd) .tile-photo { flex:0 0 calc((100% - var(--tile-gap-x)) / 2); }
  .menu-grid > li:last-child:nth-child(odd) .tile-text { flex:1; min-width:0; }
}
@container shop (width >= 36rem) { .menu-grid { --tile-gap-x:1rem; --tile-gap-y:1.75rem; grid-template-columns:repeat(3,minmax(0,1fr)); } }
@container shop (width >= 56rem) { .menu-grid { grid-template-columns:repeat(4,minmax(0,1fr)); } }
```

Tile `sizes`: `(min-width: 1024px) 280px, (min-width: 640px) 30vw, 50vw`.

**Tile to draft.**
- Move draft state into `useBuyerConsole`. `ShopAssistant` delegates clicks on `[data-order-item]` to `openWithDraft(name)`: it opens the console and sets the draft, and never auto-sends.
- Draft: `I’d like the {name}`. If a draft exists, append `, and the {name}`. Not taking orders: `Tell me about the {name}`. Ignore an append that would pass 500 characters.
- With the dock already open, a tap appends.
- Desktop focuses the input with the caret at the end. Phone focus goes only to the title.

**Composer.** Auto-growing `<textarea rows=1>`, JS height from `scrollHeight`, up to 4 lines. Enter sends unless Shift or `isComposing`. `enterKeyHint="send"`, `maxLength=500`, 16 px, label `Message to the assistant`, button `Send`.

**Files.** Change `s/[slug]/page.tsx`, `shop/{ShopAssistant,Menu,ExampleNote,BuyerConsole}.tsx`, `globals.css`, `docs/DESIGN.md`, `e2e/screenshots.spec.ts`. Add `shop/menu-grid.css`, `e2e/tiles.spec.ts`.

**Acceptance.**
1. At 390: every `.menu-grid` has 2 tracks, normal tile photos 169x127 (±1).
2. At 1440 closed: 4 tracks. Docked: 3. At 1024 docked: 2. Every tile photo the same width (±1).
3. At 390 with sections of 1, 3, 5, 7 items: the last tile's right edge meets the grid's right edge (±1).
4. 390x844: at least two tile photos fully above `[data-order-bar]`. 1440x900: first row of photos fully visible.
5. Tile tap on `/s/marigold-bakehouse` opens the assistant with `I’d like the Almond croissant` in the composer and sends no `/api/assistant` request. A second tile appends.
6. Sold-out and ask-in-person tiles contain no `[data-stretched-link]`. Paused-shop tiles draft `Tell me about the …`.
7. `e2e/shop.spec.ts:454` (price under name) passes unedited.
8. At 390 `smallTargets` is empty for `main`; axe clean on the grid.

---

### WP4. Seller app shell, Live, Share, Settings (must-have, 2.75 h)

Do the no-visual route-group move first as its own commit.

**Routes (URLs unchanged).**
- New `src/app/shops/[id]/(app)/layout.tsx` calls `requireOwner` and renders `AppShell`.
- Move `(dashboard)/` to `(app)/(dashboard)/`. Move `orders/` and `card/` into `(app)/`. Delete the old `(dashboard)/layout.tsx`.
- Keep `requireOwner` in every page as well (layouts do not re-run on client navigation).
- `setup/page.tsx` switches to `requireOwner` and wraps `LiveStep` in `AppShell` only when `view.step==='live'`. Reading and Review keep the logo-only header.

**Tokens and rules (`globals.css`).**

```css
--app-sidebar-w:15rem; --app-topbar-h:3.5rem; --app-tabbar-h:3.5rem;
@utility type-page { font-family:var(--font-display); font-size:var(--text-2xl); line-height:var(--text-2xl--line-height); font-weight:700; letter-spacing:var(--tracking-tight); }
@utility type-section { font-family:var(--font-display); font-size:var(--text-base); line-height:var(--text-base--line-height); font-weight:700; letter-spacing:var(--tracking-tight); }
body:has([data-app-shell]) [data-site-chrome] { display:none; }
@media (width < 64rem) {
  html:has([data-app-shell]) { scroll-padding-top:var(--app-topbar-h); scroll-padding-bottom:calc(var(--app-tabbar-h) + env(safe-area-inset-bottom)); }
  body:has([data-app-shell]) [data-toast-region] { bottom:calc(var(--app-tabbar-h) + env(safe-area-inset-bottom) + .75rem); padding-bottom:0; }
}
```

Working screens use only `type-page` (24/32) and `type-section` (16/24). Add `data-site-chrome` to SiteHeader, SiteFooter and the root skip link.

**1440 (from `lg`).** Grid `[var(--app-sidebar-w)_minmax(0,1fr)]`. Sidebar `sticky top-0 h-dvh`, white, one `border-r border-line`. Content `mx-auto w-full max-w-page px-gutter pt-8 pb-12`. Sidebar top to bottom:
1. `Logo size="sm"` linking to `/shops` (`/` when no account).
2. `data-testid="shop-switcher"`: `ShopAvatar size="sm"`, name (`text-sm font-bold`, two-line clamp, `title`), status dot and word, `ChevronsUpDown`, accessible name `{name}, switch shop`, a link to `/shops`. With no account it is static, with no chevron.
3. `<nav aria-label="Shop sections">`.
4. Rule, then `View your shop` with `ExternalLink` (`Finish setting up` when draft).
5. Spacer.
6. `TEST_MODE_LINE`, `type-meta text-ink-muted`.
7. Account slot (`AccountMenu` opening upward; no account: only `Log in`).

**390 (below `lg`).**
- Top bar: `sticky top-0`, `h-(--app-topbar-h)`, white, one bottom rule, no blur. `LogoMark size-6`, shop name truncated as the switcher, 44 px `CircleUserRound` named `Account`.
- Tab bar: `fixed inset-x-0 bottom-0`, `h-[calc(var(--app-tabbar-h)+env(safe-area-inset-bottom))]`, one top rule, four equal columns.
- Content: `pt-4`, `pb-[calc(var(--app-tabbar-h)+env(safe-area-inset-bottom)+1.5rem)]`. `TEST_MODE_LINE` is the last line of content.

| Link | Icon | `href` | Active on |
|---|---|---|---|
| Orders | `ClipboardList` | `/shops/{id}` | Dashboard with no tab, order detail |
| Menu | `BookOpenText` | `?tab=menu` | `?tab=menu` |
| Share | `Share2` | `?tab=share` | `?tab=share`, counter card |
| Settings | `Settings` | `?tab=settings` | `?tab=settings` |

Active: `aria-current="page"`, `bg-surface-sunken font-semibold text-ink`, icon `text-accent`. Orders shows the pomegranate count pill. Every target at least 44 px. Press with `press`.

Skip link: `AppShell` renders its own first-child `Skip to content` to `#app-content` (`tabIndex={-1}`). All chrome `print:hidden`, grid `print:block`. The sidebar is `<nav>`, not `<aside>`.

**Section switching.** `Dashboard` reads the section from `useSearchParams()`. `SectionLink` is a `next/link`: a plain click while already on `/shops/{id}` does `preventDefault`, `history.pushState(null,'',href)`, `scrollTo(0,0)`, focuses the H1 and sets `document.title` to `{Section} · {shop} · Shelfie`. Remove `Tabs` from `Dashboard`. Render one `<div id="section-panel-{tab}" data-section-panel>`.

**Live values.** `src/components/app/shell-store.ts`, read with `useSyncExternalStore`: `toPrepare`, `status`, `logoUrl`, `coverUrl`, `payeeMissing`, `paypalDown`, `recoveryUnsaved`. Do not use React context: a context update reaching a pending Suspense boundary is the documented double-panel bug (`src/components/motion/load-features.ts`).

**Banner slot** (top of content, one at a time, styled like `PayPalBanner`):
1. PayPal unreachable: existing copy.
2. Payee missing: **Not taking orders: add your PayPal email.** `[Add email]` opens Settings.
3. Paused: **Agent orders paused.** Assistants can still read your menu. `[Resume]`.
4. Recovery key unsaved (WP6): **Save your recovery key.** Without it we can't get you back into your account. `[Get a new key]` to `/account#recovery-key`.

**`PageHeader`** (`app/PageHeader.tsx`): `title`, `description?`, `back?`, `status?`, `actions?`. `h1.type-page`, `tabIndex={-1}`. Actions right-aligned on the same row, wrapping when needed. `back` renders `← {label}` with `aria-label="Back to {label}"`. `pb-5 lg:pb-6`, `print:hidden`.

| Screen | H1 | Under it | Right |
|---|---|---|---|
| Orders | `Orders` | none | `Switch` `Pause agent orders`, beside the title at 390 |
| Menu | `Menu` | `10 items · 4 your photos · 6 examples` | `See it on your shop` |
| Share | `Share` | none | none |
| Settings | `Settings` | none | none |
| Order detail | `Order SHF-…` + status | `Placed by Claude, 8:41 PM` | Total, `type-page` |
| Counter card | `Counter card` | existing sentence | `Print card` (`md`) |
| Live | `Your shop is live` / `Your shop is paused` | `{n} items are in your PayPal catalog, plus {m} to ask about in person.` | `Open your shop` (secondary, `ExternalLink`) |
| Setup steps | `StepHeader` switched to `type-page` | unchanged | unchanged |

Remove the `<h2>Menu</h2>` at `MenuPanel.tsx:185`. Order detail's master list moves from `lg` to `xl` at `20rem`. Back links: order detail to Orders, counter card to Share.

**Panel** (`ui/panel.tsx`): `Panel` (heading, count, right-aligned value), `PanelList` (today's `ROWS` classes from `OrdersPanel.tsx:63`), `LinkRow`. Tokens `--row-pad-x:1.25rem`, `--row-pad-y:1rem`, `--row-min-h:4.5rem`. Rows stay `li`. Container query: `@xl` is a grid of `[minmax(0,1fr) auto]`; narrower, the action drops under the text.

**Live (`LiveStep`).** Remove `See it work`, `Open your dashboard` and the owner link (drop the `ownerLink` prop and the token read in `setup/page.tsx`). `For developers` moves to Share. The pending-items warning stays above, full width.
- `≥xl`: `grid-cols-[minmax(0,1fr)_22rem] gap-8`, rows left, preview right.
- `<xl`: compact preview first (avatar, name, status, `Open your shop`), then rows.
- Preview: a raised `Card` showing the actual shop: cover or first item photo at 16:9, avatar, name, status, first three live items as 40 px `ItemPhoto` rows with prices, an `Open your shop` link. `LiveBeat` on this card only.

Rows, no circles, no counts:

| Row (`h3.type-section`) | Detail | Action |
|---|---|---|
| `Try your shop` | none | `Watch an AI order from you` (the one black button, full width at 390) |
| `Your agent door` | `Give it to any AI assistant to order from you.` + URL | `Copy agent door link` (secondary) |
| `Your shop link` | URL | `Copy link` |
| `Counter card` | none | `Print counter card` |

URLs are plain text in their own `<p>` with `[overflow-wrap:anywhere]`, not fake fields.

**Orders empty state.** Left-aligned `h2.type-section` `No orders yet`, the existing sentence, then `Watch an AI order from you` (primary) and `Share your agent door` (text link, opens Share).

**Orders at 390.** Wrap status and action in `col-start-2 col-span-2 flex flex-wrap items-center justify-between gap-2 lg:contents` and drop `w-full` on the action. Filter segments share full width with `Waiting<span class="max-sm:sr-only"> for payment</span>`. Group heads do not wrap; subtotal label `max-sm:sr-only`.

**Menu.** Each section uses `Panel` and `PanelList`. `Photos in one go` is `order-first` only while some items lack the seller's own photo.

**Share.** `≥xl`: `grid-cols-[minmax(0,1fr)_20rem] gap-8`. `<xl`: one column, links first.
- Left, one `PanelList`: `Your agent door` (detail as on Live, `data-testid="share-door-url"`, `Copy agent door link`, the one primary); `Your shop link` (`data-testid="share-shop-url"`, `Copy`, `Open`); `Try your shop` (`Watch an AI order from you`); `For developers` disclosure.
- Right, `<section aria-label="Counter card">`: QR thumbnail and `Print counter card` (secondary, full width). No grey box.
- Drafts: no URLs, no QR, `Your shop gets its web address when you publish.` and `Finish setting up`. `SharePanel` takes shop status.

**Settings.** Each section `lg:grid-cols-[14rem_minmax(0,1fr)] gap-x-10 py-6 border-t border-line` (no rule on the first). Right column `max-w-lg`.
- `Where you get paid`: `Buyers pay straight into the PayPal account with this email.`
- `Your logo`.
- `Sign-in`: with an account, `Signed in as {email}` and `Account settings`. With none, only `Log in`.

Remove the duplicate Pause.

**States.** Loading: `(app)/(dashboard)/loading.tsx` inside the shell (24 px title bar, filter, rows). Error: `(app)/error.tsx`: `Something went wrong`, `This page didn’t load. Your shop and orders are safe.`, `Try again` calling `retry`. Non-owner: real 404 with the public header. Long name: sidebar two-line clamp, top bar one-line ellipsis.

`src/lib/seller/shell.ts` exposes `loadShellData(shop)` and `currentShellAccount()`, which returns null until WP5/6. Every account branch must work with null.

**Files.**
- Add: `src/components/app/{AppShell,AppNav,SectionLink,PageHeader,shell-store}`, `src/components/ui/panel.tsx`, `src/lib/seller/shell.ts`, `(app)/layout.tsx`, `(app)/error.tsx`, `tests/ui/working-screens-type.test.ts`, `e2e/app-shell.spec.ts`.
- Change: `globals.css`, `layout.tsx`, `brand/{SiteHeader,SiteFooter}.tsx`, `dashboard/{Dashboard,SharePanel,SettingsPanel,OrdersPanel,OrderCard,MenuPanel}.tsx`, `setup/{LiveStep,StepHeader}.tsx`, `setup/page.tsx`, `card/{page,PrintButton}.tsx`, `orders/[orderId]/page.tsx`, `docs/DESIGN.md`, `CLAUDE.md` (Routes).
- Selectors, in the same commit as the tab change: add `appNav(page)` to `e2e/helpers.ts`; `aria-selected` becomes `aria-current="page"`; `tabpanel` becomes `[data-section-panel]`. Update `e2e/dashboard.spec.ts:75-76,225,237,262-296`, `e2e/discovery.spec.ts:177`, `e2e/menu-tab.spec.ts:47-48,162`, `e2e/screenshots.spec.ts:490-497 (remove),505,527,536,657`, `e2e/flow.spec.ts:78-79` (assert `Orders` nav link href), `scripts/clips/record.ts:313,352,730,791,817`.

**Acceptance** (390 means 390x844, 1440 means 1440x900).
1. 1440, `/shops/:id`: `appNav` shows Orders, Menu, Share, Settings in order, Orders `aria-current="page"`, no `[role=tab]`.
2. 390: nav bottom equals viewport bottom, links at least 44 px, sidebar hidden.
3. `scrollWidth<=innerWidth` at 390, 1024, 1440 on Orders, Menu, Share, Settings, order detail, counter card, Live.
4. Menu then Back returns to Orders, with a `window` marker surviving and no `_rsc` request.
5. `?tab=menu` deep-links. Exactly one `[data-section-panel]` at every sampled frame during quick switches.
6. Order detail has Orders active; counter card has Share active.
7. In the shell, `body>header` and `body>footer` are hidden. First Tab lands on one `Skip to content`; Enter focuses `#app-content`.
8. 390: last content element ends above the tab bar, and a toast sits above its top.
9. Pausing shows the banner on all four sections. Resume clears it and sends `status:'live'`. Only one banner renders when several conditions hold, in the priority above.
10. The print test passes; shell chrome hidden in print.
11. Uploading a logo updates `img[data-avatar="logo"]` in `shop-switcher` without reload.
12. Unit: no `type-display`, `type-hero` or `type-title` under `src/components/dashboard`, `src/app/shops`, or in `LiveStep.tsx`, `StepHeader.tsx`.
13. H1 computed 24 px on all seven screens at 390 and 1440.
14. First order row top under 280 px at 390 and under 260 px at 1440.
15. Live: nav visible; no `Open your dashboard`, no `See it work`; `Open your shop` works; `/claim/` absent from the HTML; exactly one primary button.
16. Empty Orders has `No orders yet` and `Watch an AI order from you`.
17. Share: `share-door-url` and `share-shop-url` values unchanged; `Copy agent door link` visible; region `Counter card` contains the QR image and `Print counter card`. Draft Share: `page.content()` lacks the draft slug.
18. Live and Share contain no `bg-surface-sunken` section whose only content is a heading and buttons.
19. Settings at 1440: heading left of its control, tops within 8 px, form's left edge at least 240 px right of the content edge.
20. 390: on a paid order, status and action overlap vertically; all four filter buttons in the viewport; subtotal on the heading's line; with all photos present the menu list precedes `Photos in one go`, with some missing it follows.
21. `a11y(page)` zero violations on all of the above at both widths.

---

### WP5. Accounts backend (must-have, part of 2.75 h with WP6)

Guests stay allowed here: `guestShopsAllowed()` returns true until WP7, so behaviour does not change.

**Schema** (`schema.sql`, before `shops` where it references them):

```sql
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,            -- acc_...
  email TEXT NOT NULL UNIQUE,     -- normalised by parsePayeeEmail
  password_hash TEXT NOT NULL,    -- scrypt$32768$8$3$<salt>$<key>, base64url
  recovery_hash TEXT NOT NULL,    -- SHA-256 hex of the current key
  recovery_saved_at TEXT,         -- null shows the banner
  terms_version TEXT NOT NULL,
  terms_accepted_at TEXT NOT NULL,
  password_changed_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,    -- SHA-256 of the cookie value
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL        -- created_at + 30 days, never extended
);
CREATE INDEX IF NOT EXISTS sessions_account ON sessions(account_id);
CREATE TABLE IF NOT EXISTS payee_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  old_masked TEXT,
  new_masked TEXT NOT NULL,
  changed_at TEXT NOT NULL
);
```

- `shops` gains `account_id TEXT REFERENCES accounts(id)` in its `CREATE TABLE` and in `addMissingColumns`.
- `CREATE INDEX IF NOT EXISTS shops_account ON shops(account_id)` lives in `addMissingColumns`, after the column check, not in `schema.sql`.
- Add `accountId:string|null` to `Shop`, `'acc'` to `IdPrefix`, `accountId` to `CreateShopInput`, `createShopFromPhotos`, `createShopFromSample`.
- No backfill.

**Modules** (`src/lib/auth/`): `password.ts`, `common-passwords.ts`, `recovery.ts`, `session.ts` (`currentAccount`, `requireAccount`, `landingPath`, cookies), `next-path.ts`, `guest.ts`. Plus `db/repos/{accounts,sessions}.ts`, `http/same-origin.ts`, `legal/version.ts`, `brand/test-mode.ts` (`TEST_MODE_LINE`), `client/auth.ts`.

- `currentAccount()` reads `cookies()` first and returns null with no cookie, without touching the database. The build has no disk and never opens the database (`render.yaml`). Header callers wrap it in try/catch with `unstable_rethrow`, as `page.tsx:31-36` does.
- `common-passwords.ts`: hand-written, at least 200 common passwords and phrases of 15 or more characters, compared lower-cased.
- Recovery key: 20 characters from a 32-character alphabet (100 bits), printed `XXXXX-XXXXX-XXXXX-XXXXX`. Compare after removing dashes and upper-casing.

**Authorization** (`owner.ts`; all call sites keep their signature):

```ts
export async function getOwnedShop(shopId: string): Promise<Shop | null> {
  const db = getDb();
  const shop = shops.byId(db, shopId);
  if (!shop) return null;
  if (shop.accountId) {
    const account = await currentAccount();
    return account?.id === shop.accountId ? shop : null;
  }
  const jar = await cookies();
  return shops.verifyOwnerToken(db, shopId, jar.get(ownerCookieName(shopId))?.value) ? shop : null;
}
```

`requireOwner` returns the shop if owned. Otherwise, with no valid session and `shelfie_returning` set, it redirects to `/login?next=/shops/<id>`. Otherwise `notFound()`. `listOwnedShops` filters to `accountId===null`.

| Surface | Rule |
|---|---|
| `/shops/[id]/**` pages and layouts | `requireOwner` |
| Every `/api/shops/[id]/**` handler | `ownedShop`/`getOwnedShop`, 404 JSON if null |
| `POST /api/shops` | Session required, else 401 `LOGIN_REQUIRED`, unless guests allowed. At most 25 shops per account (409 `SHOP_LIMIT`). With a session: `account_id` set, owner token generated and discarded, no owner cookie, no `ownerLink` returned. |
| `/shops`, `/account` | `requireAccount()`, redirect to `/login?next=…` |
| `/shops/new` | Same, except when guests allowed |
| `/login`, `/signup`, `/recover` | A logged-in visitor goes to `landingPath` |
| `/s/*`, `/o/*`, `/api/assistant/*`, `/api/paypal/*`, `/api/orders/[ref]`, `/i/*`, `/agents.txt`, `/llms.txt`, `/api/health` | Public, unchanged |

`landingPath`: 0 shops to `/shops/new`; 1 shop to its dashboard (setup if draft); more to `/shops`. On a dashboard poll, a 404 triggers `window.location.reload()`.

**API.**

| Route | Body | Success | Errors |
|---|---|---|---|
| POST `/api/auth/signup` | `email,password` | 201 `{recoveryKey,next}`, session set | 400 `INVALID_EMAIL`,`WEAK_PASSWORD`; 409 `EMAIL_TAKEN`; 429; 503 `BUSY` |
| POST `/api/auth/login` | `email,password,next?` | 200 `{next}` | 401 `BAD_CREDENTIALS`; 429; 503 |
| POST `/api/auth/logout` | none | 204, row deleted, cookie cleared | |
| POST `/api/auth/recover` | `email,recoveryKey,newPassword` | 200 `{recoveryKey,next}`, all sessions ended, new session | 401 `BAD_RECOVERY`; 400; 429; 503 |
| POST `/api/account/recovery-key` | `currentPassword` | 200 `{recoveryKey}` | 403 `PASSWORD_REQUIRED`; 429 |
| PATCH `/api/account/recovery-key` | none (marks saved) | 204 | |

Key responses set `Cache-Control: no-store`.

**PayPal email change** (`PATCH /api/shops/[id]`). Read the body, take `currentPassword` out, then call `parseShopPatch` on the rest. A password is required when `shop.accountId && shop.status!=='draft' && patch.payeeEmail!==undefined && patch.payeeEmail!==shop.payeeEmail`. Missing: 403 `PASSWORD_REQUIRED`. Wrong: 403 `PASSWORD_WRONG`. Update the shop and insert into `payee_changes` in one transaction.

**Files.** The above, plus `api/auth/{signup,login,logout,recover}/route.ts`, `api/account/recovery-key/route.ts`, `lib/db/{schema.sql,index.ts}`, `repos/shops.ts`, `domain/{types,ids}.ts`, `rate-limit.ts`, `http/client-ip.ts`, `config.ts` (`supportEmail`), `auth/owner.ts`, `catalog/{setup,shop-image-route}.ts`, `api/shops/route.ts`, `api/shops/[id]/route.ts`, `claim/[token]/route.ts`, `client/api.ts`, `setup/page.tsx`. Tests are named under Security requirements.

**States.** API only; no screen changes at 390 or 1440.

**Acceptance.** Every Security requirement below except SR19 passes here. Also: a migrated old database gains `shops.account_id` and its index without error, and existing shops keep working through owner cookies. An account owns only its own shops; another account gets 404 on every owner page and API route. With a valid session and matching shop, access works with no owner cookie. `tests/auth/owner.test.ts` passes unchanged. The login gate's 401 is tested with `guestShopsAllowed` stubbed false.

---

### WP6. Account screens (must-have, part of 2.75 h with WP5)

**Header.** `SiteHeader` stays a server component and passes the account to a client `HeaderNav` reading the pathname. `h-16`, `border-b border-line`.

| Where | 1440 | 390 |
|---|---|---|
| `/s/*`, `/o/*` | Logo only | Same |
| `/`, `/help`, legal, 404, logged out | Logo; `Log in` (ghost); `Add your shop` (secondary) | Logo; `Log in` |
| `/login`, `/signup`, `/recover` | Logo; `New to Shelfie? **Add your shop**` or `Have an account? **Log in**` | Logo; the bold link only |
| Logged in | Logo links to `/shops`; `AccountMenu` | Same |
| Logged out with a valid owner cookie | Adds one plain link `Dashboard` to `/shops/{id}` for one shop, `/` hidden otherwise | Same |

**`AccountMenu`** (`brand/AccountMenu.tsx`, used by header and shell). 44 px ghost trigger, `CircleUserRound`, name `Account`. Never letters. Disclosure pattern (`aria-expanded`, links, no `role="menu"`). Esc and outside click close; focus returns to the trigger. Prop `placement:'up'|'down'`. Panel `w-64 max-w-[calc(100vw-2*var(--spacing-gutter))] bg-surface-raised shadow-md rounded-lg`, `--z-menu:30`. Contents: email (`type-meta`, truncated), Your shops, Add a shop, Account, Help, rule, Log out. All 44 px rows.

**Auth shell** (`(auth)/layout.tsx`). One centred column, `max-w-(--auth-form-w)` with `--auth-form-w:26rem`, `px-gutter pt-8 lg:pt-16`, no photo, both widths.

`PasswordField`: show button `type="button"`, 44 px, `aria-label="Show password (it will be visible on screen)"` / `Hide password`. `Field` gains `id`: `signup-email`, `new-password`, `login-email`, `current-password`, with different `name` values per form. Email: `type="email" autocomplete="username" autocapitalize="none"`. Password `autocomplete` is `new-password` or `current-password`. Paste allowed.

| Page | H1 | Button (loading) | Exact errors |
|---|---|---|---|
| `/signup` | Create your account | Create account (Creating your account...) | `Enter your email, like rosa@example.com.` · `Use at least 15 characters.` · `That password is too common. Try a short sentence only you would say.` · `There's already an account with this email. **Log in** or **use your recovery key**.` · `Too many tries from this connection. Wait a few minutes and try again.` · `Couldn't reach Shelfie. Check your connection and try again.` |
| `/login` | Log in | Log in (Logging in...) | `That email and password don't match. Try again, or **reset your password**.` · `Too many tries. Wait 15 minutes, or **reset your password with your recovery key**.` |
| `/recover` | Reset your password | Set new password (Saving...) | `That email and recovery key don't match. Check for typos.` |

A 503 `BUSY` shows `Shelfie is busy. Try again in a few seconds.` on all three.

- Sign-up password hint, live and polite: `At least 15 characters. A short sentence works well.`, then `{n} more to go`, then `Long enough`.
- Under the sign-up button: `By creating an account you agree to the **Terms** and **Privacy Policy**.`
- `/login`: `Forgot password?` under the password field, right-aligned. When `next` starts with `/shops/`: `Log in to open this shop.`
- `/recover`: `Use the recovery key you saved when you signed up.` At the foot: `Lost your key too? **What you can do**` to `/help#locked-out`.
- Log in and out finish with `window.location.replace(next)`.

**Recovery key step** (`RecoveryKeyStep`, client state after sign-up, recovery or new key; never fetched again).
- H1 `Save your recovery key`. `Shelfie doesn't send email yet, so this is the only way back in if you forget your password. We can't show it again.` Then `You'll log in with rosa@example.com.`
- Key in a `surface-sunken` well, mono, `text-xl`, wrapping 2x2 at 390.
- Primary **Download** (`shelfie-recovery-key.txt`, naming Shelfie, the email and `<appUrl>/recover`). Beside **Continue** (secondary): **Copy** and **Print**. No checkbox.
- Any of Download, Copy or Print calls `PATCH /api/account/recovery-key`. Continue is always enabled.

**`/shops`.** `max-w-page`, `PageHeader title="Your shops"`, primary `Add a shop` (Plus) at both widths. Recovery banner above the list when unsaved. `PanelList` rows: whole-row link, min-h 88 px, `hover:bg-surface-subtle`, `ShopAvatar size="md"`, name (`type-heading`, truncated), status (`ShopStatusBadge`, extracted to `dashboard/shop-status.tsx`), right column `3 to prepare` with accent count pill and chevron. At 390 the count moves under the status. Drafts link to setup and read `Not published yet`. Sort by to-prepare, then newest. Zero shops redirects to `/shops/new`. `loading.tsx`: three skeleton rows.

**`/shops/new`.** `PageHeader` `Add your shop` (0 shops) or `Add a shop`. Lead: `Take a photo of your price list. You'll check it before anything goes live.` `StartActions` with its test ids, minus `See a live shop`. With zero shops only, one text line `No photo handy? Try a sample:` and the same three buttons and accessible names, with no image chips. `Frame`'s `WIDE` regex must exclude `new`.

**`/account`** (minimal here, S1 extends). `max-w-measure`. Login email, read-only. Section `id="recovery-key"`: `Saved on 8 Nov 2026` in `ok` or `Not saved yet` in `warn`; `Create a new key` with a current-password field and `This cancels your old key.`, then `RecoveryKeyStep`.

**Payee check in Settings.** When the email differs from the saved one on an account-owned non-draft shop, a `PasswordField` labelled `Your Shelfie password` appears under it. Wrong: `That password doesn't match.` Show `PayPal email changed on {date}` (`type-meta`) when a change exists.

**Shell.** `currentShellAccount()` becomes real. `RecoveryBanner` wired into the banner slot on every seller page.

**Files.** `src/app/(auth)/{layout,signup/page,login/page,recover/page}.tsx`, `src/app/shops/{page,loading,new/page}.tsx`, `src/app/account/page.tsx`, `src/components/auth/{PasswordField,SignupForm,LoginForm,RecoverForm,RecoveryKeyStep}.tsx`, `src/components/account/RecoverySection.tsx`, `src/components/brand/{HeaderNav,AccountMenu}.tsx`, `src/components/shops/{ShopRow,RecoveryBanner}.tsx`, `dashboard/shop-status.tsx`. Change `brand/{SiteHeader,Frame}.tsx`, `ui/field.tsx`, `ui/button.tsx`, `dashboard/{SettingsPanel,api}.ts(x)`, `_start/StartActions.tsx`, `lib/seller/shell.ts`, `globals.css`.

**Acceptance** (`e2e/accounts.spec.ts`).
1. Journey: sign up, recovery step, `Continue`, `/shops/new`, sample menu, setup. Log out. Log in returns to that shop.
2. Second browser context after login opens the dashboard with no owner cookie.
3. Two shops: `/shops` lists both, `Add a shop` opens `/shops/new`. One shop: login lands on the dashboard, and the switcher opens `/shops` with one row and `Add a shop`.
4. Logged out with `shelfie_returning`: `/shops/<id>` redirects to `/login` and returns after login. A fresh browser gets 404.
5. A logged-in visitor to `/login` goes to `landingPath`.
6. `Forgot password?` reachable by keyboard. Password fields have the required `autocomplete` and different ids across forms.
7. `AccountMenu` opens by keyboard, closes on Esc, returns focus.
8. Recovery banner shows on Orders, Menu, Share, Settings and `/shops` when unsaved, and clears after Download.
9. A published account-owned shop: changing the PayPal email without a password shows the field and leaves the email unchanged; with it, the change saves and `PayPal email changed on` shows.

---

### WP7. Landing, public pages, flip the gate (must-have, 1.25 h)

**Landing `/`.** Logged-in visitors redirect to `landingPath`. `max-w-page`, white throughout, exactly four parts. Delete `WelcomeBack` and its data fetch.

| Part | 1440 | 390 | Copy |
|---|---|---|---|
| Hero | 12-col: left 6 copy, right 6 existing `StorePreview` | Stacked, CTA full width, then preview | H1 `Your price list, open to AI shoppers.` Lead `Snap the paper menu on your counter. Shelfie turns it into a PayPal shop any AI assistant can order from.` Primary lg `Add your shop` to `/signup`. Beside it text link `Log in`. Below, `type-meta`: `TEST_MODE_LINE`. |
| How it works | One row of four artefacts, `lg:grid-cols-4 gap-6`, each with a one-line caption beneath, no shared box, one `Reveal`. Text link `See an example shop` at the end, only if `bySlug('marigold-bakehouse')` is live. | Stacked, full width | H2 `From the paper on your counter to a paid order`. Artefacts built from real primitives: (1) paper photo `public/samples/marigold-bakehouse.jpg`, caption `Snap your price list.` (2) parsed rows, one with a warn dot and `Is this $4 or $14?`, caption `Claude reads it and asks about anything unclear.` (3) approve card ending in the PayPal-blue button, caption `Your shop gets an agent door, an address any AI assistant can order through. Buyers approve on PayPal.` (4) paid order row with brief, caption `You get the order and a short brief.` |
| FAQ | `max-w-measure`, native `<details>`, rules between, no boxes | Same | Below |
| Close | One line with CTA, `border-t border-line pt-8` | Stacked | H2 `Put your counter online today.` `Add your shop` |

FAQ:
- **Do I need a website?** No. Your shop gets its own page and link, and a card with a QR code you can print for the counter.
- **Do my buyers need an AI assistant?** No. Every shop page has an assistant built in.
- **Can I take real payments today?** Not yet. Shelfie runs on the PayPal sandbox, PayPal's practice system for payments, so orders are practice runs and no real money moves. You can set everything up now.
- **What happens to my photos and orders?** Menu photos go to Anthropic's Claude to be read, and items and orders go to PayPal to take payment. We don't sell your data. (S1 appends: `You can delete your shop or account whenever you like.`)
- **What if I forget my password?** You save a recovery key when you sign up. It lets you set a new password. Shelfie doesn't send email yet, so keep it somewhere safe.

**Footer.** `TEST_MODE_LINE` verbatim. Every link `inline-flex min-h-tap`.
- Buyer pages: the sentence plus Terms and Privacy.
- `/shops`, `/shops/new`, `/account`: one row, sentence left, Help, Terms, Privacy right.
- `/`, `/help`, legal at 1440: `Logo` and the sentence, then groups **Product** (Add your shop, Log in), **Help** (Help), **For AI assistants** (`/agents.txt`, `/llms.txt`), **Legal** (Terms, Privacy, Open source on GitHub, using the repository URL from the README's clone command). At 390 the groups are a two-column grid above the sentence.

**Other pages.**
- `not-found.tsx`: H1 `We can't find that page`. `It may have moved, or it may belong to a shop you're not logged in to.` Primary `Your shops` if logged in, else `Go to Shelfie` with secondary `Log in`.
- `error.tsx`: `That page didn't load`, `Try again` calling `retry`.
- `global-error.tsx`: own `<html>` and `<body>`, inline styles, system font, `Reload`.
- `/claim/<bad>`: status 404, small branded HTML: `This owner link doesn't work. Check that you copied all of it, or log in.` with a `Log in` link.
- `/help`: anchors `#test-mode`, `#get-paid`, `#locked-out`, `#delete`, contact.
  - `#test-mode`: `Shelfie runs on the PayPal sandbox, PayPal's practice system for payments. Orders and payments are practice runs and no real money moves.`
  - `#locked-out`: `Without your password and recovery key we can't confirm the account is yours, so we can't reset it for you yet. Your shop keeps running.`
  - `#delete` until S1 ships: `To delete your shop or account, contact us.`
  - Contact: `SUPPORT_EMAIL` when set, else GitHub Issues.
- `/terms`, `/privacy`: `max-w-measure`, heading `Early-access draft, last updated 8 November 2026`, no placeholder text, governing law omitted. A code comment flags them as templates for human review.
  - Privacy states: email, password hash, recovery-key hash, session times; shop name, PayPal email, photos; buyer and payer name, email, ship-to, note; a hashed caller id. Processors: Anthropic (photos, order text for briefs, assistant chats), PayPal (catalog, orders, payment), Pexels (search words, when configured). Cookies: session, returning, owner cookie. No analytics or ads. Deletion: by contacting us, until S1 replaces it with `/account`.
  - Terms state: early access, test mode, seller responsible for menu accuracy and allergens, PayPal's own terms apply, no warranty, account closure.

**Flip the gate, in one commit.** `guestShopsAllowed()` reads `SHELFIE_ALLOW_GUEST_SHOPS` (see SR20). Set the flag in `tests/setup.ts`, `playwright.config.ts`, `scripts/screenshots-prod.sh`, `scripts/clips/app.ts`. Move e2e that use the photo input or sample chips to `/shops/new`: `e2e/{start,flow,recordings,screenshots}.spec.ts` and any other. `e2e/screenshots.spec.ts:415-416` now expects the `Dashboard` header link. `scripts/clips/record.ts:216` opens `/shops/new`.

**Files.** Rewrite `src/app/page.tsx`. Add `src/components/landing/{Hero,HowItWorks,Faq,Closing}.tsx`, `src/app/help/page.tsx`, `src/app/(legal)/{terms,privacy}/page.tsx`, `src/app/{error,global-error}.tsx`, `e2e/landing.spec.ts`. Change `not-found.tsx`, `claim/[token]/route.ts`, `brand/SiteFooter.tsx`, `lib/auth/guest.ts`, `.env.example`.

**Acceptance.**
1. Logged-out `/` shows `Add your shop` and `Log in` in the first viewport at 390 and 1440, with no photo input and no sample chips.
2. `/` has exactly four top-level sections. Marigold appears only in the hero preview, the paper frame and `See an example shop`. No demo login exists anywhere.
3. `/` with an owner cookie: no `Welcome back`, no `Open your dashboard`, one `Dashboard` link. A logged-in visitor redirects.
4. `/terms`, `/privacy`, `/help` exist. Footer links at least 44 px. Buyer pages show no `Log in` or `Add your shop` in the header.
5. A forced server error renders `error.tsx`, and `Try again` works.
6. Real-account e2e: sign up, publish a sample, dashboard, shop page.
7. Screenshot and axe at 390 and 1440 for landing, sign-up, login, recover, recovery step, Your shops, Add a shop, Account, Help, Terms, Privacy, 404: 0 violations, no horizontal scroll.
8. `TEST_MODE_LINE` visible on every seller and buyer screen.
9. Lighthouse on `/s/marigold-bakehouse` (mobile, production) stays at or above 90.

---

### WP8. Verification and judging (must-have, 1.25 h)

1. Full `npm test`, typecheck, lint, `npm run e2e` with the capture gate, `npm run test:sandbox`.
2. `npm run screenshots:prod -- docs/judge/screenshots/round-12`, including `console-empty`, `console-thinking`, `console-conversation`, `shop-first-screen`, `shop`, `shop-no-photos`, at both widths.
3. Judge round 12 per `docs/JUDGING.md`, written to `docs/judge/round-12.md`. Add a separate "Proposed checks" table for the Rubric additions below. Append to `docs/judge/SCORES.md`. Fix the top findings.
4. Update docs: `README.md` (lines 48, 85, 100-104, 234, plus a "Try it" section: sign up and use a sample, or `npm run seed` and its owner link), `docs/SUBMISSION.md` (39, 96), `docs/DEPLOY.md`, `docs/DESIGN.md`, `docs/DECISIONS.md`, `docs/PROGRESS.md`, `CLAUDE.md` (Seller auth, Routes), `.env.example` (`SHELFIE_ALLOW_GUEST_SHOPS`, `SUPPORT_EMAIL`).

**Acceptance.** All suites green; verdict recorded; PROGRESS states what is verified and what is not.

### WP9. Re-record and render (must-have if at least 1.5 h remains, 1 h)

`npm run clips` with the updated selectors, `node video/tools/align-cuts.mjs video/project/demo.json <oldClipsDir> video/clips`, `cd video/remotion && npm run render`. Keep the narration. Check frames every 2 s. **Acceptance:** duration under 3:00, 1920x1080, -14 LUFS, new UI visible in every clip that shows the shop, dashboard or Live.

---

### Should-haves, in order, each separately revertible, only after WP8

**S1. Account and delete.**
- `/account` adds Password (`POST /api/account/password` with `currentPassword,password`; other sessions ended), `Log out of other devices` (`DELETE /api/account/sessions`), Delete account (`DELETE /api/account` with `currentPassword`; 204; 409 `OPEN_ORDERS` naming shops), all in `text-error` for delete.
- Delete shop at the foot of Settings: H2 `Delete this shop`, `Your shop page and agent door stop working, and its menu, photos and orders are deleted from Shelfie. Buyers keep their PayPal receipts. This can't be undone.` Ghost `text-error` `Delete shop` opens `Sheet`: `Delete {name}?`, field `Type the shop's name to confirm`, password field, new `danger` Button (`bg-error`, white). Blocked: `{n} orders are still open. Hand them over, or wait for unpaid ones to expire (up to an hour), then try again.`
- Add `lib/catalog/delete-shop.ts` and SR19. Update the FAQ, Privacy and `/help#delete`.
- **Acceptance:** wrong name blocks; correct name removes from `/shops`; `/s/<slug>` is then 404; delete then publish the same name gives `-2`.

**S2. Order chime and vibration.** `prefs.ts`, `sound.ts`, `haptics.ts`, `/shops/*` only.
- One boolean, default on, `localStorage` key `shelfie:feedback:v1`, try/catch, `useSyncExternalStore`. Settings section `Sound and vibration` with one Switch and one line: `Saved on this device. Keep this page open, and tap it once after opening, to hear order chimes.`
- Chime: `OscillatorNode` and `GainNode`, E5 659.25 Hz then A5 880 Hz at +90 ms, each with an octave partial at 25%, peak gain .14, attack 6 ms, exponential decay, about 450 ms, at most once per 1.2 s. `navigator.audioSession.type='ambient'` when present, in try/catch. Unlock on first `pointerdown` or `keydown`.
- Vibrate: flip 10, success `[10,40,14]`, error `[20,40,20]`, order `[16,60,24]`. Chime fires once per poll batch (`Dashboard.tsx:93`).
- **Acceptance** with spies: zero `AudioContext` on `/`, `/s/*`, `/o/*`; one order event per batch; off produces none.

**S3. Older Activity collapse.** Once a newer turn starts, an Activity entry collapses to `Activity · 3 calls to the agent door` with a chevron (`<details role="group" aria-label="Activity">`), with `ms` moved into the expanded row. Never collapse an errored or interrupted call. **Acceptance:** first turn's rows hidden after a second turn, a failed call never collapses.

**S4. Receipt as a single column** (`o/[ref]/Receipt.tsx`).

**S5. Setup review, phone.** Under 640 px `Actions` is `grid-cols-[1fr_1fr_auto]`, `Remove` is `max-sm:sr-only`. `ExampleCaption` gains `quiet` (`sr-only`) in list rows. One visible line above `Ready for PayPal`: `Example photos are marked in the corner. Tap one to use your own.`

**S6. Counter card miniature** (`CounterCard` extracted, QR passed as prop) and `Share…` (only when `navigator.share` exists and `(pointer:coarse)`; ignore `AbortError`).

## Security requirements

| # | Requirement | Test |
|---|---|---|
| SR1 | No `src/proxy.ts` or middleware. A 14 MB multipart `POST /api/shops` reaches the handler whole and succeeds. | `tests/http/same-origin.test.ts`, `tests/api/large-upload.test.ts` or e2e |
| SR2 | `assertSameOrigin(req)` is the first statement of every exported POST, PUT, PATCH, DELETE under `src/app/api/**` and in `shop-image-route.ts` (rename `_req`). Only `paypal/webhook` is exempt. Returns `Response|null`. | AST test per exported handler |
| SR3 | Origin rules: a parsed `Origin` host must equal `x-forwarded-host ?? host` or `APP_URL`'s host, else 403 `BAD_ORIGIN`. `null` or unparsable: 403. Missing `Origin`: 403 if `Sec-Fetch-Site` is `cross-site`, else pass. | Unit, each case |
| SR4 | `safeNext`: normalise with `new URL(next,base)`, require same origin, and accept only pathname `/shops`, `/shops/…` or `/account`. Rejects `//evil.example`, `/\evil.example`, `https://evil.example`, `/api/x`, `/claim/x`, `/shops/../claim/x`, control characters. | `tests/auth/next-path.test.ts` |
| SR5 | Passwords stored only as `scrypt$32768$8$3$…`: async scrypt, 16-byte salt, 32-byte key, `maxmem:64*1024*1024` set inside the module. Rehash on login if parameters differ. | `tests/auth/password.test.ts` |
| SR6 | Passwords 15 to 128 characters, no composition rules. Refuse blocklist, single repeated character, and the account's email. A 15-character lowercase phrase and a 128-character string pass. | Same |
| SR7 | Global hash gate: 2 concurrent, at most 8 queued, otherwise 503 `BUSY` with `Retry-After`. Covers every scrypt call. | Unit with a stubbed hash |
| SR8 | All rate limits run before any hash. | Unit: over-limit request performs no hash |
| SR9 | Login failure text and status are identical for unknown email and wrong password. A dummy hash runs for unknown email. | `tests/api/auth-routes.test.ts` |
| SR10 | `rate-limit.ts` stores each key's window and evicts by that key's own expiry. Adds `peek` and `recordHit`. `clientIp` buckets IPv6 by /64. Email keys hold a hash, never the address. | Unit: a 15-minute caller over 10,000 keys leaves a live hourly bucket intact |
| SR11 | Limits: sign-up 10/IP/hour. Login 50 attempts/IP/15 min, checked first; failures only: 10 per email+IP/15 min and 100 per email/hour, keyed by normalised email whether or not the account exists. Recovery 10 attempts/IP/hour; failures only: 5 per email+IP/hour and 30 per email/hour. Current-password check 10 failures/account/15 min. | Unit with `vi.stubEnv('SHELFIE_TEST','')` (`tests/setup.ts:5` sets it): after 10 failures login is 429 and recovery still succeeds; a successful login does not count |
| SR12 | Recovery is atomic: hash the new password first, then in one transaction run `UPDATE accounts SET … WHERE id=? AND recovery_hash=?`, require one changed row, delete all sessions. Issue a new key. Hash always runs, even for unknown emails. | `tests/auth/recovery.test.ts`, including two concurrent uses where one fails |
| SR13 | Session cookie holds 32 random bytes; database holds SHA-256. Expiry is fixed at 30 days. Login replaces any existing session and purges expired rows. Logout deletes the row. A row past `expires_at` is logged out. Recovery keys and session tokens never appear raw in the database. | `tests/auth/session.test.ts` |
| SR14 | Cookie `__Host-shelfie_session` when `getConfig().appUrl` is https, else `shelfie_session`. `httpOnly`, `sameSite:'lax'`, `path:'/'`, `secure` only on https, 30 days. `shelfie_returning=1` httpOnly, 1 year, kept through logout. | Unit |
| SR15 | An owner token never opens an account-owned shop (code in WP5). | `tests/auth/account-owner.test.ts` |
| SR16 | Every exported handler under `api/shops/[id]`, and every `page.tsx` and `layout.tsx` under `shops/[id]`, contains an owner check, following `shopImageRoutes`. | `tests/auth/route-guard.test.ts` (AST, per method) |
| SR17 | `POST /api/shops`: 401 with guests off and no session; with a session sets `account_id`, sets no cookie, returns no owner link; the 26th shop returns 409. | Unit |
| SR18 | PayPal email change on an account-owned shop with `status!=='draft'` needs `currentPassword`; a paused shop still prompts. Each change is recorded in `payee_changes` in the same transaction and shown in Settings. | Unit: no password leaves the email unchanged |
| SR19 | (S1) `retired_slugs(slug PRIMARY KEY, retired_at)` is written in the delete transaction, including account deletion. `uniqueSlug` and `assignRealSlug` treat those as taken. `DELETE /api/shops/[id]` needs `confirmName` and `currentPassword`, returns 403 `ACCOUNT_REQUIRED` for shops with no `account_id` unless guests allowed, refuses `isDemoShop`, and is 409 `OPEN_ORDERS` while any order is `approved`, `paid`, `payment_pending` or unexpired `awaiting_approval`. Rows and files removed. **Delete cannot ship without this.** | `tests/api/delete.test.ts` |
| SR20 | `SHELFIE_ALLOW_GUEST_SHOPS` and the `SHELFIE_TEST` skip of auth limits are both ignored when `RENDER` is set. | Unit |
| SR21 | Log in and out use `window.location.replace`. `requireOwner` stays in every page after the route move. | Covered by SR16 and e2e |
| SR22 | Recovery warning renders on every seller page when unsaved. | WP6 AC 8 |
| SR23 | Passwords, recovery keys and tokens are never logged. Key responses set `Cache-Control: no-store`. | Grep test on `console.` in auth modules; unit on the header |
| SR24 | `/claim/` never appears in HTML for an account-owned shop. | WP4 AC 15 |
| SR25 | Removal guard: no `is_demo`, no `api/auth/demo`, no `attach` route, no `shelfie-storefront`, no `api/checkout` in `src`. | Static test |

**Review mapping.**

| Defect | Resolution |
|---|---|
| 1 Proxy truncation (High) | SR1, SR2 |
| 2 Attach takeover (High) | Closed by removal: attach is not built. If it returns: typed `confirmPayeeEmail`, audit columns, a detach script, `next=/shops`. |
| 3 Slug reuse on delete (High) | SR19 |
| 4 Write-guard rollout (High) | Closed with the demo account; the per-method check is SR16 |
| 5 Demo hijack (High) | Closed by removal: no demo account |
| 6 Demo reads real orders (High) | Closed by removal |
| 7 Delete by bearer link | SR19 |
| 8 `Origin: null` | SR3 |
| 9 Token opens account shops | SR15 |
| 10 Lockout denial | SR11 |
| 11 Rate-limit eviction | SR10 |
| 12 Recovery not atomic | SR12 |
| 13 scrypt starvation | SR7, SR8 |
| 14, 15, 21 Cart and storefront | Closed by removal: no cart |
| 16 `safeNext` | SR4 |
| 17 Recovery warning | SR22 |
| 18 Stale logged-out state | SR21 |
| 19 Test flags | SR20 |
| 20 Payee audit | SR18 |

Accepted trade-off: `EMAIL_TAKEN` enumeration, a consequence of having no mail sender. It grants no ownership.

## Rubric additions

**Status: proposed.** These inputs contain no record of the owner approving them, and `CLAUDE.md` says never to edit `docs/JUDGING.md`. Do not edit that file. Judge round 12 scores these in a separate "Proposed checks" table in `docs/judge/round-12.md`. Treat a fail as blocking this run's sign-off. Text ready for the owner to paste into Part C if approved:

> **Owner's complaints, 8 Nov 2026** (amendment approved by the human on ____). Each passes or fails, with evidence at 390 px and 1440 px.
> - **Assistant placement.** At 1440x900 the assistant touches the top, right and bottom of the screen at the top, middle and end of the page. At 390x844 its top edge does not move between the empty, thinking and full states. It never starts mid-screen or ends above the footer, and its message box is always in view.
> - **Felt response.** Every button, link, row and switch answers a press within 150 ms. No button changes width while working. Nothing lifts or shrinks unless pressing it does something. A navigation that takes over 300 ms shows progress.
> - **A real front door.** Logged out, the first screen offers `Add your shop` and `Log in`. A stranger can create an account, add a shop, and open it on another browser. There is no demo login, and the example shop appears at most three times on the landing page.
> - **No slide screens.** On working screens the H1 names the screen at 24 px, and there is at most one black button. No grey box holds only a heading and buttons. A signed-in seller always has navigation. The landing page has at most four parts.
> - **Proper placing.** On the shop page at least two complete item photos show on a phone's first screen and one complete row on desktop. No hole is left by a lone last item on a phone. Seller lists share one row system. No text wraps alone onto its own line at 390 px.
> - **Honest claims.** The sandbox sentence is on every seller and buyer screen. No pricing or future-promise claim appears unless the owner has confirmed it.

## Cut list

Drop in this order if behind:
1. Should-haves not started, last first: S6, S5, S4, S3, S2, S1. If S1 does not ship, Privacy, FAQ and `/help` must not promise self-serve deletion.
2. WP9, if under 1.5 h remains.
3. FAQ.
4. Settings two-column layout.
5. Tabs-row compact CTA (keep the hero CTA).
6. `keepPlace`.

**Never cut:** press system, Button states, unified Copy, Switch fixes, route progress; viewport-anchored dock and sheets, body reservation, fixed sheet height, keyboard, Back and focus handling, footer controls; tiles, container grid, first screen, tile-to-draft; shell, `PageHeader`, type roles, Live, Share rows; accounts, sessions, sign-up, login, logout, recovery key, `getOwnedShop`, rate limits, Origin check, payee password check, `/shops`, `/shops/new`, header, footer, hero, Terms, Privacy, 404, error pages, test-mode line.

**Out of scope, do not build:** cart and checkout, item sheet, quick add, shared demo account and one-click login, attach flow, reauth sheet, device list, change-email, `TestModeTag`, `PhotoTips`, landing chapters, ink band, closing photo band, Next Steps checklist and progress counts, `next_steps` column and API, shop popovers, `viewportFit`, `ViewTransition`, sliding tabs, panel entrances, count bump, `iconEnd` nudge, tap sounds, "live" chime, header sound toggle, `Play it`, desktop orphan spans, `Latest` pill, `Continue your order`, Settings `Shop details`, `s/[slug]/loading.tsx`.

## Needs from human

1. Approve the Rubric additions above and paste them into `docs/JUDGING.md`, or say to drop them.
2. Confirm the cart stays out of this submission.
3. Confirm "silent" meant no felt response. Literal click sounds are not in this scope.
4. Five minutes on a real iPhone and Android phone: press feel, sheet with keyboard (composer above it), log scroll, Back, tab bar clears the home indicator, chime versus the silent switch, and whether the vibrate patterns are perceptible. iOS is unverified throughout this brief.
5. Review `/terms` and `/privacy`, which are templates and not legal advice. Supply the legal entity, governing law and a `SUPPORT_EMAIL`. Until then Help points at GitHub Issues.
6. Confirm any pricing or "stays when real payments start" claim, or it stays off the site.
7. Finish the existing `docs/PROGRESS.md` checklist before 12 Nov, 12:00 PT: make the repo public, fill SUBMISSION, upload the video (the re-rendered one if WP9 ran).
8. If you submit a hosted URL, run `npm run seed` in Render's Shell and keep the printed owner link private. Judges use sign-up there.