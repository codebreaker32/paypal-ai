import { describe, expect, it } from 'vitest';
import { responsiveImage } from '@/lib/images/responsive';

describe('responsiveImage', () => {
  it('gives a bundled demo photo a srcset of resized copies from the image optimizer', () => {
    const r = responsiveImage('/demo/marigold-bakehouse/cover.jpg', '100vw');
    expect(r.sizes).toBe('100vw');
    expect(r.srcSet).toContain('/_next/image?url=%2Fdemo%2Fmarigold-bakehouse%2Fcover.jpg&w=640&q=75 640w');
  });

  it('gives an uploaded photo (/i/) small candidates for a small tile', () => {
    const r = responsiveImage('/i/img_abcdefghijklmnopqrst.webp', '112px');
    expect(r.srcSet).toContain('/_next/image?url=%2Fi%2Fimg_abcdefghijklmnopqrst.webp&w=256&q=75');
  });

  it('leaves anything else alone: routes with a query, other paths, absolute URLs', () => {
    expect(responsiveImage('/s/marigold-bakehouse/photo/1?size=avatar', '48px')).toEqual({});
    expect(responsiveImage('/api/shops/shp_x/photo/1', '48px')).toEqual({});
    expect(responsiveImage('https://example.com/a.jpg', '48px')).toEqual({});
    expect(responsiveImage('/demo/x.jpg?v=2', '48px')).toEqual({});
  });
});
