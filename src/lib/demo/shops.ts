// The shops `npm run seed` publishes (scripts/seed-demo.ts), besides Marigold Bakehouse, which keeps its own path there.
// Tía Lupe's and Ravi's menus are the recorded readings of their sample photos (src/lib/ai/samples); the other sellers
// are written out here, item by item, as a seller would type them. Photos: src/lib/demo/photos.ts (credits in
// docs/ASSETS.md). Everything here is shown to buyers as a real shop: no "demo" or "example" in any of it.
import type { SampleId } from '@/lib/client/api';
import type { ItemCategory } from '@/lib/domain/category';
import type { ShopFulfillment, ShopKind } from '@/lib/domain/types';

/** The Browse page's chips. A shop's `category` is one of these, or null (not on a chip). */
export const SHOP_CATEGORIES = ['food', 'drinks', 'gifts', 'repairs'] as const;
export type ShopCategory = (typeof SHOP_CATEGORIES)[number];
export const isShopCategory = (v: unknown): v is ShopCategory => typeof v === 'string' && (SHOP_CATEGORIES as readonly string[]).includes(v);

export interface SeedItem {
  name: string;
  section: string | null;
  description: string | null;
  category: ItemCategory;
  /** One price, or labelled options (sizes); integer cents. */
  prices: { label: string | null; cents: number }[];
}

export interface SeedShopDef {
  /** The seed's own name for the shop (stored as shops.seed_key): how a re-run finds it, whatever its slug became. */
  key: string;
  name: string;
  about: string;
  kind: ShopKind;
  fulfillment: ShopFulfillment;
  pickupNotes: string;
  shippingFeeCents: number;
  category: ShopCategory;
  /** Key into DEMO_PHOTOS. */
  photos: string;
  /** A recorded sample reading (its menu photo is stored on the shop too), or the items written out. */
  menu: { sample: SampleId } | { items: SeedItem[] };
}

const one = (cents: number) => [{ label: null, cents }];

export const SEED_SHOPS: SeedShopDef[] = [
  {
    key: 'tia-lupe',
    name: 'Tía Lupe’s Tacos',
    about: 'Street tacos, burritos and aguas frescas from the corner of 5th & Mill. Order ahead and skip the line.',
    kind: 'food',
    fulfillment: 'pickup',
    pickupNotes: 'Tue–Sat 11–8 · corner of 5th & Mill',
    shippingFeeCents: 0,
    category: 'food',
    photos: 'tia-lupe-chalkboard',
    menu: { sample: 'tia-lupe-chalkboard' },
  },
  {
    key: 'ravi-bike',
    name: 'Ravi’s Bike Repair',
    about: 'Flats, brakes, gears and full tune-ups. Book a job, drop the bike off, and it’s ready in two days.',
    kind: 'services',
    fulfillment: 'pickup',
    pickupNotes: 'Drop-off Mon–Fri · 88 Canal Rd · ready in 48h',
    shippingFeeCents: 0,
    category: 'repairs',
    photos: 'ravi-bike-repair',
    menu: { sample: 'ravi-bike-repair' },
  },
  {
    key: 'little-ember',
    name: 'Little Ember Coffee',
    about: 'A coffee cart by the river path. Small-roaster beans, oat milk at no extra charge, and a few bakes from next door.',
    kind: 'food',
    fulfillment: 'pickup',
    pickupNotes: 'Weekdays 7–11am · river path by the Pine St bridge',
    shippingFeeCents: 0,
    category: 'drinks',
    photos: 'little-ember-coffee',
    menu: {
      items: [
        { section: 'Coffee', name: 'Drip coffee', description: 'House blend, refills a dollar.', category: 'coffee', prices: [{ label: '12 oz', cents: 300 }, { label: '16 oz', cents: 350 }] },
        { section: 'Coffee', name: 'Americano', description: 'Double shot over hot water.', category: 'coffee', prices: one(350) },
        { section: 'Coffee', name: 'Cardamom coffee', description: 'Strong coffee brewed with crushed cardamom.', category: 'coffee', prices: one(400) },
        { section: 'Coffee', name: 'Latte', description: null, category: 'coffee', prices: [{ label: '12 oz', cents: 475 }, { label: '16 oz', cents: 525 }] },
        { section: 'Coffee', name: 'Oat milk latte', description: 'Same price as dairy.', category: 'coffee', prices: [{ label: '12 oz', cents: 475 }, { label: '16 oz', cents: 525 }] },
        { section: 'Tea', name: 'Sencha green tea', description: 'Loose leaf, steeped to order.', category: 'tea', prices: one(325) },
        { section: 'Bakes', name: 'Blueberry muffin', description: null, category: 'pastry', prices: one(350) },
        { section: 'Bakes', name: 'Currant scone', description: 'With butter and jam.', category: 'pastry', prices: one(375) },
      ],
    },
  },
  {
    key: 'sunny-side',
    name: 'Sunny Side Lemonade',
    about: 'Lemonade squeezed to order, aguas frescas and scooped ice cream, at the Saturday market and the park on Sundays.',
    kind: 'food',
    fulfillment: 'pickup',
    pickupNotes: 'Sat 9–2 at the Elm St market · Sun 12–5 at Lakeside Park',
    shippingFeeCents: 0,
    category: 'drinks',
    photos: 'sunny-side-lemonade',
    menu: {
      items: [
        { section: 'Lemonade', name: 'Classic lemonade', description: 'Fresh lemons, cane sugar, lots of ice.', category: 'drink', prices: [{ label: '16 oz', cents: 400 }, { label: '24 oz', cents: 550 }] },
        { section: 'Lemonade', name: 'Limeade', description: null, category: 'drink', prices: [{ label: '16 oz', cents: 450 }, { label: '24 oz', cents: 600 }] },
        { section: 'Aguas frescas', name: 'Watermelon cooler', description: 'Watermelon, lime and mint.', category: 'drink', prices: one(500) },
        { section: 'Aguas frescas', name: 'Agua fresca trio', description: 'Three small cups of today’s flavours.', category: 'drink', prices: one(700) },
        { section: 'Aguas frescas', name: 'Juice flight', description: 'Five minis: green, carrot, pineapple, mango and berry.', category: 'drink', prices: one(900) },
        { section: 'Aguas frescas', name: 'Horchata', description: 'Rice, cinnamon and vanilla.', category: 'drink', prices: one(450) },
        { section: 'Ice cream', name: 'Two-scoop cup', description: 'Any two flavours.', category: 'dessert', prices: one(550) },
        { section: 'Ice cream', name: 'Waffle cone', description: 'Two scoops in a fresh waffle cone.', category: 'dessert', prices: one(600) },
        { section: 'Ice cream', name: 'Three-scoop sampler', description: 'Three flavours on a board, to share.', category: 'dessert', prices: one(750) },
      ],
    },
  },
  {
    key: 'fern-and-wick',
    name: 'Fern & Wick',
    about: 'Houseplants, hand-poured candles and cold-process soap, made in a garage workshop. Market pickup or shipped.',
    kind: 'goods',
    fulfillment: 'both',
    pickupNotes: 'Saturdays at the Elm St market, stall 14 · shipping in 3–5 days',
    shippingFeeCents: 600,
    category: 'gifts',
    photos: 'fern-and-wick',
    menu: {
      items: [
        { section: 'Plants', name: 'Succulent in a clay pot', description: 'One succulent in a 3" terracotta pot; we pick a healthy one.', category: 'goods', prices: one(800) },
        { section: 'Plants', name: 'Flowering succulent', description: 'Pink-flowering crassula in a 6" white pot.', category: 'goods', prices: one(1800) },
        { section: 'Plants', name: 'Windowsill pair', description: 'Two small potted plants for a sunny sill.', category: 'goods', prices: one(1400) },
        { section: 'Candles', name: 'Beeswax pillar candle', description: 'About 40 hours of burn.', category: 'goods', prices: [{ label: '3" x 4"', cents: 1600 }, { label: '3" x 6"', cents: 2200 }] },
        { section: 'Candles', name: 'Embossed pillar candle', description: 'Unscented, with a pressed pattern.', category: 'goods', prices: one(1800) },
        { section: 'Soap', name: 'Oatmeal soap bar', description: 'Oat, honey and shea butter, cured six weeks.', category: 'goods', prices: one(700) },
        { section: 'Soap', name: 'Soap sampler', description: 'Five full bars: charcoal, goat milk, lavender, oatmeal, sea clay.', category: 'goods', prices: one(3000) },
        { section: 'Soap', name: 'Soap gift basket', description: 'Two bars and a linen pouch in a woven basket.', category: 'goods', prices: one(2400) },
        { section: 'Goods', name: 'Canvas market tote', description: 'Heavy cotton canvas, long handles.', category: 'goods', prices: one(1500) },
      ],
    },
  },
];
