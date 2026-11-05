# Shelfie design system

The single reference for how Shelfie looks and behaves. Tokens live in `src/app/globals.css` and nowhere else; components in `src/components/ui` use tokens only. If a screen needs something this file doesn't cover, add the token or component here first.

## Direction

**The paper and ink of a hand-written menu board, made trustworthy.** Shelfie's sellers start from a sheet of paper, a chalkboard or a price card. The interface uses the same materials (warm paper, dark ink, one tomato-red accent, a sign-painter's serif for headings) so the seller's photo and the product feel continuous. The trust part comes from a sober UI sans for everything that has to be read carefully (prices, orders, errors), strict contrast, and status colours that always carry an icon and a word.

Why these choices, given the anti-slop rules:

- **Fraunces** and the **cream, ink and clay** palette are the usual AI defaults for "artisan" briefs. Here both are named in the product brief, and they are tied to the subject: the product is literally a paper price list. The display face is used only for headings and the wordmark, with its `SOFT` axis turned up so it reads closer to a brush-lettered sign than a book face. Everything else is Public Sans.
- **PayPal blue** appears only on PayPal buttons (`variant="paypal"`), so "this is where money happens" is always recognisable.
- No gradients (except the skeleton shimmer, which is functional), no glass, no glow, no emoji as icons, no eyebrow labels above headings.
- Light theme only for now (the use scene is a counter or a stall in daylight). The semantic layer is where a dark theme would go.

## Token layers

```
1. Primitives  :root          --paper-50, --ink-900, --tomato-600 ...   raw values, never used in components
2. Semantic    @theme         bg-surface, text-ink, bg-accent, text-ok   Tailwind utilities
3. Component   :root          --button-primary-bg, --card-radius ...    used inside src/components/ui only
```

Tailwind's default palette, type scale, radii and shadows are removed (`--color-*: initial` and so on), so `bg-zinc-100` or `text-red-500` don't exist. Re-skinning a direction means changing primitives or remapping the semantic layer; no component changes.

### Colour: semantic tokens

| Utility (`bg-*`, `text-*`, `border-*`) | Primitive | Use |
|---|---|---|
| `surface` | `--paper-50` #FBF7F0 | Page background |
| `surface-raised` | `--paper-0` #FFFDF9 | Cards, sheets, inputs |
| `surface-sunken` | `--paper-100` #F4EEE3 | Wells (receipt lines), skeleton base, neutral badge |
| `line` | `--paper-200` #EBE2D3 | Hairline dividers |
| `line-strong` | `--paper-300` #DDD0BC | Card borders (decorative) |
| `control` | `--paper-500` #8C7D70 | Input and dashed-control borders (meets 3:1) |
| `ink` | `--ink-900` #1F1A17 | Body text, headings, focus ring |
| `ink-soft` | `--ink-700` #4A413B | Secondary text, lead paragraphs |
| `ink-muted` | `--ink-600` #6B5F56 | Hints, captions, meta |
| `ink-faint` | `--ink-400` #A3968A | Decorative only; **never text** (2.70:1) |
| `accent` | `--tomato-600` #C2412D | Primary buttons, active tab, the logo |
| `accent-hover` / `accent-active` | `--tomato-700` / `--tomato-800` | Pressed and hover fills |
| `accent-soft` | `--tomato-50` #FBEAE5 | Accent badge background |
| `accent-ink` | `--tomato-700` #A33522 | Accent-coloured text and links |
| `on-accent` | `--paper-0` | Text on accent fills |
| `ok` / `ok-soft` | sage #3D6B45 / #E6EFE3 | Paid, published, done |
| `warn` / `warn-soft` | amber #8A5A00 / #FAEBCB | Needs you, waiting, allergens |
| `danger` / `danger-soft` | brick #9E2B25 / #F8E3DE | Errors, declined, failed |
| `info` / `info-soft` | pen blue #2B4C7E / #E3EAF3 | Shipped, neutral notices |
| `paypal` / `paypal-hover` / `paypal-active` | #0070BA / #005EA6 / #003087 | **PayPal buttons only** |
| `on-paypal` | #FFFFFF | Text on PayPal buttons |
| `focus` | `--ink-900` | Focus ring (2 px solid, 2 px offset) |
| `selection` | `--tomato-100` | `::selection` |
| `scrim` | ink at 45% | Dialog backdrop |

### Contrast (WCAG 2.1, computed from the hex values)

Text needs 4.5:1 (AA, normal text); UI boundaries and icons that carry meaning need 3:1. Every text pairing used by a component passes AA.

| Foreground / background | Ratio | Use |
|---|---|---|
| ink / surface | 16.14 | Body text |
| ink / surface-raised | 16.97 | Text in cards |
| ink / surface-sunken | 14.93 | Text in wells |
| ink-soft / surface | 9.32 | Lead and secondary text |
| ink-soft / surface-sunken | 8.62 | Neutral badge |
| ink-muted / surface | 5.79 | Hints, captions |
| ink-muted / surface-raised | 6.09 | Meta in cards |
| ink-muted / surface-sunken | 5.35 | Meta in wells |
| accent / surface | 4.81 | Accent text (large or bold only by preference) |
| accent-ink / surface | 6.36 | Links ("See a live shop") |
| accent-ink / accent-soft | 5.83 | Accent badge |
| on-accent / accent | 5.06 | Primary button |
| on-accent / accent-hover | 6.69 | Primary button, hover |
| on-accent / accent-active | 8.94 | Primary button, pressed |
| ok / surface | 5.81 | Success text |
| ok / ok-soft | 5.26 | Success badge |
| warn / surface | 5.55 | Warning text |
| warn / surface-raised | 5.83 | Warning text in cards (nut-allergy line) |
| warn / warn-soft | 5.03 | Warning badge |
| danger / surface | 6.96 | Inline errors |
| danger / danger-soft | 6.03 | Error badge |
| info / surface | 8.07 | Info text |
| info / info-soft | 7.11 | Info badge |
| on-paypal / paypal | 5.22 | PayPal button |
| on-paypal / paypal-hover | 6.66 | PayPal button, hover |
| on-paypal / paypal-active | 11.85 | PayPal button, pressed |
| toast fg (paper) / toast bg (ink) | 16.14 | Toasts |
| ok-soft, danger-soft, info-soft icons / ink | 14.63, 13.98, 14.22 | Toast icons |
| control / surface-raised | 3.91 | Input borders (non-text, 3:1) |
| control / surface | 3.72 | Dashed "Add page" control |
| focus ring (ink) / surface | 16.14 | Focus indicator |
| ink-faint / surface | 2.70 | Decorative only |
| line-strong / surface | 1.42 | Decorative card edge; cards also have a shadow |

Disabled controls drop to 50% opacity (WCAG exempts inactive controls). A **loading** button keeps full colour: it is busy, not unavailable.

### Type

Fonts load through `next/font/google` in `src/app/layout.tsx`:

- `font-display`: **Fraunces** (variable, `SOFT` and `opsz` axes). Headings and the wordmark only.
- `font-sans`: **Public Sans** (variable). Everything else. The default on `<html>`.
- `font-mono`: the system monospace stack, for raw IDs in developer details only. Prices use tabular numerals instead (`type-price`).

Scale: a major third from 16 px, rounded to the 2 px grid. The smallest size is 13 px.

| Utility | Size / line height | Use |
|---|---|---|
| `text-xs` | 13 / 18 | Meta, badges, captions |
| `text-sm` | 14 / 20 | Secondary UI text, chat bubbles |
| `text-base` | 16 / 24 | Body (and every input, so iOS doesn't zoom) |
| `text-lg` | 18 / 28 | Lead paragraphs, large buttons |
| `text-xl` | 20 / 28 | Sheet titles |
| `text-2xl` | 24 / 32 | Section titles (phone) |
| `text-3xl` | 30 / 36 | Section titles (desktop) |
| `text-4xl` | 38 / 44 | Page title (phone) |
| `text-5xl` | 48 / 52 | Page title (desktop) |
| `text-6xl` | 60 / 64 | Reserved |

Type roles (use these rather than assembling size, weight and family by hand):

| Role | What it sets |
|---|---|
| `type-display` | Fraunces 600, 38 px (48 px from 1024 px), tracking -0.02em, SOFT 50. One per page: the `h1`. |
| `type-title` | Fraunces 600, 24 px (30 px from 1024 px). Section headings. |
| `type-heading` | Fraunces 600, 20 px. Card and sheet titles. |
| `type-lead` | 18 / 28. The paragraph under a page title. |
| `type-body` | 16 / 24. |
| `type-label` | 14 / 20, weight 600. Field labels, group headings. |
| `type-meta` | 13 / 18. Hints, captions, timestamps. |
| `type-price` | Tabular, lining numerals. Every price, total and order number. |
| `font-soft` | Fraunces' SOFT axis at 50, for display text outside the roles above. |

Line length: running text sits in `max-w-measure` (36 rem, about 65 characters at 16 px). Headings use `text-wrap: balance`, paragraphs `text-wrap: pretty`.

### Spacing, layout, radius, elevation

- **Spacing:** Tailwind's 4 px base (`p-1` = 4 px). Use 1, 1.5, 2, 3, 4, 5, 6, 8, 10, 12. Named rhythm tokens: `tap` (44 px, minimum touch target: `min-h-tap`, `size-tap`), `gutter` (page side padding, 20 px to 48 px fluid: `px-gutter`), `section` (48 px to 96 px fluid: `pb-section`).
- **Containers:** `max-w-page` (76 rem) for page content, `max-w-measure` (36 rem) for prose.
- **Breakpoints:** Tailwind defaults. Design at 390 px first, then `sm` 640, `lg` 1024 and check 1440.
- **Radius:** `xs` 4, `sm` 6, `md` 10 (buttons, inputs), `lg` 14 (cards), `xl` 20 (sheets), `full` (badges, icon buttons).
- **Elevation:** ink-tinted shadows, always an offset plus a soft blur. `shadow-xs` (buttons), `shadow-sm` (cards), `shadow-md` (floating cards, toasts), `shadow-lg` (sheets, the hero photo). No zero-offset glows.
- **Layers:** `--z-header` 20, `--z-sheet` 50, `--z-toast` 60 (`z-(--z-toast)`).

### Motion

| Token | Value | Use |
|---|---|---|
| `--duration-instant` | 90 ms | Press feedback |
| `--duration-fast` | 140 ms | Colour and border changes (the default transition) |
| `--duration-base` | 220 ms | Fades, small moves |
| `--duration-slow` | 360 ms | Entrances (`animate-rise-in`) |
| `ease-out` | cubic-bezier(0.22, 1, 0.36, 1) | Arrivals (the default) |
| `ease-in` | cubic-bezier(0.55, 0, 1, 0.45) | Departures |
| `ease-in-out` | cubic-bezier(0.65, 0, 0.35, 1) | Loops (skeleton shimmer) |

Animations: `animate-rise-in` (entrance: fade plus 24 px rise), `animate-fade-in`, `animate-shimmer` (skeletons), `animate-spin` (spinners). One authored moment per screen; on the Start page it is the example conversation rising in, then the payment note. Only `transform` and `opacity` animate. `prefers-reduced-motion: reduce` collapses every animation and transition to an instant change, and skeletons become a flat fill.

### Browser surfaces

Themed in the base layer: `::selection` (tomato-100), the text caret (accent), scrollbars (`line-strong`), focus rings (ink, 2 px, 2 px offset on every focusable element), link underline offset (0.22em, 1 px), `color-scheme: light`, and the dialog backdrop (scrim). Page scroll locks while a dialog is open.

## Components (`src/components/ui`)

| Component | Props | Notes |
|---|---|---|
| `Button` | `variant: 'primary' \| 'secondary' \| 'ghost' \| 'paypal'`, `size: 'md' \| 'lg'`, `loading?`, `loadingLabel?`, `icon?`, `iconEnd?`, `fullWidth?` + button attributes | Heights 44 px (`md`) and 56 px (`lg`). `loading` shows a spinner, sets `aria-busy` and blocks clicks. One `primary` per screen; `paypal` only for "Approve $X on PayPal". |
| `ButtonLink` | Same styling options + `next/link` props | Navigation that looks like a button ("Open your dashboard"). Defaults to `secondary`. |
| `buttonClasses()` | `{ variant, size, fullWidth, loading, className }` | For anything else that must look like a button. |
| `Card` | `as?`, `tone: 'raised' \| 'sunken' \| 'flat'`, `padding: 'none' \| 'md' \| 'lg'` | A sheet of paper. Don't nest cards. |
| `Field` | `label`, `hint?`, `error?`, `required?`, `hideLabel?`, `children: (controlProps) => ReactNode` | Wires `id`, `aria-describedby` and `aria-invalid` into the control. Server-safe. |
| `TextInput`, `TextArea` | Native attributes | 48 px tall, 16 px text. Pass the props `Field` hands you. |
| `FieldError` | `children`, `id?` | Inline error with an icon and `role="alert"`. Name the problem and the fix. |
| `Badge` | `tone: 'neutral' \| 'accent' \| 'ok' \| 'warn' \| 'danger' \| 'info'`, `icon?` | Status words. Pair status tones with an icon so meaning never rests on colour. |
| `Sheet` | `open`, `onClose`, `title`, `description?`, `footer?` | Native modal `<dialog>`: bottom sheet under 640 px, centred dialog above. The page behind is inert, Esc and a backdrop tap close it, focus returns to the opener. |
| `Tabs` | `label`, `items: { id, label, count?, content }[]`, `value?`, `defaultValue?`, `onValueChange?` | WAI-ARIA tabs with roving tabindex, arrow keys, Home and End. |
| `ToastProvider`, `useToast()` | `toast({ title, description?, tone: 'neutral' \| 'ok' \| 'danger', durationMs? })` | Mounted in the root layout. Polite live region; never takes focus; auto-dismisses after 5 s; 44 px dismiss button. Errors that need action belong inline, not in a toast. |
| `Skeleton`, `SkeletonText` | `className` (size), `rounded?`, `lines?` | Shaped like the content it replaces. Wrap the region in `aria-busy="true"` with a visually hidden status. |
| `Icon` | `icon: LucideIcon`, `size: 'sm' \| 'md' \| 'lg'`, `label?` | The only way to draw icons (lucide-react). 16, 20 and 24 px, stroke 1.75. Decorative unless `label` is given. Icon-only buttons put their name on the button (`aria-label`). |

Brand (`src/components/brand`): `Logo` (tag mark plus wordmark), `SiteHeader` (logo linking home; in the root layout), `SiteFooter` (the sandbox notice; in the root layout). The root layout also provides the skip link and `<main id="main">`, so pages render their content only.

## Rules for every screen

- **One primary action** per screen, in `accent`. Secondary actions use `secondary` or `ghost`; tertiary actions are text links in `accent-ink`.
- **Every async action** has idle, loading, success and error states. Errors appear next to the thing that failed, say what happened and what to do ("We couldn't open that photo. Try a JPG or PNG."), and keep the user's work.
- **Touch targets** are at least 44 by 44 px, with at least 8 px between them. Inputs use 16 px text.
- **Copy** is plain and specific. Seller screens say "agent door", "payment received", "Add tracking"; never MCP, capture or webhook outside the developer details. No em-dashes in UI copy, no lorem ipsum, no invented statistics.
- **Images** have alt text that says what is in them; decorative images use `alt=""`.
- **Prices** come from the shop's data and render with `formatUSD()` and `type-price`.
- **Status colour** always comes with an icon and a word.
- **No raw values in components:** no hex, no ad-hoc shadows or radii. Ratios and layout fractions (`aspect-[4/3]`, `max-w-[85%]`) are fine.

## Re-skinning

A second visual direction should only touch `src/app/globals.css`:

1. Change the primitives (paper, ink, accent hue), or point the semantic tokens at different primitives.
2. Swap the fonts in `layout.tsx` (the variables `--font-fraunces` and `--font-public-sans` feed `--font-display` and `--font-sans`).
3. Adjust component tokens (`--button-radius`, `--card-radius`, shadows) for shape and depth.
4. Recompute the contrast table above for every changed colour with a WCAG 2.1 contrast calculator and update it here.

## Verifying

- `npx playwright test e2e/start.spec.ts`: axe (WCAG 2.1 A and AA) at 390 and 1440 px, no horizontal scroll, every control at least 44 px tall, keyboard focus ring, upload and sample flows.
- `npx playwright test e2e/start.screenshots.spec.ts`: screenshots of `/` and its states into `docs/judge/screenshots/task5/`.
