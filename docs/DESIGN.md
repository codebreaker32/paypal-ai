# Shelfie design system

The single reference for how Shelfie looks and behaves. Tokens live in `src/app/globals.css` and nowhere else; components in `src/components/ui` use tokens only. If a screen needs something this file doesn't cover, add the token or component here first.

## Direction: "Counter ledger"

**A tidy shop ledger that makes money and status unmistakable.** Shelfie's seller hands their price list to strangers' AI assistants and takes payment through PayPal, so the product has to feel like a tool they can trust with orders and money. The interface borrows from the bookkeeper's ledger: cool off-white sheets, hairline rules, one deep cash-green accent, a wide grotesk for headings and totals, a precise UI sans with tabular figures, monospaced order references, and status written as stamps.

Rationale in five lines:

1. **Who:** small sellers (a home bakery, a taco stand, a bike repair shop) checking orders between customers, mostly on a phone; and buyers who need to see exactly what they paid.
2. **Money first:** every amount is tabular and right-aligned; totals use the display face and the bookkeeper's double rule; order groups carry a subtotal.
3. **Status as type:** status stamps are short uppercase words with an icon and a tinted rule, so "Paid" never rests on colour alone.
4. **One accent:** cash green for the primary action and for money received. PayPal blue appears only on PayPal's own approve button.
5. **Dense where it helps:** orders are ledger rows (order | items and delivery | status | amount) on desktop; on phones the same rows stack with 44 px targets.

Anti-slop choices: no serif, no warm cream or terracotta, no gradients (except the functional skeleton shimmer), no glass, no glow, no pill shapes except the switch, no eyebrows above section headings (the uppercase `type-stamp` is for status words and ledger column heads only), no emoji. Light theme only (the use scene is a counter in daylight); the semantic layer is where a dark theme would go.

## Token layers

```
1. Primitives  :root          --sheet-50, --graphite-900, --cash-600 ...   raw values, never used in components
2. Semantic    @theme         bg-surface, text-ink, bg-accent, text-ok      Tailwind utilities
3. Component   :root          --button-primary-bg, --card-radius, --ledger-rule ...   used inside components only
```

Tailwind's default palette, type scale, radii and shadows are removed (`--color-*: initial` and so on), so `bg-zinc-100` or `text-red-500` don't exist. Re-skinning a direction means changing primitives or remapping the semantic layer.

### Colour: semantic tokens

| Utility (`bg-*`, `text-*`, `border-*`) | Primitive | Use |
|---|---|---|
| `surface` | `--sheet-50` #F4F5F2 | Page background |
| `surface-raised` | `--sheet-0` #FCFCFA | Cards, ledger panels, inputs, the header bar |
| `surface-sunken` | `--sheet-100` #EAECE7 | Wells, ledger column heads, skeleton base, neutral stamp |
| `line` | `--sheet-200` #DFE2DC | Hairline rules between ledger rows |
| `line-strong` | `--sheet-300` #D1D5CF | Card and panel borders (decorative) |
| `control` | `--sheet-500` #7C847E | Input and secondary-button borders (meets 3:1) |
| `ink` | `--graphite-900` #121916 | Body text, headings, the rule above a total |
| `ink-soft` | `--graphite-700` #3A443F | Secondary text, lead paragraphs |
| `ink-muted` | `--graphite-600` #56605A | Hints, captions, meta, column heads |
| `ink-faint` | `--graphite-400` #99A19B | Decorative only; **never text** (2.42:1) |
| `accent` | `--cash-600` #0B6B45 | Primary buttons, active tab, the logo tile, flag rules |
| `accent-hover` / `accent-active` | `--cash-700` / `--cash-800` | Pressed and hover fills |
| `accent-soft` | `--cash-50` #E3F1E8 | Accent stamp background |
| `accent-ink` | `--cash-700` #08583A | Accent-coloured text and links |
| `on-accent` | `--sheet-0` | Text on accent fills |
| `ok` / `ok-soft` | `--cash-700` / `--cash-50` | Paid, published, done: green means money is in |
| `warn` / `warn-soft` | amber #8A5300 / #FBEFD6 | Needs you, waiting, allergens, flagged menu lines |
| `danger` / `danger-soft` | brick #A3271F / #FBE6E3 | Errors, declined, failed |
| `info` / `info-soft` | slate #24476F / #E4EBF3 | Shipped, approved, neutral notices |
| `paypal` / `paypal-hover` / `paypal-active` | #0070BA / #005EA6 / #003087 | **PayPal buttons only** |
| `on-paypal` | #FFFFFF | Text on PayPal buttons |
| `focus` | `--cash-700` | Focus ring (2 px solid, 2 px offset) |
| `selection` | `--cash-100` | `::selection` |
| `scrim` | graphite at 50% | Dialog backdrop |

### Contrast (WCAG 2.1, computed from the hex values)

Text needs 4.5:1 (AA, normal text); UI boundaries and icons that carry meaning need 3:1. Every text pairing used by a component passes AA.

| Foreground / background | Ratio | Use |
|---|---|---|
| ink / surface | 16.31 | Body text |
| ink / surface-raised | 17.38 | Text in cards and ledger rows |
| ink / surface-sunken | 15.00 | Text in wells |
| ink-soft / surface | 9.23 | Lead and secondary text |
| ink-soft / surface-sunken | 8.49 | Neutral stamp |
| ink-muted / surface | 5.97 | Hints, captions |
| ink-muted / surface-raised | 6.36 | Meta in rows, header stamp |
| ink-muted / surface-sunken | 5.49 | Ledger column heads, meta in wells |
| on-accent / accent | 6.38 | Primary button |
| on-accent / accent-hover | 8.29 | Primary button, hover |
| on-accent / accent-active | 10.75 | Primary button, pressed |
| accent / surface | 5.99 | Accent icons and rules |
| accent-ink / surface | 7.78 | Links ("See a live shop") |
| accent-ink / surface-raised | 8.29 | Links in cards, the AI brief label |
| accent-ink (ok) / accent-soft (ok-soft) | 7.30 | Paid and accent stamps |
| warn / surface | 5.78 | Warning text |
| warn / surface-raised | 6.16 | Warning text in rows (nut-allergy line) |
| warn / warn-soft | 5.55 | Warning stamp |
| danger / surface | 6.69 | Inline errors |
| danger / danger-soft | 6.11 | Error stamp |
| info / surface | 8.70 | Info text |
| info / info-soft | 7.92 | Info stamp |
| on-paypal / paypal | 5.22 | PayPal button |
| on-paypal / paypal-hover | 6.66 | PayPal button, hover |
| on-paypal / paypal-active | 11.85 | PayPal button, pressed |
| toast fg (sheet) / toast bg (graphite) | 16.31 | Toasts and the buyer's chat bubbles |
| ok-soft, danger-soft, info-soft icons / ink | 15.31, 14.90, 14.86 | Toast icons |
| control / surface-raised | 3.75 | Input and secondary-button borders (non-text, 3:1) |
| control / surface | 3.52 | Dashed empty-group outline |
| focus ring (cash-700) / surface | 7.78 | Focus indicator |
| focus ring (cash-700) / surface-raised | 8.29 | Focus indicator in cards |
| ink-faint / surface | 2.42 | Decorative only |
| line-strong / surface | 1.36 | Decorative panel edge |

Disabled controls drop to 50% opacity (WCAG exempts inactive controls). A **loading** button keeps full colour: it is busy, not unavailable.

### Type

Fonts load through `next/font/google` in `src/app/layout.tsx`:

- `font-display`: **Archivo** (variable, `wdth` axis), set semi-expanded (`--display-stretch: 112.5%`), weight 650 to 700. Headings, the wordmark and totals.
- `font-sans`: **IBM Plex Sans** (variable). Everything else. The default on `<html>`. Real tabular figures.
- `font-mono`: **IBM Plex Mono** 400/500/600. Order numbers, PayPal ids, tracking numbers, links to copy, the text "we read" from the photo.

Scale: 2 px steps up to 20 px, then roughly a minor third. The smallest running text is 13 px; 12 px is used only for uppercase stamps.

| Utility | Size / line height | Use |
|---|---|---|
| `text-2xs` | 12 / 16 | Uppercase stamps and column heads only |
| `text-xs` | 13 / 18 | Meta, captions |
| `text-sm` | 14 / 20 | Secondary UI text, chat bubbles |
| `text-base` | 16 / 24 | Body (and every input, so iOS doesn't zoom) |
| `text-lg` | 18 / 26 | Lead paragraphs, row amounts, card headings |
| `text-xl` | 20 / 28 | Totals in cards |
| `text-2xl` | 24 / 30 | Section titles (phone), receipt total |
| `text-3xl` | 28 / 34 | Section titles (desktop), order total |
| `text-4xl` | 34 / 40 | Page title (phone) |
| `text-5xl` | 44 / 48 | Page title (desktop) |
| `text-6xl` | 56 / 60 | Reserved |

Type roles (use these rather than assembling size, weight and family by hand):

| Role | What it sets |
|---|---|
| `type-display` | Archivo 700 semi-expanded, 34 px (44 px from 1024 px), tracking -0.03em. One per page: the `h1`. |
| `type-title` | Archivo 700 semi-expanded, 24 px (28 px from 1024 px). Section headings, the dashboard's shop name. |
| `type-heading` | Archivo 650 semi-expanded, 18 px. Card titles, ledger group headings. |
| `type-lead` | 18 / 26. The paragraph under a page title. |
| `type-body` | 16 / 24. |
| `type-label` | 14 / 20, weight 600. Field labels, the word "Total". |
| `type-meta` | 13 / 18. Hints, captions, timestamps. |
| `type-stamp` | 12 / 16, weight 600, uppercase, tracking 0.06em. Status stamps and ledger column heads. Never above a section heading. |
| `type-price` | Tabular, lining numerals. Every price in running text and lists. |
| `type-amount` | Archivo 700, tabular. Row amounts, group subtotals and totals. |
| `type-ref` | Plex Mono 500, slashed zero. Order numbers and PayPal ids. |
| `rule-total` | A 3 px double rule under a grand total (the bookkeeper's mark). |
| `font-soft` | Sets the display width (kept so older call sites still render semi-expanded). |

Line length: running text sits in `max-w-measure` (36 rem, about 65 characters at 16 px). Headings use `text-wrap: balance`, paragraphs `text-wrap: pretty`.

### Spacing, layout, radius, elevation

- **Spacing:** a strict 4 px grid (`p-1` = 4 px). Use 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12. Named rhythm tokens: `tap` (44 px, minimum touch target: `min-h-tap`, `size-tap`), `gutter` (page side padding, 16 px to 48 px fluid: `px-gutter`), `section` (40 px to 80 px fluid: `pb-section`).
- **Containers:** `max-w-page` (76 rem) for page content, `max-w-measure` (36 rem) for prose.
- **Ledger grid (desktop):** `LEDGER_COLUMNS` in `src/components/dashboard/OrderCard.tsx`: 13 rem order, flexible items and delivery, 13 rem status, 7 rem amount, 24 px gaps. The column head and every row share it. Below 1024 px a row is two columns (reference, amount) with the stamp and detail stacked beneath.
- **Breakpoints:** Tailwind defaults. Design at 390 px first, then `sm` 640, `lg` 1024 and check 1440.
- **Radius (one rule, used everywhere):** `xs` 2 (stamps, counts), `sm` 4 (logo tile, step markers, avatar tiles), `md` 6 (buttons, inputs, wells), `lg` 8 (cards, ledger panels), `xl` 12 (sheets), `full` (the switch track only).
- **Elevation:** flat by default; rules do the work. `shadow-xs` (a 1 px under-rule on cards), `shadow-sm`, `shadow-md` (floating cards: the console's approval card, toasts, the start-page payment note), `shadow-lg` (sheets, the hero photo). Graphite-tinted, never black, never a glow.
- **Layers:** `--z-header` 20, `--z-sheet` 50, `--z-toast` 60 (`z-(--z-toast)`).
- **Header:** `--header-h` 56 px on `surface-raised` with a `line-strong` rule; the logo is a cash-green tag tile beside the wordmark, and a `PAYPAL SANDBOX` stamp sits on the right from 640 px.

### Motion

| Token | Value | Use |
|---|---|---|
| `--duration-instant` | 80 ms | Press feedback |
| `--duration-fast` | 120 ms | Colour and border changes (the default transition) |
| `--duration-base` | 180 ms | Fades, small moves, the group chevron |
| `--duration-slow` | 280 ms | Entrances (`animate-rise-in`) |
| `ease-out` | cubic-bezier(0.2, 0.9, 0.3, 1) | Arrivals (the default) |
| `ease-in` | cubic-bezier(0.55, 0, 1, 0.45) | Departures |
| `ease-in-out` | cubic-bezier(0.65, 0, 0.35, 1) | Loops (skeleton shimmer) |

Animations: `animate-rise-in` (entrance: fade plus 12 px rise; a new order row arriving), `animate-fade-in`, `animate-shimmer` (skeletons), `animate-spin` (spinners). Motion is short and only says "this changed". Only `transform` and `opacity` animate. `prefers-reduced-motion: reduce` collapses every animation and transition to an instant change.

### Browser surfaces

Themed in the base layer: `::selection` (cash-100), the text caret (accent), scrollbars (`line-strong`), focus rings (cash-700, 2 px, 2 px offset on every focusable element), link underline offset (0.22em, 1 px), `color-scheme: light`, and the dialog backdrop (scrim). Page scroll locks while a dialog is open.

## Components (`src/components/ui`)

| Component | Props | Notes |
|---|---|---|
| `Button` | `variant: 'primary' \| 'secondary' \| 'ghost' \| 'paypal'`, `size: 'md' \| 'lg'`, `loading?`, `loadingLabel?`, `icon?`, `iconEnd?`, `fullWidth?` + button attributes | Heights 44 px (`md`) and 52 px (`lg`), 6 px radius. Secondary has a `control` border. `loading` shows a spinner, sets `aria-busy` and blocks clicks. One `primary` per screen; `paypal` only for "Approve $X on PayPal". |
| `ButtonLink` | Same styling options + `next/link` props | Navigation that looks like a button ("Open your dashboard"). Defaults to `secondary`. |
| `buttonClasses()` | `{ variant, size, fullWidth, loading, className }` | For anything else that must look like a button. |
| `Card` | `as?`, `tone: 'raised' \| 'sunken' \| 'flat'`, `padding: 'none' \| 'md' \| 'lg'` | A ruled sheet: 1 px `line-strong` border, 8 px radius. Don't nest cards. |
| `Field` | `label`, `hint?`, `error?`, `required?`, `hideLabel?`, `children: (controlProps) => ReactNode` | Wires `id`, `aria-describedby` and `aria-invalid` into the control. Server-safe. |
| `TextInput`, `TextArea` | Native attributes | 48 px tall, 16 px text. Pass the props `Field` hands you. |
| `FieldError` | `children`, `id?` | Inline error with an icon and `role="alert"`. Name the problem and the fix. |
| `Badge` | `tone: 'neutral' \| 'accent' \| 'ok' \| 'warn' \| 'danger' \| 'info'`, `icon?` | A status stamp: `type-stamp`, tinted fill, a 1 px rule in the same hue at 30%, 2 px radius. Pair status tones with an icon so meaning never rests on colour. |
| `Sheet` | `open`, `onClose`, `title`, `description?`, `footer?` | Native modal `<dialog>`: bottom sheet under 640 px, centred dialog above. The page behind is inert, Esc and a backdrop tap close it, focus returns to the opener. |
| `Tabs` | `label`, `items: { id, label, count?, content }[]`, `value?`, `defaultValue?`, `onValueChange?` | WAI-ARIA tabs with roving tabindex, arrow keys, Home and End. 3 px accent indicator, square count. |
| `ToastProvider`, `useToast()` | `toast({ title, description?, tone: 'neutral' \| 'ok' \| 'danger', durationMs? })` | Mounted in the root layout. Polite live region; never takes focus; auto-dismisses after 5 s; 44 px dismiss button. Errors that need action belong inline, not in a toast. |
| `Skeleton`, `SkeletonText` | `className` (size), `rounded?`, `lines?` | Shaped like the content it replaces. Wrap the region in `aria-busy="true"` with a visually hidden status. |
| `Icon` | `icon: LucideIcon`, `size: 'sm' \| 'md' \| 'lg'`, `label?` | The only way to draw icons (lucide-react, already a project dependency). 16, 20 and 24 px, stroke 1.75. Decorative unless `label` is given. Icon-only buttons put their name on the button (`aria-label`). |

Brand (`src/components/brand`): `Logo` (tag mark on a cash-green tile plus the wordmark in Archivo), `SiteHeader` (logo linking home and the sandbox stamp; in the root layout), `SiteFooter` (the sandbox notice; in the root layout). The root layout also provides the skip link and `<main id="main">`, so pages render their content only.

Ledger patterns (dashboard and receipts):

- **Order row** (`OrderCard`): mono reference, buyer and assistant, time; items, delivery, the AI brief behind a 2 px accent rule; the status stamp; the amount right-aligned in `type-amount`. Cancelled and expired amounts are struck through.
- **Group panel** (`OrdersPanel`): heading with a square count and, for money groups, a subtotal ("Paid $43.50", "Not charged yet $83.00"); one ruled panel with a column head on desktop and `divide-y` rows.
- **Totals**: line items on hairlines, a single ink rule above the total, `rule-total` (double) under it.
- **Flagged menu lines** (setup review): a 4 px warn rule on the card's left edge; the text we read from the photo in mono; the price right-aligned.

## Rules for every screen

- **One primary action** per screen, in `accent`. Secondary actions use `secondary` or `ghost`; tertiary actions are text links in `accent-ink`.
- **Every async action** has idle, loading, success and error states. Errors appear next to the thing that failed, say what happened and what to do ("We couldn’t open that photo. Try a JPG or PNG."), and keep the user’s work.
- **Touch targets** are at least 44 by 44 px, with at least 8 px between them. Inputs use 16 px text.
- **Copy** is plain and specific. Seller screens say "agent door", "payment received", "Add tracking"; never MCP, capture or webhook outside the developer details. No em-dashes in UI copy, no lorem ipsum, no invented statistics. Apostrophes are typographic (’) in every visible string, headings included.
- **Images** have alt text that says what is in them; decorative images use `alt=""`.
- **Prices** come from the shop's data and render with `formatUSD()` and `type-price` (or `type-amount` for row amounts and totals). Order numbers and PayPal ids use `type-ref`.
- **Status colour** always comes with an icon and a word.
- **Nothing clips without a cue:** tab strips wrap onto a second line at 390 px rather than scroll; order numbers never break (`whitespace-nowrap`), and on phones the status stamp sits on its own line under the order header.
- **No raw values in components:** no hex, no ad-hoc shadows or radii. Ratios and layout fractions (`aspect-[4/3]`, `max-w-[85%]`, ledger column widths) are fine.

## Re-skinning

A further visual direction should mostly touch `src/app/globals.css`:

1. Change the primitives (sheet, graphite, accent hue), or point the semantic tokens at different primitives.
2. Swap the fonts in `layout.tsx` (the variables `--font-archivo`, `--font-plex-sans` and `--font-plex-mono` feed `--font-display`, `--font-sans` and `--font-mono`).
3. Adjust component tokens (`--button-radius`, `--card-radius`, `--display-stretch`, shadows) for shape and depth.
4. Recompute the contrast table above for every changed colour with a WCAG 2.1 contrast calculator and update it here.

## Verifying

- `npx playwright test e2e/start.spec.ts`: axe (WCAG 2.1 A and AA) at 390 and 1440 px, no horizontal scroll, every control at least 44 px tall, keyboard focus ring, upload and sample flows.
- `SCREENSHOTS_DIR=docs/judge/screenshots/direction-b E2E_PORT=3140 npx playwright test e2e/screenshots.spec.ts`: every screen at 390 and 1440 px with axe; fails on any serious or critical violation.
