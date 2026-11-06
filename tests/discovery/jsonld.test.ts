// Schema.org JSON-LD on the shop page (spec §10a): the menu as offers, PayPal as payment, and the agent door as an
// OrderAction while the shop is live. The <script> it goes in must stay inert whatever the seller's text says.
import { afterAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createTestDb } from '@/lib/db';
import * as items from '@/lib/db/repos/items';
import * as shops from '@/lib/db/repos/shops';
import { jsonLdScript, shopJsonLd } from '@/lib/discovery/jsonld';
import type { DraftItem } from '@/lib/domain/types';
import { createFakePayPal } from '@/lib/paypal/fake';
import { seedDemoShop } from '../../scripts/seed-demo';
import { seedShop } from '../helpers/shop';

const APP = 'https://shelfie.example';
const urlsFor = (slug: string) => ({ shopUrl: `${APP}/s/${slug}`, doorUrl: `${APP}/s/${slug}/mcp` });

const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shelfie-jsonld-'));
afterAll(() => fs.rmSync(uploadsDir, { recursive: true, force: true }));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ld = Record<string, any>;
const ldFor = (...args: Parameters<typeof shopJsonLd>) => shopJsonLd(...args) as Ld;
const offersOf = (entry: Ld): Ld[] => (entry.offers === undefined ? [] : [entry.offers].flat());
const menuItemsOf = (ld: Ld): Ld[] => (ld.hasMenu.hasMenuSection as Ld[]).flatMap((s) => s.hasMenuItem as Ld[]);

const draft = (name: string, prices: (number | null)[], extra: Partial<DraftItem> = {}): DraftItem => ({
  section: null, name, description: null, sourceText: name, confidence: 'high', kind: 'PHYSICAL',
  issues: [], issueDetail: null, status: 'draft',
  variants: prices.map((p, i) => ({ label: prices.length > 1 ? ['S', 'L'][i] : null, priceCents: p })),
  ...extra,
});

describe('shopJsonLd', () => {
  it('describes the demo Marigold Bakehouse as a FoodEstablishment with its 9 orderable menu items as offers', async () => {
    const db = createTestDb();
    const { shop } = await seedDemoShop({ db, paypal: createFakePayPal(), uploadsDir });
    const listed = items.listWithVariants(db, shop.id, { status: ['live', 'in_person'] });
    const urls = urlsFor(shop.slug);

    const ld = ldFor(shop, listed, urls);

    expect(ld).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'FoodEstablishment',
      name: 'Marigold Bakehouse',
      description: shop.about,
      url: urls.shopUrl,
      currenciesAccepted: 'USD',
      paymentAccepted: 'PayPal',
    });
    expect((ld.hasMenu.hasMenuSection as Ld[]).map((s) => s.name)).toEqual(['Breads', 'Pastries', 'Cakes (24h notice)', 'Coffee']);
    const orderable = menuItemsOf(ld).filter((m) => m.offers);
    expect(orderable).toHaveLength(9);
    const offers = orderable.flatMap(offersOf);
    expect(offers).toHaveLength(10); // Drip coffee has two sizes
    for (const offer of offers) {
      expect(offer).toMatchObject({ '@type': 'Offer', priceCurrency: 'USD', availability: 'https://schema.org/InStock' });
      expect(offer.price).toMatch(/^\d+\.\d{2}$/);
    }
    expect(offersOf(menuItemsOf(ld).find((m) => m.name === 'Butter croissant')!)).toEqual([
      expect.objectContaining({ price: '4.25' }),
    ]);
    expect(offersOf(menuItemsOf(ld).find((m) => m.name === 'Drip coffee')!).map((o) => [o.name, o.price])).toEqual([
      ['S', '3.00'],
      ['L', '4.00'],
    ]);
    // "Ask in person": listed on the menu, with no offer.
    expect(menuItemsOf(ld).find((m) => m.name === 'Seasonal fruit galette')).not.toHaveProperty('offers');

    expect(ld.potentialAction).toMatchObject({
      '@type': 'OrderAction',
      target: { '@type': 'EntryPoint', urlTemplate: urls.doorUrl, httpMethod: 'POST', contentType: 'application/json' },
    });
  });

  it('gives the shop its cover and each item with a photo its image, as absolute URLs', async () => {
    const db = createTestDb();
    const { shop } = await seedDemoShop({ db, paypal: createFakePayPal(), uploadsDir });
    const listed = items.listWithVariants(db, shop.id, { status: ['live', 'in_person'] });
    const ld = ldFor(shop, listed, urlsFor(shop.slug));
    expect(ld.image).toBe(`${APP}/demo/marigold-bakehouse/cover.jpg`);
    expect(menuItemsOf(ld).find((m) => m.name === 'Almond croissant')!.image).toBe(`${APP}/demo/marigold-bakehouse/almond-croissant.jpg`);
    for (const m of menuItemsOf(ld)) expect(m.image).toMatch(new RegExp(`^${APP}/demo/marigold-bakehouse/[a-z0-9-]+\\.jpg$`));

    // No photo: no image on the item. No cover: the menu photo stands in for the shop.
    const almond = listed.find((i) => i.name === 'Almond croissant')!;
    const plain = ldFor({ ...shop, coverUrl: null }, listed.map((i) => (i.id === almond.id ? { ...i, photoUrl: null } : i)), urlsFor(shop.slug));
    expect(menuItemsOf(plain).find((m) => m.name === 'Almond croissant')).not.toHaveProperty('image');
    // A library example photo is for people only: never an item's image.
    const example = ldFor(shop, listed.map((i) => (i.id === almond.id ? { ...i, photoUrl: null, examplePhoto: 'croissant-1' } : i)), urlsFor(shop.slug));
    expect(menuItemsOf(example).find((m) => m.name === 'Almond croissant')).not.toHaveProperty('image');
    expect(JSON.stringify(example)).not.toMatch(/library|pexels/);
    expect(plain.image).toBe(`${APP}/s/${shop.slug}/photo/1`);
    expect(ldFor({ ...shop, coverUrl: null, menuPhotoPaths: [] }, listed, urlsFor(shop.slug))).not.toHaveProperty('image');
  });

  it('never gives an agent a Shelfie drawing as a product or shop image (no photo: no image)', async () => {
    const db = createTestDb();
    const { shop } = await seedDemoShop({ db, paypal: createFakePayPal(), uploadsDir });
    const listed = items.listWithVariants(db, shop.id, { status: ['live', 'in_person'] });
    // Every item has a category (its drawing on the page), but none has a photo, and there is no cover or menu photo.
    expect(listed.every((i) => i.category !== null)).toBe(true);
    const bare = ldFor({ ...shop, coverUrl: null, logoUrl: null, menuPhotoPaths: [] }, listed.map((i) => ({ ...i, photoUrl: null })), urlsFor(shop.slug));
    for (const m of menuItemsOf(bare)) expect(m).not.toHaveProperty('image');
    expect(bare).not.toHaveProperty('image');
    expect(JSON.stringify(bare)).not.toMatch(/illustrations\.svg/);
  });

  it('marks sold-out items SoldOut and leaves removed and unpublished items out', () => {
    const db = createTestDb();
    const { shop } = seedShop(db);
    const ld = ldFor(shop, items.listWithVariants(db, shop.id), urlsFor(shop.slug));

    const names = menuItemsOf(ld).map((m) => m.name);
    expect(names).not.toContain('Old scone'); // removed
    expect(names).not.toContain('Secret menu'); // draft, never published
    expect(names).toContain('Market fish');
    expect(menuItemsOf(ld).find((m) => m.name === 'Market fish')).not.toHaveProperty('offers');
    expect(offersOf(menuItemsOf(ld).find((m) => m.name === 'Seeded rye')!)).toEqual([
      expect.objectContaining({ price: '10.50', availability: 'https://schema.org/SoldOut' }),
    ]);
    expect(menuItemsOf(ld).find((m) => m.name === 'Almond croissant')).toMatchObject({
      description: 'Flaky, with almond cream. Contains nuts.',
    });
  });

  it('offers an OrderAction only to a shop that takes orders (has a PayPal email, or is the demo shop)', () => {
    const db = createTestDb();
    const ldOf = (opts: Parameters<typeof seedShop>[1]) => {
      const { shop } = seedShop(db, opts);
      return ldFor(shop, items.listWithVariants(db, shop.id), urlsFor(shop.slug));
    };
    const noEmail = ldOf({ name: 'Old Row Bakery', payeeEmail: null });
    expect(noEmail).not.toHaveProperty('potentialAction');
    expect(menuItemsOf(noEmail).length).toBeGreaterThan(0); // still a real menu
    expect(ldOf({ name: 'Paid Row Bakery', payeeEmail: 'rosa@example.com' })).toHaveProperty('potentialAction');
    expect(ldOf({ name: 'Marigold Bakehouse' })).toHaveProperty('potentialAction'); // demo shop, no email
  });

  it('offers no OrderAction while the shop is paused', () => {
    const db = createTestDb();
    const { shop } = seedShop(db, { status: 'paused' });
    const ld = ldFor(shop, items.listWithVariants(db, shop.id), urlsFor(shop.slug));
    expect(ld).not.toHaveProperty('potentialAction');
    expect(ld['@type']).toBe('FoodEstablishment');
  });

  it('describes a services shop as a LocalBusiness with an offer catalog', () => {
    const db = createTestDb();
    const { shop } = shops.create(db, { name: 'Spoke & Chain Bike Repair', kind: 'services', payeeEmail: 'ana@example.com' });
    items.replaceDrafts(db, shop.id, [
      draft('Flat fix', [1500], { section: 'Repairs', kind: 'SERVICE' }),
      draft('Tune-up', [6000, 9000], { section: 'Repairs', kind: 'SERVICE' }),
      draft('Inner tube', [800], { section: 'Parts' }),
      draft('Wheel truing', [null], { section: 'Repairs', kind: 'SERVICE', status: 'in_person' }),
    ]);
    for (const it of items.listWithVariants(db, shop.id)) if (it.status === 'draft') items.update(db, it.id, { status: 'live' });
    const live = shops.publish(db, shop.id);

    const ld = ldFor(live, items.listWithVariants(db, shop.id), urlsFor(live.slug));

    expect(ld['@type']).toBe('LocalBusiness');
    expect(ld).not.toHaveProperty('hasMenu');
    expect(ld.hasOfferCatalog['@type']).toBe('OfferCatalog');
    const sections = ld.hasOfferCatalog.itemListElement as Ld[];
    expect(sections.map((s) => [s['@type'], s.name])).toEqual([
      ['OfferCatalog', 'Repairs'],
      ['OfferCatalog', 'Parts'],
    ]);
    const entries = sections.flatMap((s) => s.itemListElement as Ld[]);
    expect(entries.find((e) => e.name === 'Flat fix')).toMatchObject({ '@type': 'Service', offers: { '@type': 'Offer', price: '15.00' } });
    expect(offersOf(entries.find((e) => e.name === 'Tune-up')!).map((o) => o.price)).toEqual(['60.00', '90.00']);
    expect(entries.find((e) => e.name === 'Inner tube')).toMatchObject({ '@type': 'Product' });
    expect(entries.find((e) => e.name === 'Wheel truing')).not.toHaveProperty('offers');
    expect(ld.potentialAction.target.urlTemplate).toBe(urlsFor(live.slug).doorUrl);
  });

  it('describes a goods shop as a Store', () => {
    const db = createTestDb();
    const { shop } = shops.create(db, { name: 'Pressed Flower Cards', kind: 'goods' });
    const live = shops.publish(db, shop.id);
    const ld = ldFor(live, [], urlsFor(live.slug));
    expect(ld['@type']).toBe('Store');
    expect(ld.hasOfferCatalog.itemListElement).toEqual([]);
  });
});

describe('jsonLdScript', () => {
  it('keeps a </script> in a shop or item name inert: no "<" survives, and the JSON reads back the same', () => {
    const db = createTestDb();
    const evil = '</script><script>alert(1)</script>';
    const { shop } = seedShop(db, { name: `Rosa ${evil}` });
    items.insertDraft(db, shop.id, { ...draft(evil, [500]), status: 'in_person' });
    const ld = ldFor(shop, items.listWithVariants(db, shop.id), urlsFor(shop.slug));

    const text = jsonLdScript(ld);

    expect(text.toLowerCase()).not.toContain('</script');
    expect(text).not.toContain('<');
    expect(text).toContain('\\u003c/script>');
    expect(JSON.parse(text)).toEqual(ld);
    expect(menuItemsOf(JSON.parse(text) as Ld).map((m) => m.name)).toContain(evil);
  });
});
