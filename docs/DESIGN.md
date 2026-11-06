# Shelfie design system

The single reference for how Shelfie looks and behaves. Tokens live in `src/app/globals.css` and nowhere else; components in `src/components/ui` use tokens only. If a screen needs something this file doesn't cover, add the token or component here first.

## Direction A: "Menu board"

**The seller's own world, printed.** Newsprint paper, blackboard-green ink, the till receipt and the handwritten menu that started it all, set with a confident editorial voice and one marigold accent.

Rationale in five lines:

1. Shelfie's sellers are neighbourhood shops whose catalogue is a sheet of paper; the product should feel like their counter, not like a fintech dashboard.
2. A high-contrast menu serif (Playfair Display, roman for titles, italic for menu sections) gives real typographic hierarchy; a newspaper grotesk (Schibsted Grotesk) carries everything read carefully.
3. Money is printed like a till receipt: IBM Plex Mono for every price, total and order number, dashed rules between sections, a perforated foot on every order slip.
4. One decisive accent, marigold (also the demo shop's name), always a fill under ink text, never text itself; PayPal blue appears only on PayPal's own approve button.
5. The menu photo is the hero object: taped to the shop page, framed like a print on setup, so the paper the seller started from stays in view.

Why these choices, given the anti-slop rules:

- **Not Fraunces, not cream and clay.** The baseline used the two most common AI "artisan" defaults; this direction replaces both. The paper is a cooler newsprint (`#F1EEE6`) with receipt-white slips (`#FFFEFA`), the ink is green-black rather than espresso, and the accent is a bright marigold fill rather than brick or brass.
- **The serif is earned:** the subject is literally a printed menu. Playfair's italic is the voice of menu sections ("Breads", "Pastries"); it is never used for body copy.
- **Monospace is data, not costume:** it marks money and order references only, the same things a till prints.
- No gradients (except the skeleton shimmer and the highlighter swipe), no glass, no glow, no emoji as icons, no eyebrow labels above headings, no coloured left-border callouts.
- Light theme only (a counter or a stall in daylight). The semantic layer is where a dark theme would go.

## Token layers

```
1. Primitives  :root          --paper-50, --ink-900, --marigold-400 ...   raw values, never used in components
2. Semantic    @theme         bg-surface, text-ink, bg-accent, text-ok     Tailwind utilities
3. Component   :root          --button-primary-bg, --card-radius ...      used inside src/components/ui only
```

Tailwind's default palette, type scale, radii and shadows are removed (`--color-*: initial` and so on), so `bg-zinc-100` or `text-red-500` don't exist. Re-skinning a direction means changing primitives or remapping the semantic layer.

### Colour: semantic tokens

| Utility (`bg-*`, `text-*`, `border-*`) | Primitive | Use |
|---|---|---|
| `surface` | `--paper-50` #F1EEE6 | Page background (newsprint) |
| `surface-raised` | `--paper-0` #FFFEFA | Cards, receipt slips, inputs |
| `surface-sunken` | `--paper-100` #E7E2D6 | Wells, skeleton base, neutral badge |
| `line` | `--paper-200` #DAD3C3 | Hairline dividers |
| `line-strong` | `--paper-300` #C4BBA7 | Card edges, dashed till rules, leader dots (decorative) |
| `control` | `--paper-500` #7E7563 | Input and dashed-control borders (meets 3:1) |
| `ink` | `--ink-900` #1A1F1B | Body text, headings, button edges, header and section rules, focus ring |
| `ink-soft` | `--ink-700` #3B443E | Secondary text, lead paragraphs |
| `ink-muted` | `--ink-600` #545D57 | Hints, captions, meta |
| `ink-faint` | `--ink-400` #959B92 | Decorative only; **never text** (2.45:1) |
| `accent` | `--marigold-400` #F0A23A | Primary button fill, the logo tag, the highlighter, the tape |
| `accent-hover` / `accent-active` | `--marigold-500` #E38D1F / `--marigold-600` #CF7A12 | Pressed and hover fills; link underlines |
| `accent-soft` | `--marigold-50` #FBEBCF | The AI brief note on order cards, accent badge |
| `accent-ink` | `--ink-900` | Links and accent-toned text: ink, with a marigold underline |
| `on-accent` | `--ink-900` | Text on marigold fills |
| `ok` / `ok-soft` | leaf #2E6A3D / #E2EEDF | Paid, published, done, the paid stamp |
| `warn` / `warn-soft` | rust #9C3F0B / #FBE3D2 | Needs you, waiting, allergens |
| `danger` / `danger-soft` | brick #9B1E1B / #F7DEDA | Errors, declined, failed |
| `info` / `info-soft` | slate #33506B / #E2E8EE | Shipped, picked up, neutral notices |
| `paypal` / `paypal-hover` / `paypal-active` | #0070BA / #005EA6 / #003087 | **PayPal buttons only** |
| `on-paypal` | #FFFFFF | Text on PayPal buttons |
| `focus` | `--ink-900` | Focus ring (2 px solid, 2 px offset) |
| `selection` | `--marigold-100` #F7DDB0 | `::selection` |
| `scrim` | ink at 50% | Dialog backdrop |

### Contrast (WCAG 2.1, computed from the hex values)

Text needs 4.5:1 (AA, normal text); UI boundaries and icons that carry meaning need 3:1. Every text pairing used by a component passes AA. Computed with the WCAG 2.1 relative-luminance formula.

| Foreground / background | Ratio | Use |
|---|---|---|
| ink / surface | 14.42 | Body text |
| ink / surface-raised | 16.57 | Text on cards and receipts |
| ink / surface-sunken | 12.94 | Text in wells |
| ink / accent-soft | 14.24 | AI brief note, accent badge |
| ink-soft / surface | 8.70 | Lead and secondary text |
| ink-soft / surface-raised | 9.99 | Secondary text on cards |
| ink-soft / surface-sunken | 7.80 | Neutral badge |
| ink-soft / accent-soft | 8.59 | Brief note label |
| ink-muted / surface | 5.88 | Hints, captions |
| ink-muted / surface-raised | 6.76 | Meta on cards |
| ink-muted / surface-sunken | 5.27 | Meta in wells |
| ink / accent | 7.91 | Primary button (ink on marigold) |
| ink / accent-hover | 6.45 | Primary button, hover |
| ink / accent-active | 5.13 | Primary button, pressed |
| ink / selection | 12.68 | Selected text |
| ok / surface | 5.58 | Success text |
| ok / surface-raised | 6.41 | Success text on cards, the paid stamp |
| ok / ok-soft | 5.40 | Success badge |
| warn / surface | 5.79 | Warning text |
| warn / surface-raised | 6.65 | Warning text on cards |
| warn / warn-soft | 5.44 | Warning badge and callout |
| warn / accent-soft | 5.72 | Allergy line inside the brief note |
| danger / surface | 6.98 | Inline errors |
| danger / surface-raised | 8.02 | Errors on cards |
| danger / danger-soft | 6.33 | Error badge |
| info / surface | 7.24 | Info text |
| info / surface-raised | 8.32 | Info on cards |
| info / info-soft | 6.80 | Info badge |
| on-paypal / paypal | 5.22 | PayPal button |
| on-paypal / paypal-hover | 6.66 | PayPal button, hover |
| on-paypal / paypal-active | 11.85 | PayPal button, pressed |
| surface / ink | 14.42 | Toasts, buyer chat bubbles, skip link |
| control / surface-raised | 4.51 | Input borders (non-text, 3:1) |
| control / surface | 3.93 | Dashed "Add page" control (non-text, 3:1) |
| ink / surface | 14.42 | Focus ring, button edges, header and section rules |
| accent / surface | 1.82 | Marigold fill against the page: decorative; every marigold button also has a 1.5 px ink edge (14.42:1) |
| ink-faint / surface | 2.45 | Decorative only |
| line-strong / surface | 1.64 | Perforation, dashed rules, leader dots (decorative) |

Disabled controls drop to 50% opacity (WCAG exempts inactive controls). A **loading** button keeps full colour: it is busy, not unavailable.

### Type

Fonts load through `next/font/google` in `src/app/layout.tsx`:

- `font-display`: **Playfair Display** (variable 400 to 900, roman and italic). Titles, the wordmark (800 italic), menu sections (500 italic), receipt headings. Set with lining figures.
- `font-sans`: **Schibsted Grotesk** (variable). A newspaper grotesk for everything else. The default on `<html>`.
- `font-mono`: **IBM Plex Mono** (400, 500, 600). Prices, totals, order numbers, receipt lines, agent-door addresses. Never decorative.

Scale: a major third from 16 px for text, with wider display steps. The smallest size is 13 px.

| Utility | Size / line height | Use |
|---|---|---|
| `text-xs` | 13 / 18 | Meta, badges, captions |
| `text-sm` | 14 / 20 | Secondary UI text, chat bubbles |
| `text-base` | 16 / 24 | Body (and every input, so iOS doesn't zoom) |
| `text-lg` | 18 / 28 | Lead paragraphs, large buttons, menu item names |
| `text-xl` | 20 / 28 | Card titles, receipt totals |
| `text-2xl` | 24 / 32 | Section titles (phone), menu sections |
| `text-3xl` | 30 / 36 | Section titles (desktop) |
| `text-4xl` | 40 / 44 | Page title (phone) |
| `text-5xl` | 52 / 56 | Page title (desktop) |
| `text-6xl` | 68 / 72 | Hero title (desktop) |

Type roles (use these rather than assembling size, weight and family by hand):

| Role | What it sets |
|---|---|
| `type-hero` | Playfair 800, 40 px (68 px from 1024 px), line height 1.02 to 1.06, tracking -0.025em. The start page and shop page `h1`. |
| `type-display` | Playfair 800, 40 px (52 px from 1024 px). Every other page `h1`. |
| `type-title` | Playfair 700, 24 px (30 px from 1024 px). Section headings. |
| `type-heading` | Playfair 700, 20 px. Card and sheet titles. |
| `type-kicker` | Playfair 500 italic, 20 px. Menu sections ("Breads"). Not an eyebrow: it is the section's own heading. |
| `type-lead` | 18 / 28. The paragraph under a page title. |
| `type-body` | 16 / 24. |
| `type-label` | 14 / 20, weight 600. Field labels, group headings. |
| `type-meta` | 13 / 18. Hints, captions, timestamps. |
| `type-price` | IBM Plex Mono, tabular lining figures. Every price, total and order number. |
| `type-receipt` | IBM Plex Mono 14 / 22, tabular. Whole receipt blocks (line items, totals). |
| `type-figures` | Tabular lining figures in the surrounding face, for counts inside prose and headings. |

Line length: running text sits in `max-w-measure` (36 rem, about 65 characters at 16 px). Headings use `text-wrap: balance`, paragraphs `text-wrap: pretty`.

### Paper utilities

| Utility | What it does | Where |
|---|---|---|
| `perforated` | Masks half-circle bites (5 px radius, every 14 px) along the bottom edge and pads the foot to clear them. | Dashboard order cards, the receipt slip, the order page's Items, the buyer console's approval slip, the start page's "Payment received" stub |
| `paper-drop` | Drop shadow that follows a masked shape (put it on the parent of a `perforated` element; box shadows are clipped by the mask). | Wrappers and lists of perforated slips |
| `rule-dashed` | 1.5 px dashed `line-strong` top rule: the till's divider. | Between receipt sections |
| `mark-highlight` | Marigold highlighter swipe behind one phrase (ink text stays 7.91:1). | Once per page at most: "AI shoppers." on the start page |

The menu-board leader dots on the shop page and on the review step's "Ready for PayPal" list are a 2 px dotted `line-strong` bottom border between the item name and its price, shown only when the item has a price. The seller checks their catalog in the same shape buyers will see it.

### Spacing, layout, radius, elevation

- **Spacing:** Tailwind's 4 px base (`p-1` = 4 px). Use 1, 1.5, 2, 3, 4, 5, 6, 8, 10, 12. Named rhythm tokens: `tap` (44 px, minimum touch target: `min-h-tap`, `size-tap`), `gutter` (page side padding, 20 px to 48 px fluid: `px-gutter`), `section` (48 px to 96 px fluid: `pb-section`).
- **Containers:** `max-w-page` (76 rem) for page content, `max-w-narrow` (64 rem) for the receipt, `max-w-measure` (36 rem) for prose, `max-w-card` (5 in) for the printed counter card.
- **Breakpoints:** Tailwind defaults. Design at 390 px first, then `sm` 640, `lg` 1024 and check 1440.
- **Radius (shape lock: square paper corners):** `xs` 2 (badges, stamps, notes), `sm` 3, `md` 4 (buttons, inputs), `lg` 4 (cards, slips), `xl` 12 (the top of the bottom sheet only), `full` (round icon chips, the switch, step dots).
- **Rules:** the site header and footer carry a 2 px ink rule; page mastheads (dashboard tabs, order header, the menu title) use 1 to 2 px ink rules. Everything inside a slip uses dashed `line-strong` rules.
- **Elevation:** paper lying on a counter. Ink-tinted shadows with an offset and a soft blur: `shadow-xs` (buttons), `shadow-sm` (cards), `shadow-md` (floating cards, toasts), `shadow-lg` (sheets, photos). Perforated slips use `paper-drop`. No zero-offset glows, no hard offset shadows.
- **Layers:** `--z-header` 20, `--z-sheet` 50, `--z-toast` 60 (`z-(--z-toast)`).

### Motion

| Token | Value | Use |
|---|---|---|
| `--duration-instant` | 90 ms | Press feedback |
| `--duration-fast` | 140 ms | Colour and border changes (the default transition) |
| `--duration-base` | 220 ms | Fades, small moves, the taped photo straightening on hover |
| `--duration-slow` | 360 ms | Entrances (`animate-rise-in`) |
| `ease-out` | cubic-bezier(0.22, 1, 0.36, 1) | Arrivals (the default) |
| `ease-in` | cubic-bezier(0.55, 0, 1, 0.45) | Departures |
| `ease-in-out` | cubic-bezier(0.65, 0, 0.35, 1) | Loops (skeleton shimmer) |

Animations: `animate-rise-in` (entrance: fade plus 24 px rise), `animate-fade-in`, `animate-shimmer` (skeletons), `animate-spin` (spinners). One authored moment per screen; on the Start page it is the example conversation rising in, then the "Payment received" stub. Only `transform` and `opacity` animate. `prefers-reduced-motion: reduce` collapses every animation and transition to an instant change, and skeletons become a flat fill.

### Browser surfaces

Themed in the base layer: `::selection` (marigold-100), the text caret (marigold), scrollbars (`line-strong`), focus rings (ink, 2 px, 2 px offset on every focusable element), link underlines (2 px, marigold-500, 0.24em offset), lining figures by default, `color-scheme: light`, and the dialog backdrop (scrim). Page scroll locks while a dialog is open.

**Print:** a page that marks one element `data-print-alone` prints that element only (the site header, footer and toast region drop out; the page hides its own toolbar with `print:hidden`). The counter card (`/shops/[id]/card`) is the one such page: a 5 × 7 in slip with a 2 px ink edge and a hairline frame inside it, sized by container queries (`@md:`) so the on-screen preview at 5 in matches the print, and `print-color-adjust: exact` so it prints the same with background graphics off. It stays ink on paper (it must survive a black-and-white printer); the marigold appears only in the Shelfie tag and, on screen, the tape holding the card to the page.

## Components (`src/components/ui`)

| Component | Props | Notes |
|---|---|---|
| `Button` | `variant: 'primary' \| 'secondary' \| 'ghost' \| 'paypal'`, `size: 'md' \| 'lg'`, `loading?`, `loadingLabel?`, `icon?`, `iconEnd?`, `fullWidth?` + button attributes | A printed label: `primary` is ink text on marigold with a 1.5 px ink edge, `secondary` an ink outline on transparent paper. Heights 44 px (`md`) and 56 px (`lg`). `loading` shows a spinner, sets `aria-busy` and blocks clicks. One `primary` per screen; `paypal` only for "Approve $X on PayPal". |
| `ButtonLink` | Same styling options + `next/link` props | Navigation that looks like a button ("Open your dashboard"). Defaults to `secondary`. |
| `buttonClasses()` | `{ variant, size, fullWidth, loading, className }` | For anything else that must look like a button. |
| `Card` | `as?`, `tone: 'raised' \| 'sunken' \| 'flat'`, `padding: 'none' \| 'md' \| 'lg'` | A slip of receipt paper with square corners. Add `perforated` (and `paper-drop` on the parent) for anything that is an order or a receipt. Don't nest cards. |
| `Field` | `label`, `hint?`, `error?`, `required?`, `hideLabel?`, `children: (controlProps) => ReactNode` | Wires `id`, `aria-describedby` and `aria-invalid` into the control. Server-safe. |
| `TextInput`, `TextArea` | Native attributes | 48 px tall, 16 px text. Pass the props `Field` hands you. |
| `FieldError` | `children`, `id?` | Inline error with an icon and `role="alert"`. Name the problem and the fix. |
| `Badge` | `tone: 'neutral' \| 'accent' \| 'ok' \| 'warn' \| 'danger' \| 'info'`, `icon?` | A rubber stamp: square corners, a 1 px edge in the tone's colour. Status words. Pair status tones with an icon so meaning never rests on colour. |
| `Sheet` | `open`, `onClose`, `title`, `description?`, `footer?` | Native modal `<dialog>`: bottom sheet under 640 px, centred dialog above. The page behind is inert, Esc and a backdrop tap close it, focus returns to the opener. |
| `Tabs` | `label`, `items: { id, label, count?, content }[]`, `value?`, `defaultValue?`, `onValueChange?` | An ink rule under the list, a 3 px ink bar under the active tab, counts in mono. 14 px labels under 640 px, 16 px above; the list wraps rather than scrolls, so no label is ever clipped. WAI-ARIA tabs with roving tabindex, arrow keys, Home and End. |
| `ToastProvider`, `useToast()` | `toast({ title, description?, tone: 'neutral' \| 'ok' \| 'danger', durationMs? })` | Mounted in the root layout. Polite live region; never takes focus; auto-dismisses after 5 s; 44 px dismiss button. Errors that need action belong inline, not in a toast. |
| `Skeleton`, `SkeletonText` | `className` (size), `rounded?`, `lines?` | Shaped like the content it replaces. Wrap the region in `aria-busy="true"` with a visually hidden status. |
| `Icon` | `icon: LucideIcon`, `size: 'sm' \| 'md' \| 'lg'`, `label?` | The only way to draw icons (lucide-react). 16, 20 and 24 px, stroke 1.75. Decorative unless `label` is given. Icon-only buttons put their name on the button (`aria-label`). |

Brand (`src/components/brand`): `Logo` (marigold tag with an ink edge plus the wordmark in Playfair 800 italic), `SiteHeader` (logo linking home; in the root layout), `SiteFooter` (the sandbox notice; in the root layout). The root layout also provides the skip link and `<main id="main">`, so pages render their content only.

## Rules for every screen

- **One primary action** per screen, in `accent`. Secondary actions use `secondary` or `ghost`; tertiary actions are text links in `accent-ink` (ink) with a marigold underline.
- **Marigold is a fill, never text.** It fails as text on paper (1.82:1); anything marigold carries ink on top or an ink edge beside it.
- **Every async action** has idle, loading, success and error states. Errors appear next to the thing that failed, say what happened and what to do ("We couldn’t open that photo. Try a JPG or PNG."), and keep the user's work.
- **Touch targets** are at least 44 by 44 px, with at least 8 px between them. Inputs use 16 px text.
- **Copy** is plain and specific. Seller screens say "agent door", "payment received", "Add tracking"; never MCP, capture or webhook outside the developer details. Curly apostrophes and quotes (’ “ ”) in every visible string, including server messages; no em-dashes in UI copy, no lorem ipsum, no invented statistics.
- **Images** have alt text that says what is in them; decorative images use `alt=""`.
- **Prices** come from the shop's data and render with `formatUSD()` and `type-price` (mono). Orders and receipts are printed slips: mono lines, dashed rules, a perforated foot. On a phone an order slip's top row is the number on the left and the total on the right, with the buyer line and status stamp below it; the number never breaks. Dashboard groups carry a mono subtotal ("Paid $43.50", "Not paid yet $83.00").
- **Status colour** always comes with an icon and a word.
- **No raw values in components:** no hex, no ad-hoc shadows or radii. Ratios and layout fractions (`aspect-[4/3]`, `max-w-[85%]`) are fine.

## Re-skinning

A second visual direction should only touch `src/app/globals.css`:

1. Change the primitives (paper, ink, accent hue), or point the semantic tokens at different primitives.
2. Swap the fonts in `layout.tsx` (the variables `--font-playfair`, `--font-schibsted` and `--font-plex-mono` feed `--font-display`, `--font-sans` and `--font-mono`).
3. Adjust component tokens (`--button-radius`, `--card-radius`, shadows) for shape and depth.
4. Recompute the contrast table above for every changed colour with a WCAG 2.1 contrast calculator and update it here.

## Verifying

- `npx playwright test e2e/start.spec.ts`: axe (WCAG 2.1 A and AA) at 390 and 1440 px, no horizontal scroll, every control at least 44 px tall, keyboard focus ring, upload and sample flows.
- `SCREENSHOTS_DIR=docs/judge/screenshots/direction-a E2E_PORT=3141 npm run screenshots`: every in-scope screen at 390 and 1440 px with axe results (`axe-results.json`).
