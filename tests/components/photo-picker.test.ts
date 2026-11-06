// The photo controls on setup review and the Menu tab check a picked file before any upload, with the start page's
// plain messages (src/lib/client/api.ts), and render the add, replace and remove controls with their own names.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CoverPicker, ItemPhotoPicker, pickOne } from '@/components/setup/PhotoPicker';

const files = (...list: File[]) => list as unknown as FileList;
const jpeg = (bytes = 10, name = 'bun.jpg') => new File([new Uint8Array(bytes)], name, { type: 'image/jpeg' });

describe('pickOne', () => {
  it('nothing picked is nothing to do', () => {
    expect(pickOne(null)).toBeNull();
    expect(pickOne(files())).toBeNull();
  });

  it('keeps the first photo of a pick', () => {
    const first = jpeg(10, 'first.jpg');
    expect(pickOne(files(first, jpeg(10, 'second.jpg')))).toEqual({ file: first });
  });

  it('refuses a file that is not a photo, or an empty one, in plain words', () => {
    expect(pickOne(files(new File(['hi'], 'notes.txt', { type: 'text/plain' })))).toEqual({ error: 'We couldn’t open that photo. Try a JPG or PNG.' });
    expect(pickOne(files(jpeg(0)))).toEqual({ error: 'We couldn’t open that photo. Try a JPG or PNG.' });
  });
});

describe('ItemPhotoPicker', () => {
  const props = { shopId: 'shp_1', itemId: 'itm_1', name: 'Cardamom bun', category: 'pastry' as const, onChange: () => {} };

  it('without a photo: the tile is a labelled file input showing the item’s drawing, never letters', () => {
    const html = renderToStaticMarkup(createElement(ItemPhotoPicker, { ...props, photoUrl: null }));
    expect(html).toContain('aria-label="Add a photo of Cardamom bun"');
    expect(html).toContain('type="file"');
    expect(html).toContain('href="/illustrations.svg#pastry"');
    expect(html).not.toContain('>Cb<');
  });

  it('with a photo: the photo (with alt text) opens Replace and Remove', () => {
    const html = renderToStaticMarkup(createElement(ItemPhotoPicker, { ...props, photoUrl: '/i/img_a.webp' }));
    expect(html).toContain('aria-label="Photo of Cardamom bun: replace or remove"');
    expect(html).toContain('alt="Cardamom bun"');
    expect(html).not.toContain('Add a photo of');
  });
});

describe('CoverPicker', () => {
  it('asks for a cover when there is none, and offers Replace and Remove when there is', () => {
    const none = renderToStaticMarkup(createElement(CoverPicker, { shopId: 'shp_1', shopName: 'Marigold', coverUrl: null, onChange: () => {} }));
    expect(none).toContain('aria-label="Add a cover photo"');
    const set = renderToStaticMarkup(createElement(CoverPicker, { shopId: 'shp_1', shopName: 'Marigold', coverUrl: '/i/c.webp', onChange: () => {} }));
    expect(set).toContain('alt="Marigold cover"');
    expect(set).toContain('aria-label="Replace the cover photo"');
    expect(set).toContain('Remove cover');
  });
});
