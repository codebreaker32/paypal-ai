# Shelfie design system: "Storefront"

The tokens live in `src/app/globals.css`, the primitives in `src/components/ui` (shadcn-based, lowercase files) and the motion primitives in `src/components/motion`. Storefront won directions round 2 (`docs/judge/directions-2.md`). This file replaces the retired "Menu board" system (cream paper, serif display, mustard buttons, receipt slips).

## Rationale

A small seller's shop should look like their store on Toast or Square: a white page, their own photos, near-black type and one quiet accent. Food photos supply the colour, so the interface stays neutral and gets out of their way:
- **White page, near-black ink.** No cream, no paper texture.
- **One pomegranate accent**, used only for the logo, the active tab and filter, counts and the odd price emphasis. It never fills a button and never signals an error or a negative state: errors have their own vermilion, and "Sold out today" is ink.
- **Black pill primary buttons** (like Toast's Pickup toggle). PayPal's own blue is used only on "Approve $X on PayPal".
- **Status is a dot and a word** ("● Paid") in lists, not a boxed chip.
- **Sections are separated by space and rules**, not outlined boxes. A raised card (soft shadow) is kept for things that really are cards: menu items and the order list's grouped rows.
- **One sans family, Figtree**, for everything, including prices (tabular figures, never monospace).

Banned (rubric Part C): cream or beige backgrounds, serif display headlines, mustard or orange primaries, a hairline box around everything, dotted leaders, monospace prices, highlighter stripes, zig-zag receipt edges, a grey explanatory sentence under every element, an icon on every label, boxed status chips everywhere, walls of identical cards, and the stock tag logo.

## Logo

The "Awning" logo (concept B1 of the logo round, `docs/judge/logo-round.md`, refined once; final files and sheet in `docs/judge/logo/final/`, drawn by `docs/judge/logo/tools-B/build.mjs final`, which also writes the app's `src/components/brand/logo-paths.ts`).

- **Mark:** a pomegranate scalloped shop awning (three equal scallops) over a closed ink instant print, on a 64-unit grid (art 4..60). The print's deep chin (12 units, three times its 4-unit sides and top) is the shop counter, its window the shopfront: one snapshot becomes a shop. A paper gap separates awning and print, so the one-colour mark still reads.
- **Wordmark:** lowercase "shelfie" drawn as paths (geometric, 23-unit strokes on a 100-unit x-height). Its one custom detail: the f's crossbar runs on over the i as a short shelf, and a small pomegranate print stands above it as the i's dot.
- **Lockup:** the mark (190 units tall, sitting 18 units below the baseline) then the wordmark, 60 units apart. In the app: `Logo` (lockup, `size` sm 24 px / md 28 px tall) and `LogoMark` in `brand/Logo.tsx`; files in `public/brand/` (`mark`, `wordmark`, `lockup`, each also `-mono` in `currentColor`; `mark-reverse` and `lockup-reverse` for dark grounds).
- **Clear space:** at least one scallop's height (the awning's 9.3 units, about a sixth of the mark) on every side; no other element inside it.
- **Minimum sizes:** the mark 16 px (the favicon, `src/app/icon.svg`); the lockup about 80 px wide (18 px tall). Below that use the mark alone.
- **Colour versions:** full colour (pomegranate awning and i-dot, ink `#141414` print and letters) on white; one-colour ink; reversed on dark (ink parts white, awning stays pomegranate); one-colour white on pomegranate or on a photo. The favicon turns its ink white under `prefers-color-scheme: dark`.
- **Where it appears:** the site header, the counter card, the buyer console (the mark is the assistant's avatar), the Open Graph image (`src/app/opengraph-image.png`, `scripts/make-og-image.mjs`), the PWA icons (`scripts/make-icons.ts`, on white), the README and the video's end card.
- **Don'ts:** no tile or badge behind it (only app icons get their white tile); don't recolour the awning (it is pomegranate, or the one colour of a one-colour version); don't stretch, rotate, outline, shadow or add any effect; don't rebuild the lockup with "shelfie" set in Figtree instead of the drawn wordmark; no robot or other stock icon standing for Shelfie.

## Tokens

The tokens come in three layers, and components only use the second and third:
1. **Primitives** (`:root`): raw hex values.
2. **Semantic** (`@theme`): Tailwind utilities such as `bg-surface`, `text-ink-muted` and `bg-accent`. The palette is closed (`--color-*: initial`), so Tailwind's default colours don't exist.
3. **Component** (`:root`): per-component tokens such as `--button-primary-bg`, `--card-shadow` and `--thumb-radius`.

### Colour

| Semantic | Primitive | Hex | Use |
|---|---|---|---|
| `surface`, `surface-raised` | white | `#ffffff` | Page and cards |
| `surface-subtle` | grey-25 | `#fafafb` | Row hover |
| `surface-sunken` | grey-50 | `#f4f5f7` | Wells: the receipt summary, the console's activity and approval panels, starter prompts, secondary buttons |
| `line` | grey-100 | `#eceef1` | Rules and dividers |
| `line-strong` | grey-300 | `#d4d6dc` | Scrollbars, strong dividers |
| `control` | grey-500 | `#8a8f98` | Input borders (3.25:1, a non-text UI contrast) |
| `ink` | ink-900 | `#111214` | Text, primary button fill, focus ring |
| `ink-soft` | ink-700 | `#3d4148` | Body copy on a white page |
| `ink-muted` | ink-600 | `#5e636c` | Meta text |
| `ink-faint` | ink-400 | `#a3a7ae` | Decoration only (2.41:1, never text) |
| `accent`, `accent-ink` | pom-600 | `#c21a4b` | Logo, active tab and filter, counts, price emphasis, and one deliberate echo of the logo: the scan line that sweeps the menu photo while it is read (`setup/ReadingStep.tsx`, the viewfinder at work; white would vanish on white paper and ink on a dark board). Never an error, a failed state or "Sold out" |
| `accent-hover` / `accent-active` | pom-700 / pom-800 | `#a3153f` / `#861235` | |
| `accent-soft`, `selection` | pom-50 / pom-100 | `#fdeaf0` / `#f9d3df` | Text selection |
| `ok` / `ok-soft` | green-700 / green-50 | `#1e7a45` / `#e4f3ea` | Paid, live |
| `warn` / `warn-soft` | ochre-800 / ochre-50 | `#7a5a00` / `#fbf1d5` | Waiting, a brief's warning, the "Can't reach PayPal" banner. A deep ochre (hue 84°), so it never reads as `error` at 14 px |
| `error` / `error-soft` | vermilion-700 / vermilion-50 | `#b5380c` / `#fdebe5` | Error messages, invalid fields, refused and failed states. `danger` / `danger-soft` are older names for the same values |
| `note` / `note-soft` / `note-ink` | slate-600 / slate-50 / ink-900 | `#475569` / `#eef2f6` / `#111214` | Helpful notes: the AI brief's well (`Card tone="note"`), its "AI brief" label, the allergy chip (`Badge tone="note"`). Calm help, not a warning: a cool tint and ink text |
| `info` / `info-soft` | blue-700 / blue-50 | `#2457a6` / `#e7eefa` | Shipped, picked up |
| `paypal` (hover, active) | paypal-500 (700, 900) | `#0070ba` (`#005ea6`, `#003087`) | The PayPal approve button only |
| `tile-rose`, `-sage`, `-sky`, `-lilac` | | `#fce7ee`/`#8e1a43`, `#e3f1e8`/`#1f5a37`, `#e5eefa`/`#1e4c8a`, `#eee9fb`/`#4b3091` | The photo fallback, one tint per menu section |
| `--ill-ink`, `--ill-dough`, `--ill-wheat`, `--ill-cocoa`, `--ill-leaf`, `--ill-steel`, `--ill-pom` | | `#1d1a1c`, `#fff4e0`, `#f2bd62`, `#8a5638`, `#86bd78`, `#c4ced8`, `var(--pom-600)` | The illustration palette: read only by `public/illustrations.svg` (no Tailwind utility) |

**Contrast** (WCAG 2.1, computed from the hex values):

| Pair | Ratio |
|---|---|
| ink on white | 18.74:1 |
| ink-soft on white | 10.25:1 |
| ink-muted on white | 6.04:1 |
| ink-muted on surface-sunken | 5.54:1 |
| pom-600 on white, white on pom-600 | 5.93:1 |
| white on PayPal blue | 5.22:1 |
| ok on white | 5.35:1 |
| ok on ok-soft | 4.66:1 |
| warn on white | 6.38:1 |
| warn on warn-soft | 5.67:1 |
| warn on surface-sunken | 5.81:1 |
| error on white, white on error | 5.94:1 |
| error on error-soft | 5.14:1 |
| error on surface-sunken | 5.44:1 |
| note on white | 7.58:1 |
| note on note-soft | 6.74:1 |
| note-ink on note-soft | 16.66:1 |
| ink-soft on note-soft | 9.11:1 |
| ink-muted on note-soft | 5.37:1 |
| info on note-soft | 6.25:1 |
| error-soft on ink (the toast's error icon) | 16.24:1 |
| info on white | 7.03:1 |
| the tile inks on their tints | 6.99 to 8.30:1 |

A dimmed fallback tile (sold out, a cancelled or expired order) switches to surface-sunken and shows its drawing in greyscale at half opacity. The drawing is decorative (the item's name labels the tile), so it carries no text contrast requirement.

**Error against the brand.** Pomegranate is a blue-leaning crimson (OKLCH hue 12°); the error vermilion leans orange (hue 37°, the old `#b42318` was 30°), so an error never reads as the brand. `warn` is a deep ochre (hue 84°, chroma 0.10), 47° away from the error and much less saturated, so "PayPal refused payment" and "Waiting for approval" read as different states even at 14 px in a status list (the earlier amber `#9a4a00`, hue 53°, sat too close). Status always pairs the colour with a word.

**shadcn names.** `components.json` points shadcn at these tokens. Its semantic names are mapped in `@theme` onto our roles, never onto primitives, so repointing a role carries its aliases: `background` = surface, `card`, `popover` = surface-raised; `foreground`, `*-foreground` = ink (surface on `primary` and `destructive`, on-accent on `accent`); `primary` = ink (the black pill); `secondary`, `muted` = surface-sunken; `muted-foreground` = ink-muted; `destructive` = error; `border` = line; `input` = control; `ring` = focus. `danger` is likewise `var(--color-error)`. `accent` keeps Shelfie's meaning (pomegranate): a shadcn component that uses `bg-accent` as a hover fill must be changed to `bg-muted` when it is added. No shadcn palette or oklch variables are imported, and the palette stays closed.

### Type

**Figtree** (variable, 400 to 800) comes from `next/font` in `layout.tsx` and is used for both display and UI. The scale is a major third from 16 px: 13, 14, 16, 18, 20, 24, 30, 40, 52 and 68 px.

| Role utility | Size and weight | Use |
|---|---|---|
| `type-hero` | 40 / 68 px, 800, −0.03em | Start headline |
| `type-display` | 30 / 40 px, 800, −0.03em | Page titles (Order SHF-…, receipt state) |
| `type-title` | 20 / 24 px, 800 | Empty-state titles |
| `type-heading` | 18 px, 700 | Section headings |
| `type-kicker` | 20 px, 800 | Menu section names |
| `type-lead`, `type-body` | 18 px, 16 px | Copy |
| `type-label` | 14 px, 600 | Field and group labels |
| `type-meta` | 13 px | Times and meta |
| `type-price`, `type-figures`, `type-receipt` | Tabular, lining figures | Money and order numbers |

`html` sets `text-rendering: geometricPrecision`. Linux and Windows Chrome hint Figtree's advances to whole pixels at 1×, which opens gaps after f, t and T ("shelf ie", "bef ore", "nut s"). Geometric precision turns hinting off.

The mono stack (system mono, no webfont) is only for code: the agent door address, setup snippets and PayPal IDs. It is never used for prices.

### Space, radius, elevation, motion

- **Space:** a 4 px base; `tap` is 44 px; `gutter` is `clamp(20px, 4vw, 48px)`; `section` is `clamp(48px, 8vw, 96px)`.
- **Containers:** `page` is 76rem (the start page, shop, receipt, setup). `wide` is 88rem (the dashboard and order detail). The header and footer follow the page below them (`brand/Frame.tsx`), so the logo lines up with the content. `measure` is 36rem, for prose.
- **Radius:** xs 6, sm 8, md 10 (thumbnails, fields), lg 14 (cards, photos), xl 20 (cover, starter prompts), 2xl 28 (sheet), full (buttons, filters).
- **Elevation:** shadows are ink-tinted, each an offset plus a soft blur. `shadow-sm` (cards) has a 5 % ink ring, so it reads as a lift, not an outline. Use it only on true cards, never on page sections.
- **Motion:** 90, 140, 220 and 360 ms with ease-out (`--ease-out`, `MOTION_S` and `EASE_OUT` in `src/components/motion/tokens.ts`). Only transform and opacity move. Under `prefers-reduced-motion` nothing moves: CSS animations stop, `MotionConfig reducedMotion="user"` drops transforms (fades stay), and totals and statuses show their final value at once.

## Components (`src/components/ui`)

Re-based on shadcn (new-york): `cva` recipes (`buttonVariants`, `badgeVariants`, `cardVariants`), `data-slot` attributes, and `cn()` from `@/lib/utils` (clsx + tailwind-merge, so a caller's class wins over the default; `cx` is an alias). Files are lowercase (`@/components/ui/button`); never add a second file that differs only by case.


| Component | Notes |
|---|---|
| `Button`, `ButtonLink`, `buttonClasses()` | Pills. `primary` is a near-black fill with white text; `secondary` is a grey fill; `ghost` has no fill; `paypal` is PayPal blue, only for "Approve $X on PayPal". 44 px (`md`) and 52 px (`lg`). One primary per screen. `loading` shows a spinner and sets `aria-busy`. |
| `Card` | `raised`: white with `shadow-sm`, no border. `sunken`/`flat`: a grey well. `note`: the slate note well (the AI brief). Use it for menu items, grouped order rows and wells. Page sections are not cards: separate them with `border-t border-line` and space. Don't nest cards. |
| `Badge` | A soft pill with no outline. Tones: neutral, accent, ok, warn, error (`danger`), info, note. Use it sparingly, for one-off facts ("Sent to PayPal", "Allergy"). Never use it for order status in lists. |
| `Tabs` | WAI-ARIA tabs with an ink underline under the active tab and a pomegranate count pill. |
| `Field`, `TextInput`, `TextArea`, `FieldError` | 48 px controls with 16 px text and `control` borders. Errors are inline, in `error`, and name the fix. `TextInput`/`TextArea` are shadcn's `Input` (`input.tsx`) and `Textarea` (`textarea.tsx`); the label is `Label` (`label.tsx`). |
| `Sheet` | Native `<dialog>`: a bottom sheet on phones and a centred dialog from 640 px, entering and leaving by CSS (`ui/sheet.css`: rise on phones; 8 px rise and fade when centred). `bare` drops its box and header for a surface that draws its own (`labelledBy` names it, `initialFocusRef` and `fallbackFocusRef` steer focus): the buyer console. |
| `ToastProvider`, `useToast()` | An ink toast in a polite live region, which never takes focus. 28rem wide from `sm` up, so "New paid order SHF-XXXXXX · $27.00" fits one line; the dashboard scrolls a just-paid row clear of it. |
| `Panel`, `PanelList`, `PanelRow`, `LinkRow` (`panel.tsx`) | The one row system for working screens: a `type-section` heading with an optional count and a right-aligned value, above a white raised list of `li` rows (`--row-pad-x`, `--row-pad-y`, `--row-min-h`). The list is a size container: a row's action sits beside its text from `@xl` (36rem of list width) and drops under it when narrower. `LinkRow` is a whole row that links somewhere. |
| `Skeleton` | Shaped like the content it replaces, with a shimmer. |
| `Icon` | Lucide, 16/20/24 px, stroke 1.75. Use icons on actions, not on every label. |

`Sheet` stays a native `<dialog>` (shadcn's Radix sheet would lose the phone bottom sheet and the native focus return), and the toast stays ours: sonner's region is a focusable list with a hotkey, ours is a polite `role="status"` that never takes focus.

## Motion (`src/components/motion`)

`MotionProvider` (root layout) is `LazyMotion` (`domAnimation`, loaded by a dynamic import after first paint, retried once; if both tries fail, `<html data-motion-off>` makes everything the primitives were hiding visible, and any other `m.*` with an entrance carries `data-entrance` so it shows too) in `strict` mode, plus `MotionConfig reducedMotion="user"`. Inside it, use `m.div` from `motion/react`, never `motion.div` (strict mode throws). Server HTML is never hidden: content visible at hydration stays put; only content below the fold, or mounted later on the client, plays an entrance.

| Component | Props | Does |
|---|---|---|
| `Reveal` | `as?`, `delay?` (s), `y?` (16 px), `once?` (true), `className`, `children` | Fades and rises in when scrolled into view (360 ms). One block per screen, not every section. |
| `Stagger`, `StaggerItem` | `as?`, `gap?` (0.04 s), `className`; item: `as?`, `y?` (8 px) | A list whose items rise in one after another (220 ms each, the whole list within 400 ms). An item added after the list has shown (a new order) rises in on its own. |
| `Pressable` | `as?` (any element or component), `lift?` (true), `className`, `...rest` | CSS only, server-safe: −2 px hover lift with `shadow-md` fading in on a pseudo-element, and the `press-surface` press (0.985 and a sunken fill, set from `data-pressed`). For real controls and navigating rows only. Don't put `overflow-hidden` on it (that clips the shadow); clip the photo inside. |
| `CountUp` | `cents`, `format?` (formatUSD; client callers only), `className` | Counts from the previous value to the new one (360 ms), set up before paint so the new total never flashes first. The final text is always the accessible text (the running count is an aria-hidden overlay). It is `aria-live="off"`, so it never announces: a total inside a live region (a cart, a status line) needs its own announcement of the final value. The overlay and the final text share one inline grid cell, so a change in digit count ($9.99 to $10.00) resizes it; keep it where a few pixels of width can move (end of a line, right-aligned column). |
| `StatusSwap` | `value`, `className`, `children` | `AnimatePresence mode="popLayout"` crossfade with a 4 px rise when `value` changes; the leaving copy is aria-hidden. |

**Press.** Every control answers a touch or click, and `tests/ui/press-coverage.test.ts` fails if one doesn't. Use a primitive (`Button`, `ButtonLink`, `IconButton`, `TextLink`, `Pressable`) or put one utility on a raw element, in place of a `transition-*` class: `press` (buttons, chips, segments, file pickers), `press-icon` (icon-only), `press-text` (text links, tabs, `summary`), `press-surface` (rows and cards, driven only by `data-pressed` so inner controls don't move them). `Tactile` (`components/motion/tactile.tsx`) sets `data-pressed` and `data-navigating`, with touch timing from `lib/feedback/press-machine.ts`. Pair an async button with `useAction` (`status`, `successLabel`). Never add `active:scale-*`, `active:translate-*`, or a `transition-[…transform…]` list.


Order status (`dashboard/status.tsx`): `OrderStatusText` is a coloured dot and the word, and it is the default everywhere. `OrderStatusBadge` remains for compatibility.

## The photo and its fallback (`shop/ItemPhoto.tsx`)

Item photos are 4:3 crops with the `photo` radius. Thumbnails use `thumb` (10 px). A crop the seller keeps from "Snap your counter" is their photo.

**No letters stand in for a picture, anywhere.** An item without a photo shows a Shelfie drawing of what it is, on its section's tint (rose, sage, sky, lilac, cycling by menu section), so a menu with no photos still reads as a deliberate, colour-coded grid of pictures. Sold-out and cancelled tiles keep the drawing, grey and at half opacity, on `surface-sunken`.

### The illustrations (`illustrations/ItemIllustration.tsx`, `public/illustrations.svg`)

- **Thirteen drawings**, one per item category (`src/lib/domain/category.ts`): bread (a scored loaf), pastry (a segmented croissant with curved horns), cake (a frosted cake on a stand), coffee (a takeaway cup), tea (a teapot), taco, burrito (half in foil, straight crimp lines), drink (a glass with a straw and lime), dessert (a cone), meal (a plate with a fork: any other dish), bike_part (a bicycle), tool (a wrench crossed with a screwdriver) and goods (a shopping bag). **Variants within a category**, picked from the item's name by `drawingId` (`src/lib/domain/drawing.ts`; the category stays Claude's closed choice): a pastry is a cinnamon swirl bun (bun, roll, cinnamon, cardamom), a fruit tart (tart, pie, galette, quiche, crostata) or a pain au chocolat (chocolate batons at its ends), else the croissant. Contact sheet: `docs/judge/evidence/illustrations.png`.
- **Style:** rounded geometric shapes, one ink outline (2.75 units on a 96 x 72 viewBox, round caps and joins), two or three flat fills from the illustration palette (`--ill-*`), and exactly one pomegranate detail (the loaf's scores, the croissant's drizzle, the cherry, the cup's sticker, the teapot's knob, the tomatoes, the salsa, the straw, the saddle, the screwdriver's handle, the bag's sticker, the meal's tomato). Most sit on a short ink shelf line. They read at 44 px and at 224 px.
- **Category:** Claude picks one per item when it reads the menu (`category` in the extraction schema). Rows without one (older shops, a hand-added item) fall back to `guessCategory`, keyword rules on the name, then the description, then the section; a food shop never gets `tool` or `bike_part` from a keyword; an unmatched item is `meal` in a food shop, `tool` in a services shop, else `goods`.
- **Cost:** each drawing is a `<symbol>` in one static sheet; a tile is `<svg><use href="/illustrations.svg#bread"/></svg>`, so the paths are downloaded once and cached and never repeated in a page's HTML. The comment in that file must never contain a double hyphen (invalid XML blanks every drawing).
- **Never a product image for agents:** `image_url` in `list_products` and `image` in the JSON-LD stay the seller's real photos; an item without one has no image there.

### The shop's picture (`shop/ShopAvatar.tsx`)

The shop's logo (a square upload), else its cover cropped square, else the first photo of its menu, else the drawing of the category it sells most (`shopAvatar`, ties to the earliest item). With a cover, it sits over the cover's bottom edge with a white ring, in its own stacking layer so the first menu card never covers it. Without one, it sits beside the name.

## Screens

- **Shop page:** a rounded cover (`h-32`, `sm:h-44`, `lg:h-60`) with the avatar overlapping its lower edge, the name in `type-display`, a meta line ("Food · Pickup or shipping · **Paid with PayPal**") and underline section tabs. Pickup and shipping are always visible. Under 640 px the original price list is a 32 px thumb in the avatar's row; from 640 px it sits to the right of the pickup and shipping lines; once the page is 56rem wide the about text and those lines share one row, so the first row of photos clears the fold.
  - **Menu tiles** (`shop/Menu.tsx`, `shop/menu-grid.css`): two tracks under 36rem of page width, three from 36 to 56rem, four from 56rem, by container query, because the page narrows when the assistant docks. Under 36rem a last odd tile spans the row, photo beside its text. Each tile is a 4:3 photo, then the name, the price and the description, with **no card background or shadow**: name 16/24 bold clamped to 2 lines, description 14/20 `ink-muted` clamped to 2, one or two options priced in full, three or more as `From $3.00 · 3 options`. The whole tile opens the item sheet, so every state responds to a tap. Orderable items carry a `+` in the photo's bottom-right corner (36 px white face, 44 px hit), which becomes a white `− 2 +` pill once in the order; sold out dims the photo and adds a white `Sold out today` pill, and no control shows while sold out, ask in person or not taking orders. Only the photo answers a hover (scale 1.03, transform only, never under reduced motion).
  - The sticky black bar under 1024 px: "Order with an assistant · PayPal" (`[data-order-bar]`, centred at `max-w-md` from 640).
  - **Order button from 1024 px** (`shop/OrderCta.tsx`): `HeroOrderCta` at the right end of the name row, then `CompactOrderCta` fading in at the right end of the sticky section-tabs row once the hero wrapper's IntersectionObserver says it has scrolled out. Exactly one shows; neither while docked. No floating bubble. A shop with fewer than two sections has that sticky row at `lg` only for the button: it takes no space in the page and has no surface until the button shows.
  - The agent door sits behind one "Connect your own assistant" disclosure at the foot (`#agent-door` opens it).
- **Buyer console:** one `AssistantShell` (`shop/assistant-shell.css`) attached to a viewport edge in all three forms, a bottom sheet under 640 px (12 px from the top, always the same height), a right side sheet from 640 to 1023, and a full-height dock from 1024 px that narrows the page beside it (no scrim, no scroll lock). Only the conversation scrolls; the header, and the footer with the composer, stay put. The order button is one at a time: the hero's button, then a compact one in the sticky tabs row after the hero scrolls out (only the button hands over, the `agent door` line under it stays in the page), the order bar under 1024 px, and none while docked.
  - **Measured rules** (`e2e/assistant-layout.spec.ts`, titled by the brief's acceptance numbers): the dock is `y 0` to the viewport's bottom and its right edge at every scroll, 380 to 440 px wide; `main`, `header` and `footer` stop at or left of it; the logo moves at most 8 px; the sheet is `y 12` to the bottom at 390 and exactly the same box for empty, thinking and a long reply; on-screen keyboard, the sheet is the visual viewport less 12 px.
  - **Focus and history:** modal opens on the `h2`, docked on the composer (caret at the end), a `?assistant=1` load moves nothing; any close returns to the opener; a tap opens with `pushState` and closes with `history.back()`; docked and deep-linked use `replaceState`.
  - **Scrolling:** a new message always scrolls to it, a stream follows only within 96 px of the end and never past the start of its turn, an approval card always scrolls to the end. A wheel at the log's end never moves the page, docked included.
  - **Reduced motion:** the dock, the sheet and the scrim do not transition. The global rule names `::backdrop` itself, because `*` does not match it.
  - The empty state is a one-sentence greeting and starter prompts as tinted pills, resting directly above the composer.
  - The Activity panel and the approval card are grey wells, not outlined boxes.
- **Seller shell (`components/app/AppShell`):** the chrome on every `/shops/[id]/**` screen, replacing the public header and footer.
  - From `lg`: a white 15rem sidebar with one rule on its right: logo, the shop switcher (picture, name in a two-line clamp, the state as a dot and a word), Orders · Menu · Share · Settings, `View your shop`, then the test-mode line and the account slot at the foot.
  - Below `lg`: a top bar (mark, the shop's name in a one-line ellipsis, account) and a fixed four-column tab bar. The test-mode line is the last line of content.
  - One banner slot at the top of the content, one banner at a time: PayPal unreachable, payee missing, paused, recovery key.
  - Headings are only `type-page` (24/32) and `type-section` (16/24). `PageHeader` is the one header (title, description, back, status, actions). Rows are one system: `PanelList`, `PanelRow` and `LinkRow` in `ui/panel.tsx`, where an action drops under the text when the list is narrower than 36rem.
- **Live:** rows on the left (Try your shop, with the screen's one black button, then the agent door, the shop link, the counter card) and a raised card of the actual shop on the right, with the cover or first photo at 16:9 and the first three live items. Below `xl` the card is a compact strip above the rows. The card carries the one celebratory beat (`LiveBeat`) when a shop goes live in this browser.
- **Share:** one `PanelList` of links (agent door, the one primary; shop link; Try your shop; a For developers disclosure) beside a raised Counter card with the QR. A draft has no address, so it shows one sentence and `Finish setting up`.
- **Settings:** each section is a heading on the left and its control on the right (`14rem` and a `max-w-lg` column from `lg`), divided by rules. No duplicate Pause: pausing lives on Orders and resuming in the banner.
- **Orders:** a segmented filter (44 px) and groups (To prepare, Waiting for payment, collapsible, and Done), each with its subtotal. The empty state is left-aligned: `No orders yet`, one sentence, `Watch an AI order from you` and `Share your agent door`.
- **Order rows:** a thumbnail, the number with the buyer, "via …", the items and the brief line, and the total with its time underneath in a column of their own (the time is never truncated). Then the status dot and word, and one action when the order is paid; status and action share one line. The six-column layout is a container query on the list (60rem), since the sidebar takes 15rem of the viewport. On phones the buyer's name gives way last.
- **Order detail:**
  - On desktop, a master list on the left: rows on white with a rule on their right, and the open order on grey.
  - The header shows the number, the status dot and word, who placed it and the big total.
  - Left column: the AI brief as the one slate note well (`note-soft`), then Items and What happened. Right column: the action (hand over, add tracking, the explanation), Buyer and PayPal.
  - Sections are divided by rules on the white page. Copy is trimmed to one line where a seller would otherwise be stuck.
- **Receipt `/o/[ref]`:** the state (an icon in a soft circle, a `type-display` title, one paragraph and the actions), beside a grey summary panel. The panel shows the shop, the order number with a status dot and word, the lines and total, and who was paid. There is no stamp and no paper edge.

## Rules

- One primary (black) action per screen; PayPal blue only to approve a payment.
- Status always pairs colour with a word, never colour alone.
- At most one line of help, and only where a seller would otherwise be stuck.
- 44 px targets; inputs use 16 px text; no horizontal page scroll at 390 px; alt text on every meaningful photo, `alt=""` on decorative copies.
- No raw values in components. Add a token here and in `globals.css` first.
