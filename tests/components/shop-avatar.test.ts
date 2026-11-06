// The shop's picture and an item's photo fallback are always pictures: a photo, or a Shelfie drawing, never letters.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ShopAvatar } from '@/components/shop/ShopAvatar';
import { ItemPhoto } from '@/components/shop/ItemPhoto';

const bare = { logoUrl: null, coverUrl: null, menuPhotoSrc: null, kind: 'food' as const };
const taco = (name: string) => ({ name, section: 'TACOS', description: null, category: null });

describe('ShopAvatar', () => {
  it('a shop with no logo, cover or menu photo (old rows, no categories) shows the drawing of what it sells most', () => {
    const html = renderToStaticMarkup(createElement(ShopAvatar, { shop: bare, items: [taco('Al pastor'), taco('Carnitas'), { ...taco('Horchata'), section: 'DRINKS' }] }));
    expect(html).toContain('href="/illustrations.svg#taco"');
    expect(html).not.toMatch(/>[A-Z][a-z]?</);
  });

  it('from the cover: a tight crop of its centre (scaled about 1.8x), so the badge over the cover is a detail, not a copy', () => {
    const html = renderToStaticMarkup(createElement(ShopAvatar, { shop: { ...bare, coverUrl: '/i/c.webp' }, items: [] }));
    expect(html).toMatch(/data-avatar="cover"[^>]*overflow-hidden/);
    expect(html).toMatch(/<img[^>]*src="\/i\/c\.webp"[^>]*class="[^"]*scale-\[1\.8\][^"]*object-center/);
    // A logo is the seller's own square: shown whole.
    expect(renderToStaticMarkup(createElement(ShopAvatar, { shop: { ...bare, logoUrl: '/i/l.webp' }, items: [] }))).not.toContain('scale-[1.8]');
  });

  it('a draft with nothing at all still gets a picture', () => {
    expect(renderToStaticMarkup(createElement(ShopAvatar, { shop: bare, items: [] }))).toContain('href="/illustrations.svg#meal"');
  });

  it('the logo, the cover and the menu photo are images; the menu photo is shown from the src the page gives', () => {
    expect(renderToStaticMarkup(createElement(ShopAvatar, { shop: { ...bare, logoUrl: '/i/l.webp', coverUrl: '/i/c.webp' }, items: [] }))).toContain('src="/i/l.webp"');
    expect(renderToStaticMarkup(createElement(ShopAvatar, { shop: { ...bare, coverUrl: '/i/c.webp' }, items: [] }))).toContain('src="/i/c.webp"');
    expect(renderToStaticMarkup(createElement(ShopAvatar, { shop: { ...bare, menuPhotoSrc: '/s/tia-lupe/photo/1' }, items: [] }))).toContain('src="/s/tia-lupe/photo/1"');
    expect(renderToStaticMarkup(createElement(ShopAvatar, { shop: { ...bare, menuPhotoSrc: '/api/shops/shp_1/photo/1' }, items: [] }))).toContain(
      'src="/api/shops/shp_1/photo/1"',
    );
  });
});

describe('ItemPhoto fallback', () => {
  it('no photo: the category’s drawing on the section tint, labelled with the item’s name, never its initials', () => {
    const html = renderToStaticMarkup(createElement(ItemPhoto, { name: 'Country sourdough loaf', photoUrl: null, category: 'bread', tone: 1 }));
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Country sourdough loaf"');
    expect(html).toContain('href="/illustrations.svg#bread-boule"');
    expect(html).toContain('bg-tile-sage');
    expect(html).not.toContain('>Cs<');
  });

  it('sold out keeps the drawing, greyed', () => {
    const html = renderToStaticMarkup(createElement(ItemPhoto, { name: 'Flan', photoUrl: null, category: 'dessert', dim: true }));
    expect(html).toContain('href="/illustrations.svg#dessert"');
    expect(html).toContain('grayscale');
  });
});
