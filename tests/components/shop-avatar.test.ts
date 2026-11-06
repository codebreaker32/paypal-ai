// The shop's picture and an item's photo fallback are always pictures: a photo, or a Shelfie drawing, never letters.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ShopAvatar } from '@/components/shop/ShopAvatar';
import { ItemPhoto } from '@/components/shop/ItemPhoto';

const bare = { logoUrl: null, coverUrl: null, slug: 'tia-lupe', menuPhotoPaths: [], kind: 'food' as const };
const taco = (name: string) => ({ name, section: 'TACOS', description: null, category: null });

describe('ShopAvatar', () => {
  it('a shop with no logo, cover or menu photo (old rows, no categories) shows the drawing of what it sells most', () => {
    const html = renderToStaticMarkup(createElement(ShopAvatar, { shop: bare, items: [taco('Al pastor'), taco('Carnitas'), { ...taco('Horchata'), section: 'DRINKS' }] }));
    expect(html).toContain('href="/illustrations.svg#taco"');
    expect(html).not.toMatch(/>[A-Z][a-z]?</);
  });

  it('a draft with nothing at all still gets a picture', () => {
    expect(renderToStaticMarkup(createElement(ShopAvatar, { shop: bare, items: [] }))).toContain('href="/illustrations.svg#goods"');
  });

  it('the logo, the cover and the menu photo are images; owner pages can point the menu photo at the owner route', () => {
    expect(renderToStaticMarkup(createElement(ShopAvatar, { shop: { ...bare, logoUrl: '/i/l.webp', coverUrl: '/i/c.webp' }, items: [] }))).toContain('src="/i/l.webp"');
    expect(renderToStaticMarkup(createElement(ShopAvatar, { shop: { ...bare, coverUrl: '/i/c.webp' }, items: [] }))).toContain('src="/i/c.webp"');
    const menu = { ...bare, menuPhotoPaths: ['shp_1/page-1.jpg'] };
    expect(renderToStaticMarkup(createElement(ShopAvatar, { shop: menu, items: [] }))).toContain('src="/s/tia-lupe/photo/1"');
    expect(renderToStaticMarkup(createElement(ShopAvatar, { shop: menu, items: [], menuPhotoSrc: '/api/shops/shp_1/photo/1' }))).toContain(
      'src="/api/shops/shp_1/photo/1"',
    );
  });
});

describe('ItemPhoto fallback', () => {
  it('no photo: the category’s drawing on the section tint, labelled with the item’s name, never its initials', () => {
    const html = renderToStaticMarkup(createElement(ItemPhoto, { name: 'Country sourdough loaf', photoUrl: null, category: 'bread', tone: 1 }));
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Country sourdough loaf"');
    expect(html).toContain('href="/illustrations.svg#bread"');
    expect(html).toContain('bg-tile-sage');
    expect(html).not.toContain('>Cs<');
  });

  it('sold out keeps the drawing, greyed', () => {
    const html = renderToStaticMarkup(createElement(ItemPhoto, { name: 'Flan', photoUrl: null, category: 'dessert', dim: true }));
    expect(html).toContain('href="/illustrations.svg#dessert"');
    expect(html).toContain('grayscale');
  });
});
