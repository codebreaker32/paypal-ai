// Bundled photos for the three sample menus (public/demo/<shop-slug>/; sources and licences in docs/ASSETS.md).
// Every URL is site-relative, the form Item.photoUrl and Shop.coverUrl store. Only the seeded demo shop
// (marigold-bakehouse, scripts/seed-demo.ts) gets them automatically: a shop started from a sample menu in setup has
// no photos until its seller adds some. Ravi's set is for screenshot fixtures and the design work; Tía Lupe has none on purpose, so the fixtures show the designed no-photo fallback.
//
// Keys are item names exactly as the recorded readings spell them (src/lib/ai/samples/*.json). An item with no clean
// photo (a branded drink, a service with no good shot) is left out and shows the designed fallback.

export interface DemoPhotoSet {
  /** The shop's wide cover photo, or null. */
  cover: string | null;
  /** Item name → photo URL. */
  items: Record<string, string>;
}

export const DEMO_PHOTOS: Record<string, DemoPhotoSet> = {
  'marigold-bakehouse': {
    cover: '/demo/marigold-bakehouse/cover.jpg',
    items: {
      'Country sourdough loaf': '/demo/marigold-bakehouse/country-sourdough-loaf.jpg',
      'Seeded rye': '/demo/marigold-bakehouse/seeded-rye.jpg',
      'Focaccia – rosemary & sea salt': '/demo/marigold-bakehouse/focaccia-rosemary-sea-salt.jpg',
      'Butter croissant': '/demo/marigold-bakehouse/butter-croissant.jpg',
      'Almond croissant': '/demo/marigold-bakehouse/almond-croissant.jpg',
      'Cardamom bun': '/demo/marigold-bakehouse/cardamom-bun.jpg',
      'Pain au chocolat': '/demo/marigold-bakehouse/pain-au-chocolat.jpg',
      'Olive oil citrus cake – 8"': '/demo/marigold-bakehouse/olive-oil-citrus-cake-8.jpg',
      'Seasonal fruit galette': '/demo/marigold-bakehouse/seasonal-fruit-galette.jpg',
      'Drip coffee': '/demo/marigold-bakehouse/drip-coffee.jpg',
    },
  },
  // No photos on purpose: the fixtures need a shop that shows the designed fallback.
  'tia-lupe-chalkboard': { cover: null, items: {} },
  'ravi-bike-repair': {
    cover: '/demo/ravi-bike-repair/cover.jpg',
    items: {
      'Flat fix (tube incl.)': '/demo/ravi-bike-repair/flat-fix-tube-incl.jpg',
      'Brake tune — per wheel': '/demo/ravi-bike-repair/brake-tune-per-wheel.jpg',
      'Full tune-up': '/demo/ravi-bike-repair/full-tune-up.jpg',
      'Gear indexing': '/demo/ravi-bike-repair/gear-indexing.jpg',
      'Chain replace (+ parts)': '/demo/ravi-bike-repair/chain-replace-parts.jpg',
      'Wheel true': '/demo/ravi-bike-repair/wheel-true.jpg',
      'Kids bike safety check': '/demo/ravi-bike-repair/kids-bike-safety-check.jpg',
    },
  },
};

/** Names compare loosely (case, accents, punctuation and spacing), so "almond  Croissant" still finds its photo. */
const key = (name: string) =>
  name.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** The bundled photo for an item of a sample shop, or null (unknown shop, or an item with no photo). */
export function demoPhotoFor(shopSlug: string, itemName: string): string | null {
  const set = Object.hasOwn(DEMO_PHOTOS, shopSlug) ? DEMO_PHOTOS[shopSlug] : undefined;
  if (!set) return null;
  if (Object.hasOwn(set.items, itemName)) return set.items[itemName];
  const want = key(itemName);
  if (!want) return null;
  for (const [name, url] of Object.entries(set.items)) if (key(name) === want) return url;
  return null;
}

/** The bundled cover photo of a sample shop, or null. */
export function demoCoverFor(shopSlug: string): string | null {
  return Object.hasOwn(DEMO_PHOTOS, shopSlug) ? DEMO_PHOTOS[shopSlug].cover : null;
}
