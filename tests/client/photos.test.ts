import { describe, expect, it } from 'vitest';
import { MAX_PHOTOS, MAX_PHOTO_BYTES, checkNewPhotos } from '@/lib/client/photos';

const photo = (name: string, type: string, bytes = 1024) =>
  new File([new Uint8Array(bytes)], name, { type });

describe('checkNewPhotos', () => {
  it('accepts JPG, PNG and WebP photos', () => {
    const files = [photo('a.jpg', 'image/jpeg'), photo('b.png', 'image/png'), photo('c.webp', 'image/webp')];
    expect(checkNewPhotos(0, files)).toEqual({ ok: true, files });
  });

  it('falls back to the file extension when the browser gives no type', () => {
    const files = [photo('menu.JPG', '')];
    expect(checkNewPhotos(0, files)).toEqual({ ok: true, files });
  });

  it('rejects files that are not JPG, PNG or WebP as a bad file', () => {
    expect(checkNewPhotos(0, [photo('menu.heic', 'image/heic')])).toEqual({ ok: false, kind: 'bad_file' });
    expect(checkNewPhotos(0, [photo('notes.txt', 'text/plain')])).toEqual({ ok: false, kind: 'bad_file' });
    expect(checkNewPhotos(0, [photo('empty.jpg', 'image/jpeg', 0)])).toEqual({ ok: false, kind: 'bad_file' });
  });

  it('rejects photos over the size limit', () => {
    expect(checkNewPhotos(0, [photo('big.jpg', 'image/jpeg', MAX_PHOTO_BYTES + 1)])).toEqual({
      ok: false,
      kind: 'too_large',
    });
  });

  it('rejects more than four photos in total, counting the ones already picked', () => {
    const five = Array.from({ length: MAX_PHOTOS + 1 }, (_, i) => photo(`p${i}.jpg`, 'image/jpeg'));
    expect(checkNewPhotos(0, five)).toEqual({ ok: false, kind: 'too_many' });
    expect(checkNewPhotos(3, five.slice(0, 2))).toEqual({ ok: false, kind: 'too_many' });
    expect(checkNewPhotos(3, five.slice(0, 1))).toEqual({ ok: true, files: five.slice(0, 1) });
  });

  it('reports too_many before inspecting file types', () => {
    const mixed = [...Array.from({ length: 5 }, (_, i) => photo(`p${i}.jpg`, 'image/jpeg')), photo('x.txt', 'text/plain')];
    expect(checkNewPhotos(0, mixed)).toEqual({ ok: false, kind: 'too_many' });
  });
});
