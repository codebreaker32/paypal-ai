# Shelfie design system: "Storefront"

The tokens live in `src/app/globals.css`, the components in `src/components/ui`. Storefront won directions round 2 (`docs/judge/directions-2.md`). This file replaces the retired "Menu board" system (cream paper, serif display, mustard buttons, receipt slips).

## Rationale

A small seller's shop should look like their store on Toast or Square: a white page, their own photos, near-black type and one quiet accent. Food photos supply the colour, so the interface stays neutral and gets out of their way:
- **White page, near-black ink.** No cream, no paper texture.
- **One pomegranate accent**, used only for the logo, the active tab and filter, counts and the odd price emphasis. It never fills a button.
- **Black pill primary buttons** (like Toast's Pickup toggle). PayPal's own blue is used only on "Approve $X on PayPal".
- **Status is a dot and a word** ("● Paid") in lists, not a boxed chip.
- **Sections are separated by space and rules**, not outlined boxes. A raised card (soft shadow) is kept for things that really are cards: menu items and the order list's grouped rows.
- **One sans family, Figtree**, for everything, including prices (tabular figures, never monospace).

Banned (rubric Part C): cream or beige backgrounds, serif display headlines, mustard or orange primaries, a hairline box around everything, dotted leaders, monospace prices, highlighter stripes, zig-zag receipt edges, a grey explanatory sentence under every element, an icon on every label, boxed status chips everywhere, walls of identical cards, and the stock tag logo.

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
| `surface-sunken` | grey-50 | `#f4f5f7` | Wells: the AI brief, the receipt summary, the console's activity and approval panels, starter prompts, secondary buttons |
| `line` | grey-100 | `#eceef1` | Rules and dividers |
| `line-strong` | grey-300 | `#d4d6dc` | Scrollbars, strong dividers |
| `control` | grey-500 | `#8a8f98` | Input borders (3.25:1, a non-text UI contrast) |
| `ink` | ink-900 | `#111214` | Text, primary button fill, focus ring |
| `ink-soft` | ink-700 | `#3d4148` | Body copy on a white page |
| `ink-muted` | ink-600 | `#5e636c` | Meta text |
| `ink-faint` | ink-400 | `#a3a7ae` | Decoration only (2.41:1, never text) |
| `accent`, `accent-ink` | pom-600 | `#c21a4b` | Logo, active tab, tab counts, selected filter count |
| `accent-hover` / `accent-active` | pom-700 / pom-800 | `#a3153f` / `#861235` | |
| `accent-soft`, `selection` | pom-50 / pom-100 | `#fdeaf0` / `#f9d3df` | Text selection |
| `ok` / `ok-soft` | green-700 / green-50 | `#1e7a45` / `#e4f3ea` | Paid, live |
| `warn` / `warn-soft` | amber-800 / amber-50 | `#9a4a00` / `#fff0de` | Waiting, a brief's warning, the "Can't reach PayPal" banner |
| `danger` / `danger-soft` | red-700 / red-50 | `#b42318` / `#fde8e6` | Refused, failed |
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
| warn on white | 6.26:1 |
| warn on warn-soft | 5.60:1 |
| danger on white | 6.57:1 |
| danger on danger-soft | 5.59:1 |
| info on white | 7.03:1 |
| the tile inks on their tints | 6.99 to 8.30:1 |

A dimmed fallback tile (a cancelled or expired order) switches to ink-muted on surface-sunken (5.54:1) instead of fading with opacity.

### Type

**Figtree** (variable, 400 to 800) comes from `next/font` in `layout.tsx` and is used for both display and UI. The scale is a major third from 16 px: 13, 14, 16, 18, 20, 24, 30, 40, 52 and 68 px.

| Role utility | Size and weight | Use |
|---|---|---|
| `type-hero` | 40 / 68 px, 800, −0.03em | Start headline, shop name |
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
- **Motion:** 90, 140, 220 and 360 ms with ease-out. Rows and toasts rise in. All of it stops under `prefers-reduced-motion`.

## Components (`src/components/ui`)

| Component | Notes |
|---|---|
| `Button`, `ButtonLink`, `buttonClasses()` | Pills. `primary` is a near-black fill with white text; `secondary` is a grey fill; `ghost` has no fill; `paypal` is PayPal blue, only for "Approve $X on PayPal". 44 px (`md`) and 52 px (`lg`). One primary per screen. `loading` shows a spinner and sets `aria-busy`. |
| `Card` | `raised`: white with `shadow-sm`, no border. `sunken`/`flat`: a grey well. Use it for menu items, grouped order rows and wells. Page sections are not cards: separate them with `border-t border-line` and space. Don't nest cards. |
| `Badge` | A soft pill with no outline. Use it sparingly, for one-off facts ("Sent to PayPal", "Allergy"). Never use it for order status in lists. |
| `Tabs` | WAI-ARIA tabs with an ink underline under the active tab and a pomegranate count pill. |
| `Field`, `TextInput`, `TextArea`, `FieldError` | 48 px controls with 16 px text and `control` borders. Errors are inline and name the fix. |
| `Sheet` | Native `<dialog>`: a bottom sheet on phones and a centred dialog from 640 px. It is used for the phone buyer console. |
| `ToastProvider`, `useToast()` | An ink toast in a polite live region, which never takes focus. |
| `Skeleton` | Shaped like the content it replaces, with a shimmer. |
| `Icon` | Lucide, 16/20/24 px, stroke 1.75. Use icons on actions, not on every label. |

Order status (`dashboard/status.tsx`): `OrderStatusText` is a coloured dot and the word, and it is the default everywhere. `OrderStatusBadge` remains for compatibility.

## The photo and its fallback (`shop/ItemPhoto.tsx`)

Item photos are 4:3 crops with the `photo` radius. Thumbnails use `thumb` (10 px). A crop the seller keeps from "Snap your counter" is their photo.

**No letters stand in for a picture, anywhere.** An item without a photo shows a Shelfie drawing of what it is, on its section's tint (rose, sage, sky, lilac, cycling by menu section), so a menu with no photos still reads as a deliberate, colour-coded grid of pictures. Sold-out and cancelled tiles keep the drawing, grey and at half opacity, on `surface-sunken`.

### The illustrations (`illustrations/ItemIllustration.tsx`, `public/illustrations.svg`)

- **Twelve drawings**, one per item category (`src/lib/domain/category.ts`): bread (a scored loaf), pastry (a croissant on a plate), cake (a frosted cake on a stand), coffee (a takeaway cup), tea (a teapot), taco, burrito (half in foil), drink (a glass with a straw and lime), dessert (a cone), bike_part (a bicycle), tool (a wrench crossed with a screwdriver) and goods (a shopping bag). Contact sheet: `docs/judge/evidence/illustrations.png`.
- **Style:** rounded geometric shapes, one ink outline (2.75 units on a 96 x 72 viewBox, round caps and joins), two or three flat fills from the illustration palette (`--ill-*`), and exactly one pomegranate detail (the loaf's scores like the logo's, the plate's rim, the cherry, the cup's sticker, the teapot's knob, the tomatoes, the salsa, the straw, the saddle, the screwdriver's handle, the bag's sticker). Most sit on a short ink shelf line. They read at 44 px and at 224 px.
- **Category:** Claude picks one per item when it reads the menu (`category` in the extraction schema). Rows without one (older shops, a hand-added item) fall back to `guessCategory`, keyword rules on the name, then the description, then the section; an unmatched item is `tool` in a services shop, else `goods`.
- **Cost:** each drawing is a `<symbol>` in one static sheet; a tile is `<svg><use href="/illustrations.svg#bread"/></svg>`, so the paths are downloaded once and cached and never repeated in a page's HTML. The comment in that file must never contain a double hyphen (invalid XML blanks every drawing).
- **Never a product image for agents:** `image_url` in `list_products` and `image` in the JSON-LD stay the seller's real photos; an item without one has no image there.

### The shop's picture (`shop/ShopAvatar.tsx`)

The shop's logo (a square upload), else its cover cropped square, else the first photo of its menu, else the drawing of the category it sells most (`shopAvatar`, ties to the earliest item). With a cover, it sits over the cover's bottom edge with a white ring, in its own stacking layer so the first menu card never covers it. Without one, it sits beside the name.

## Screens

- **Shop page:** a rounded cover with the avatar, the name in `type-hero`, a meta line ("Food · Pickup or shipping · **Paid with PayPal**") and underline section tabs.
  - On desktop, items are 2-column horizontal cards with the photo on the right and a sticky assistant panel. On phones, items are thumbnail rows with a sticky black bar: "Order with an assistant · PayPal".
  - The agent door sits behind one "Connect your own assistant" disclosure at the foot (`#agent-door` opens it).
- **Buyer console:**
  - The empty state is a one-sentence greeting and starter prompts as tinted pills.
  - The Activity panel and the approval card are grey wells, not outlined boxes.
- **Dashboard shell:**
  - The shop's picture (`ShopAvatar`), its name in `type-display`, the live state as a dot and a word, "View your shop", and the pause switch on the right.
  - Then the tabs: Orders · Menu · Share · Settings.
  - Orders has a segmented filter (44 px) and groups (To prepare, Waiting for payment, collapsible, and Done), each with its subtotal.
- **Order rows:** a thumbnail, the number with the buyer, "via …", the items and the brief line, and the total with its time underneath in a column of their own (the time is never truncated). Then the status dot and word, and one action when the order is paid. On phones the buyer's name gives way last.
- **Order detail:**
  - On desktop, a master list on the left: rows on white with a rule on their right, and the open order on grey.
  - The header shows the number, the status dot and word, who placed it and the big total.
  - Left column: the AI brief as the one grey well, then Items and What happened. Right column: the action (hand over, add tracking, the explanation), Buyer and PayPal.
  - Sections are divided by rules on the white page. Copy is trimmed to one line where a seller would otherwise be stuck.
- **Receipt `/o/[ref]`:** the state (an icon in a soft circle, a `type-display` title, one paragraph and the actions), beside a grey summary panel. The panel shows the shop, the order number with a status dot and word, the lines and total, and who was paid. There is no stamp and no paper edge.

## Rules

- One primary (black) action per screen; PayPal blue only to approve a payment.
- Status always pairs colour with a word, never colour alone.
- At most one line of help, and only where a seller would otherwise be stuck.
- 44 px targets; inputs use 16 px text; no horizontal page scroll at 390 px; alt text on every meaningful photo, `alt=""` on decorative copies.
- No raw values in components. Add a token here and in `globals.css` first.
