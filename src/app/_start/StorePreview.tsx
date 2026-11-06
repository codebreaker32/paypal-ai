/* eslint-disable @next/next/no-img-element -- bundled demo photos in a decorative mock-up */
import type { CSSProperties } from 'react';
import { Check } from 'lucide-react';
import { LogoMark } from '@/components/brand/Logo';
import { Icon } from '@/components/ui/icon';
import { ItemPhoto } from '@/components/shop/ItemPhoto';
import { cx } from '@/components/ui/cx';
import { formatUSD } from '@/lib/domain/money';
import './hero-story.css';

// The demo shop as seeded (scripts/seed-demo.ts): prices from public/samples/marigold-bakehouse.jpg, photos from public/demo.
const DEMO = '/demo/marigold-bakehouse';
const MENU_PHOTO = '/samples/marigold-bakehouse.jpg';
const ITEMS = [
  { name: 'Almond croissant', cents: 500, photo: `${DEMO}/almond-croissant.jpg`, category: 'pastry' },
  { name: 'Country sourdough loaf', cents: 900, photo: `${DEMO}/country-sourdough-loaf.jpg`, category: 'bread' },
  { name: 'Cardamom bun', cents: 450, photo: `${DEMO}/cardamom-bun.jpg`, category: 'pastry' },
] as const;
const LINES = [
  { qty: 2, name: 'Almond croissant', cents: 500 },
  { qty: 1, name: 'Country sourdough loaf', cents: 900 },
] as const;
const SHIPPING = 800;
/** What the buyer tells their AI assistant; the order card is its answer. */
const ASK = '2 almond croissants and a sourdough, shipped';
const TOTAL = LINES.reduce((sum, l) => sum + l.qty * l.cents, 0) + SHIPPING;

/** Start time of one step of the story (see hero-story.css). */
const at = (seconds: number) => ({ '--at': `${seconds}s` }) as CSSProperties;
const PAID_AT = 8;

/** The viewfinder's four corners, like the brand mark's. */
function Viewfinder() {
  const corner = 'absolute size-9 border-surface';
  return (
    <span className={cx('absolute inset-[12%]', 'hs-viewfinder')}>
      <span className={cx(corner, 'top-0 left-0 rounded-tl-xl border-t-4 border-l-4')} />
      <span className={cx(corner, 'top-0 right-0 rounded-tr-xl border-t-4 border-r-4')} />
      <span className={cx(corner, 'bottom-0 left-0 rounded-bl-xl border-b-4 border-l-4')} />
      <span className={cx(corner, 'right-0 bottom-0 rounded-br-xl border-r-4 border-b-4')} />
    </span>
  );
}

/**
 * The start page's picture of Shelfie working, told once on load in about 9 s and then held: the phone's camera frames
 * Marigold Bakehouse's paper price list, the photo becomes the live shop, the order button becomes an assistant's
 * order card whose lines type in, and its PayPal button resolves to "Paid with PayPal" as the seller's note lands.
 * CSS only (no script on the start page for it); every element rests on the final frame, which is what reduced motion
 * shows. Decorative (aria-hidden); the real shop is one link away.
 */
export function StorePreview() {
  return (
    <div aria-hidden="true" data-hero-story className="relative mx-auto flex w-full max-w-[34rem] flex-col select-none">
      {/* The paper price list on the counter, beside the phone (wider screens) */}
      <img
        src={MENU_PHOTO}
        alt=""
        className="absolute top-4 right-0 hidden w-28 rotate-3 lg:w-24 rounded-md bg-tile-rose object-cover shadow-md sm:block lg:-right-2"
      />

      {/* Phone */}
      <div className="relative mx-auto w-[17.5rem] rounded-[2.75rem] bg-ink p-2.5 shadow-lg sm:w-[19.5rem]">
        <div className="relative overflow-hidden rounded-[2.25rem] bg-surface">
          <div className="relative h-36">
            <img src={`${DEMO}/cover.jpg`} alt="" className="size-full bg-tile-rose object-cover" />
          </div>
          <div className={cx('flex flex-col gap-1 px-4 pt-3', 'hs-rise')} style={at(2.5)}>
            <p className="text-xl leading-6 font-extrabold tracking-display text-ink">Marigold Bakehouse</p>
            <p className="text-xs text-ink-muted">Food · Pickup or shipping · Paid with PayPal</p>
          </div>
          <div className={cx('mt-3 flex gap-4 border-b border-line px-4 text-xs font-semibold', 'hs-rise')} style={at(2.6)}>
            <span className="border-b-2 border-accent pb-2 text-ink">Pastries</span>
            <span className="pb-2 text-ink-muted">Breads</span>
            <span className="pb-2 text-ink-muted">Cakes</span>
            <span className="pb-2 text-ink-muted">Coffee</span>
          </div>
          <ul className="flex flex-col divide-y divide-line px-4">
            {ITEMS.map((i, n) => (
              <li key={i.name} className={cx('flex items-center gap-3 py-2.5', 'hs-rise')} style={at(2.8 + n * 0.14)}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-5 font-bold text-ink">{i.name}</p>
                  <p className="text-xs font-semibold text-ink-soft tabular-nums">{formatUSD(i.cents)}</p>
                </div>
                <ItemPhoto name={i.name} photoUrl={i.photo} category={i.category} tone={n} decorative className="size-14 rounded-(--thumb-radius)" />
              </li>
            ))}
          </ul>
          {/* Pressed, it gives way to the order card below (which covers where it was). */}
          <div className="px-4 pt-1 pb-5">
            <span className={cx('flex h-11 items-center justify-center gap-2 rounded-full bg-ink text-sm font-semibold text-surface', 'hs-order-button')}>
              Order with an assistant
            </span>
          </div>

          {/* First: the camera, framing the paper price list; the shutter flashes, and the photo gives way to the shop. */}
          <div className={cx('absolute inset-0 bg-ink', 'hs-camera')}>
            <img src={MENU_PHOTO} alt="" className="size-full object-cover" />
            <Viewfinder />
            <span className={cx('absolute inset-0 bg-surface', 'hs-shutter')} />
          </div>
          <span className="absolute top-2 left-1/2 h-5 w-20 -translate-x-1/2 rounded-full bg-ink" />
        </div>
      </div>

      {/* The assistant's order, rising out of the phone's order button and overlapping only where that button was */}
      <div
        className={cx(
          'relative z-10 mx-auto -mt-[4.5rem] w-[18.5rem] rounded-(--radius-xl) bg-surface p-4 shadow-lg sm:mr-0 sm:ml-auto sm:w-[18rem] lg:-mr-4',
          'hs-card',
        )}
      >
        {/* The buyer's one line to their assistant: the card arrives carrying it, so it is never an empty box. */}
        <p className="mb-3 ml-auto w-fit max-w-[15rem] rounded-2xl rounded-br-md bg-surface-subtle px-3 py-2 text-sm leading-5 text-ink">
          {ASK}
        </p>
        <div className={cx('flex items-center gap-2', 'hs-rise')} style={at(4.9)}>
          <LogoMark className="size-7" />
          <span className="grid text-sm font-bold text-ink">
            <span className={cx('[grid-area:1/1]', 'hs-before')} style={at(PAID_AT)}>
              Ready to pay
            </span>
            <span className={cx('[grid-area:1/1]', 'hs-after')} style={at(PAID_AT + 0.1)}>
              Paid
            </span>
          </span>
        </div>
        <ul className="mt-3 flex flex-col gap-1 text-sm text-ink tabular-nums">
          {LINES.map((l, n) => (
            <li key={l.name} className="flex justify-between gap-3">
              <span className={cx('min-w-0', 'hs-type')} style={at(5.3 + n * 0.6)}>
                {l.qty} × {l.name}
              </span>
              <span className={'hs-type'} style={at(5.6 + n * 0.6)}>
                {formatUSD(l.qty * l.cents)}
              </span>
            </li>
          ))}
          <li className="flex justify-between gap-3 text-ink-muted">
            <span className={'hs-type'} style={at(6.5)}>
              Shipping
            </span>
            <span className={'hs-type'} style={at(6.7)}>
              {formatUSD(SHIPPING)}
            </span>
          </li>
        </ul>
        <span className={cx('mt-3 grid h-11 text-sm font-bold tabular-nums', 'hs-rise')} style={at(7.1)}>
          <span className={cx('grid [grid-area:1/1]', 'hs-press')} style={at(PAID_AT - 0.2)}>
            <span
              className={cx('flex items-center justify-center rounded-full bg-paypal text-on-paypal [grid-area:1/1]', 'hs-before')}
              style={at(PAID_AT)}
            >
              Approve {formatUSD(TOTAL)} on PayPal
            </span>
            <span
              className={cx('flex items-center justify-center gap-2 rounded-full bg-ok-soft text-ok [grid-area:1/1]', 'hs-after')}
              style={at(PAID_AT + 0.1)}
            >
              <Icon icon={Check} size="sm" /> Paid with PayPal
            </span>
          </span>
        </span>
      </div>

      {/* The seller's side, a toast-like note at the top left (wider screens) */}
      <div className={cx('absolute top-8 left-0 hidden w-[13.5rem] items-center gap-3 rounded-(--radius-xl) bg-surface p-3 shadow-md sm:flex lg:-left-6', 'hs-note')}>
        <span className="size-2.5 shrink-0 rounded-full bg-ok" />
        <div className="min-w-0">
          <p className="text-sm font-bold text-ink">Payment received</p>
          <p className="text-xs text-ink-muted tabular-nums">SHF-K7F2QX · {formatUSD(TOTAL)}</p>
        </div>
      </div>
    </div>
  );
}
