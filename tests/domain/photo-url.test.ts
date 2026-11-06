import { describe, expect, it } from 'vitest';
import { absolutePhotoUrl } from '@/lib/domain/photo-url';

describe('absolutePhotoUrl', () => {
  it('makes a site-relative photo URL absolute against the app URL or a page on the site', () => {
    expect(absolutePhotoUrl('https://shelfie.example', '/i/img_abc.webp')).toBe('https://shelfie.example/i/img_abc.webp');
    expect(absolutePhotoUrl('http://localhost:3000', '/demo/marigold-bakehouse/cover.jpg')).toBe('http://localhost:3000/demo/marigold-bakehouse/cover.jpg');
    expect(absolutePhotoUrl('https://shelfie.example/s/marigold', '/i/x.webp')).toBe('https://shelfie.example/i/x.webp');
  });

  it('is null for no photo, or anything that is not a site-relative path', () => {
    expect(absolutePhotoUrl('https://shelfie.example', null)).toBeNull();
    expect(absolutePhotoUrl('https://shelfie.example', '')).toBeNull();
    expect(absolutePhotoUrl('https://shelfie.example', '//evil.example/x.jpg')).toBeNull();
    expect(absolutePhotoUrl('https://shelfie.example', '/\\evil.example/x.jpg')).toBeNull();
    expect(absolutePhotoUrl('https://shelfie.example', 'javascript:alert(1)')).toBeNull();
    expect(absolutePhotoUrl('not a url', '/i/x.webp')).toBeNull();
  });
});
