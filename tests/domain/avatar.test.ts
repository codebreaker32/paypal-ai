import { describe, expect, it } from 'vitest';
import { menuPhotoAvatarSrc, shopAvatar, type AvatarShop } from '@/lib/domain/avatar';
import { CATEGORIES } from '@/lib/domain/category';

const shop = (over: Partial<AvatarShop> = {}): AvatarShop => ({ logoUrl: null, coverUrl: null, menuPhotoSrc: null, kind: 'food', ...over });
const MENU = '/s/marigold-bakehouse/photo/1';
const item = (name: string, section: string | null = null, category: (typeof CATEGORIES)[number] | null = null) => ({ name, section, description: null, category });

describe('shopAvatar', () => {
  it('the logo wins over everything', () => {
    expect(shopAvatar(shop({ logoUrl: '/i/logo.webp', coverUrl: '/i/cover.webp', menuPhotoSrc: MENU }), [])).toEqual({ kind: 'logo', src: '/i/logo.webp' });
  });

  it('no logo → the cover', () => {
    expect(shopAvatar(shop({ coverUrl: '/i/cover.webp', menuPhotoSrc: MENU }), [])).toEqual({ kind: 'cover', src: '/i/cover.webp' });
  });

  it('neither → the first menu photo, from where the caller serves it, unchanged', () => {
    expect(shopAvatar(shop({ menuPhotoSrc: MENU }), [])).toEqual({ kind: 'menu', src: MENU });
    expect(shopAvatar(shop({ menuPhotoSrc: '/api/shops/shp_1/photo/1' }), [])).toEqual({ kind: 'menu', src: '/api/shops/shp_1/photo/1' });
  });

  it('no menu photo to show → the drawing, whatever the items', () => {
    expect(shopAvatar(shop({ menuPhotoSrc: null }), [item('Butter croissant')])).toEqual({ kind: 'illustration', category: 'pastry' });
  });

  it('nothing → an illustration of the most common item category', () => {
    const items = [item('Drip coffee'), item('Butter croissant'), item('Almond croissant'), item('Country sourdough loaf')];
    expect(shopAvatar(shop(), items)).toEqual({ kind: 'illustration', category: 'pastry' });
  });

  it('a tie goes to the first item’s category', () => {
    const items = [item('Country sourdough loaf'), item('Butter croissant'), item('Seeded rye'), item('Almond croissant')];
    expect(shopAvatar(shop(), items)).toEqual({ kind: 'illustration', category: 'bread' });
    const later = [item('Butter croissant'), item('Seeded rye'), item('Country sourdough loaf'), item('Almond croissant')];
    expect(shopAvatar(shop(), later)).toEqual({ kind: 'illustration', category: 'pastry' });
  });

  it('a stored category counts over the guess', () => {
    const items = [item('The Marigold', null, 'cake'), item('The Sunrise', null, 'cake'), item('Seeded rye')];
    expect(shopAvatar(shop(), items)).toEqual({ kind: 'illustration', category: 'cake' });
  });

  it('a bakery with no photos is a loaf or a pastry, never a string of letters', () => {
    const items = [item('Country sourdough loaf', 'Breads'), item('Seeded rye', 'Breads'), item('Butter croissant', 'Pastries'), item('Drip coffee', 'Coffee')];
    const avatar = shopAvatar(shop(), items);
    if (avatar.kind !== 'illustration') throw new Error(`expected a drawing, got ${avatar.kind}`);
    expect(['bread', 'pastry']).toContain(avatar.category);
  });

  it('a shop with no items and no photos still gets a picture: its kind’s default', () => {
    expect(shopAvatar(shop(), [])).toEqual({ kind: 'illustration', category: 'meal' });
    expect(shopAvatar(shop({ kind: 'goods' }), [])).toEqual({ kind: 'illustration', category: 'goods' });
    expect(shopAvatar(shop({ kind: 'services' }), [])).toEqual({ kind: 'illustration', category: 'tool' });
  });
});

describe('menuPhotoAvatarSrc', () => {
  const owned = { id: 'shp_1', slug: 'marigold-bakehouse', menuPhotoPaths: ['shp_1/page-1.jpg'] };

  it('a shop with no menu photo has none to show', () => {
    expect(menuPhotoAvatarSrc({ ...owned, menuPhotoPaths: [] }, 'public')).toBeNull();
    expect(menuPhotoAvatarSrc({ ...owned, menuPhotoPaths: [] }, 'owner')).toBeNull();
  });

  it('the shop page uses the public route; the seller’s own pages the owner route, which also serves a draft’s photo', () => {
    expect(menuPhotoAvatarSrc(owned, 'public')).toMatch(/^\/s\/marigold-bakehouse\/photo\/1(\?|$)/);
    expect(menuPhotoAvatarSrc(owned, 'owner')).toMatch(/^\/api\/shops\/shp_1\/photo\/1(\?|$)/);
  });

  it('asks for the small square, never the full photo, for a tile of at most 96 px', () => {
    expect(menuPhotoAvatarSrc(owned, 'public')).toBe('/s/marigold-bakehouse/photo/1?size=avatar');
    expect(menuPhotoAvatarSrc(owned, 'owner')).toBe('/api/shops/shp_1/photo/1?size=avatar');
  });
});
