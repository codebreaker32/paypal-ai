import { describe, expect, it } from 'vitest';
import nextConfig from '../../next.config';
import { SAMPLE_MENUS as SAMPLES } from '@/app/_start/samples';
import { responsiveImage } from '@/lib/images/responsive';

// The image optimizer answers 400 for a local path outside images.localPatterns, and the image then never loads (the
// start page's sample chips did exactly that). Every path the app sends through the optimizer must be allowed.
const patterns = nextConfig.images?.localPatterns ?? [];
const allowed = (src: string) =>
  patterns.some((p) => {
    const prefix = String(p.pathname).replace(/\*\*$/, '');
    return src.startsWith(prefix) && !src.includes('?');
  });

describe('images.localPatterns', () => {
  it('allows the sample menu photos the start page shows through next/image', () => {
    expect(SAMPLES.length).toBeGreaterThan(0);
    for (const s of SAMPLES) expect(allowed(s.image), s.image).toBe(true);
  });

  it('allows every photo responsiveImage gives a srcset (demo photos, library examples, uploads, cached Pexels matches)', () => {
    for (const src of ['/demo/marigold-bakehouse/cover.jpg', '/library/croissant-1.webp', '/i/img_abcdefghijklmnopqrst.webp', '/i/library/pexels-123.webp']) {
      expect(responsiveImage(src, '100vw').srcSet).toBeTruthy();
      expect(allowed(src), src).toBe(true);
    }
  });
});
