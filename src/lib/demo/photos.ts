// Bundled photos for the seeded shops (public/demo/<set>/; sources and licences in docs/ASSETS.md).
// Every URL is site-relative, the form Item.photoUrl and Shop.coverUrl store. Only the shops `npm run seed` makes
// (scripts/seed-demo.ts, src/lib/demo/shops.ts) get them automatically: a shop started from a sample menu in setup has
// no photos until its seller adds some. The designed no-photo fallback is still what any item outside these sets shows.
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
  'tia-lupe-chalkboard': {
    cover: '/demo/tia-lupe-chalkboard/cover.jpg',
    items: {
      'Al pastor': '/demo/tia-lupe-chalkboard/al-pastor.jpg',
      'Carnitas': '/demo/tia-lupe-chalkboard/carnitas.jpg',
      'Pollo asado': '/demo/tia-lupe-chalkboard/pollo-asado.jpg',
      'Hongos (veg)': '/demo/tia-lupe-chalkboard/hongos-veg.jpg',
      'Guac + chips': '/demo/tia-lupe-chalkboard/guac-chips.jpg',
      'Elote': '/demo/tia-lupe-chalkboard/elote.jpg',
      'Burrito grande': '/demo/tia-lupe-chalkboard/burrito-grande.jpg',
      'Bean & cheese': '/demo/tia-lupe-chalkboard/bean-cheese.jpg',
      'Horchata': '/demo/tia-lupe-chalkboard/horchata.jpg',
      'Jarritos': '/demo/tia-lupe-chalkboard/jarritos.jpg',
      'Agua fresca del día': '/demo/tia-lupe-chalkboard/agua-fresca-del-dia.jpg',
    },
  },
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
  'little-ember-coffee': {
    cover: '/demo/little-ember-coffee/cover.jpg',
    items: {
      'Drip coffee': '/demo/little-ember-coffee/drip-coffee.webp',
      'Americano': '/demo/little-ember-coffee/americano.webp',
      'Cardamom coffee': '/demo/little-ember-coffee/cardamom-coffee.webp',
      'Latte': '/demo/little-ember-coffee/latte.webp',
      'Oat milk latte': '/demo/little-ember-coffee/oat-milk-latte.webp',
      'Sencha green tea': '/demo/little-ember-coffee/sencha-green-tea.webp',
      'Blueberry muffin': '/demo/little-ember-coffee/blueberry-muffin.webp',
      'Currant scone': '/demo/little-ember-coffee/currant-scone.webp',
    },
  },
  'sunny-side-lemonade': {
    cover: '/demo/sunny-side-lemonade/cover.jpg',
    items: {
      'Classic lemonade': '/demo/sunny-side-lemonade/classic-lemonade.webp',
      'Limeade': '/demo/sunny-side-lemonade/limeade.webp',
      'Watermelon cooler': '/demo/sunny-side-lemonade/watermelon-cooler.webp',
      'Agua fresca trio': '/demo/sunny-side-lemonade/agua-fresca-trio.webp',
      'Juice flight': '/demo/sunny-side-lemonade/juice-flight.webp',
      'Horchata': '/demo/sunny-side-lemonade/horchata.webp',
      'Two-scoop cup': '/demo/sunny-side-lemonade/two-scoop-cup.webp',
      'Waffle cone': '/demo/sunny-side-lemonade/waffle-cone.webp',
      'Three-scoop sampler': '/demo/sunny-side-lemonade/three-scoop-sampler.webp',
    },
  },
  'fern-and-wick': {
    cover: '/demo/fern-and-wick/cover.jpg',
    items: {
      'Succulent in a clay pot': '/demo/fern-and-wick/succulent-clay-pot.webp',
      'Flowering succulent': '/demo/fern-and-wick/flowering-succulent.webp',
      'Windowsill pair': '/demo/fern-and-wick/windowsill-pair.webp',
      'Beeswax pillar candle': '/demo/fern-and-wick/beeswax-pillar-candle.webp',
      'Embossed pillar candle': '/demo/fern-and-wick/embossed-pillar-candle.webp',
      'Oatmeal soap bar': '/demo/fern-and-wick/oatmeal-soap-bar.webp',
      'Soap sampler': '/demo/fern-and-wick/soap-sampler.webp',
      'Soap gift basket': '/demo/fern-and-wick/soap-gift-basket.webp',
      'Canvas market tote': '/demo/fern-and-wick/canvas-market-tote.webp',
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
