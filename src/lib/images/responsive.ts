import { getImageProps } from 'next/image';

/**
 * Local photos the image optimizer may resize: bundled demo photos (`/demo/…`) and uploads (`/i/…`), with no query
 * string. It must match `images.localPatterns` in next.config.ts, or the optimizer answers 400.
 */
const OPTIMIZABLE = /^\/(?:demo|i)\/[^?#]+$/;

/**
 * A `srcSet` of resized WebP copies (`/_next/image`) for a photo shown at `sizes`, so a phone loads a 256 px copy for
 * a 112 px tile instead of the full photo. The `<img>` keeps the original as its `src` (the fallback, and what tests
 * and agents read). Anything the optimizer may not touch gets nothing.
 */
export function responsiveImage(src: string, sizes: string): { srcSet?: string; sizes?: string } {
  if (!OPTIMIZABLE.test(src)) return {};
  // width/height are only the largest copy the srcset may ask for (uploads are at most 1200 px wide; covers 2000).
  const { props } = getImageProps({ src, alt: '', width: 2000, height: 1500, sizes });
  return { srcSet: props.srcSet, sizes: props.sizes };
}
