/* eslint-disable @next/next/no-img-element -- bundled demo photos in a decorative mock-up */
import { Bot } from 'lucide-react';
import { Icon } from '@/components/ui/icon';
import { ItemPhoto } from '@/components/shop/ItemPhoto';
import { formatUSD } from '@/lib/domain/money';

// The demo shop as seeded (scripts/seed-demo.ts): prices from public/samples/marigold-bakehouse.jpg, photos from public/demo.
const DEMO = '/demo/marigold-bakehouse';
const ITEMS = [
  { name: 'Almond croissant', cents: 500, photo: `${DEMO}/almond-croissant.jpg` },
  { name: 'Country sourdough loaf', cents: 900, photo: `${DEMO}/country-sourdough-loaf.jpg` },
  { name: 'Cardamom bun', cents: 450, photo: `${DEMO}/cardamom-bun.jpg` },
] as const;
const LINES = [
  { qty: 2, name: 'Almond croissant', cents: 500 },
  { qty: 1, name: 'Country sourdough loaf', cents: 900 },
] as const;
const TOTAL = LINES.reduce((s, l) => s + l.qty * l.cents, 0) + 800;

/**
 * The start page's picture of Shelfie working: the Marigold Bakehouse shop on a phone, with an assistant's order card
 * on top of it, ready to approve on PayPal. Decorative (aria-hidden); the real shop is one link away.
 */
export function StorePreview() {
  return (
    <div aria-hidden="true" className="relative mx-auto w-full max-w-[34rem] select-none">
      {/* Phone */}
      <div className="relative mx-auto w-[17.5rem] rounded-[2.75rem] bg-ink p-2.5 shadow-lg sm:w-[19.5rem]">
        <div className="overflow-hidden rounded-[2.25rem] bg-surface">
          <div className="relative h-36">
            <img src={`${DEMO}/cover.jpg`} alt="" className="size-full bg-tile-rose object-cover" />
            <span className="absolute top-2 left-1/2 h-5 w-20 -translate-x-1/2 rounded-full bg-ink" />
          </div>
          <div className="flex flex-col gap-1 px-4 pt-3">
            <p className="text-xl leading-6 font-extrabold tracking-display text-ink">Marigold Bakehouse</p>
            <p className="text-xs text-ink-muted">Food · Pickup or shipping · Paid with PayPal</p>
          </div>
          <div className="mt-3 flex gap-4 border-b border-line px-4 text-xs font-semibold">
            <span className="border-b-2 border-accent pb-2 text-ink">Pastries</span>
            <span className="pb-2 text-ink-muted">Breads</span>
            <span className="pb-2 text-ink-muted">Cakes</span>
            <span className="pb-2 text-ink-muted">Coffee</span>
          </div>
          <ul className="flex flex-col divide-y divide-line px-4">
            {ITEMS.map((i, n) => (
              <li key={i.name} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink">{i.name}</p>
                  <p className="text-xs font-semibold text-ink-soft tabular-nums">{formatUSD(i.cents)}</p>
                </div>
                <ItemPhoto name={i.name} photoUrl={i.photo} tone={n} size="sm" decorative className="size-14 rounded-(--thumb-radius)" />
              </li>
            ))}
          </ul>
          <div className="px-4 pt-1 pb-5">
            <span className="flex h-11 items-center justify-center gap-2 rounded-full bg-ink text-sm font-semibold text-surface">
              <Icon icon={Bot} size="sm" /> Order with an assistant
            </span>
          </div>
        </div>
      </div>

      {/* The assistant's order, floating beside the phone, above its order bar (which stays in view) */}
      <div className="relative z-10 mx-auto -mt-4 w-[18.5rem] rounded-(--radius-xl) bg-surface p-4 shadow-lg sm:absolute sm:right-0 sm:bottom-28 sm:mt-0 sm:w-[18rem] lg:-right-8">
        <div className="flex items-center gap-2">
          <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-ink text-surface">
            <Icon icon={Bot} size="sm" />
          </span>
          <p className="text-sm font-bold whitespace-nowrap text-ink">Ready to pay</p>
        </div>
        <ul className="mt-3 flex flex-col gap-1 text-sm text-ink tabular-nums">
          {LINES.map((l) => (
            <li key={l.name} className="flex justify-between gap-2">
              <span className="truncate">
                {l.qty} × {l.name}
              </span>
              <span>{formatUSD(l.qty * l.cents)}</span>
            </li>
          ))}
          <li className="flex justify-between gap-2 text-ink-muted">
            <span>Shipping</span>
            <span>{formatUSD(800)}</span>
          </li>
        </ul>
        <span className="mt-3 flex h-11 items-center justify-center rounded-full bg-paypal text-sm font-bold text-on-paypal tabular-nums">
          Approve {formatUSD(TOTAL)} on PayPal
        </span>
      </div>

      {/* The seller's side, a toast-like note at the top left */}
      <div className="absolute top-8 left-0 hidden w-[13.5rem] items-center gap-3 rounded-(--radius-xl) bg-surface p-3 shadow-md sm:flex lg:-left-6">
        <span className="size-2.5 shrink-0 rounded-full bg-ok" />
        <div className="min-w-0">
          <p className="text-sm font-bold text-ink">Payment received</p>
          <p className="text-xs text-ink-muted tabular-nums">SHF-K7F2QX · {formatUSD(TOTAL)}</p>
        </div>
      </div>
    </div>
  );
}
