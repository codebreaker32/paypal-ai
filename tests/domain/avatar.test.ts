import { describe, expect, it } from 'vitest';
import { shopAvatar } from '@/lib/domain/avatar';
import { CATEGORIES } from '@/lib/domain/category';
import type { Shop } from '@/lib/domain/types';

type AvatarShop = Pick<Shop, 'logoUrl' | 'coverUrl' | 'slug' | 'menuPhotoPaths' | 'kind'>;
const shop = (over: Partial<AvatarShop> = {}): AvatarShop => ({ logoUrl: null, coverUrl: null, slug: 'marigold-bakehouse', menuPhotoPaths: [], kind: 'food', ...over });
const item = (name: string, section: string | null = null, category: (typeof CATEGORIES)[number] | null = null) => ({ name, section, description: null, category });

describe('shopAvatar', () => {
  it('the logo wins over everything', () => {
    expect(shopAvatar(shop({ logoUrl: '/i/logo.webp', coverUrl: '/i/cover.webp', menuPhotoPaths: ['a.jpg'] }), [])).toEqual({ kind: 'logo', src: '/i/logo.webp' });
  });

  it('no logo → the cover', () => {
    expect(shopAvatar(shop({ coverUrl: '/i/cover.webp', menuPhotoPaths: ['a.jpg'] }), [])).toEqual({ kind: 'cover', src: '/i/cover.webp' });
  });

  it('neither → the first menu photo, served publicly', () => {
    expect(shopAvatar(shop({ menuPhotoPaths: ['menu-1.jpg', 'menu-2.jpg'] }), [])).toEqual({ kind: 'menu', src: '/s/marigold-bakehouse/photo/1' });
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
    expect(avatar.kind).toBe('illustration');
    expect(avatar.kind === 'illustration' && ['bread', 'pastry']).toContain(avatar.kind === 'illustration' ? avatar.category : '');
  });

  it('a shop with no items and no photos still gets a picture: its kind’s default', () => {
    expect(shopAvatar(shop(), [])).toEqual({ kind: 'illustration', category: 'goods' });
    expect(shopAvatar(shop({ kind: 'services' }), [])).toEqual({ kind: 'illustration', category: 'tool' });
  });
});
