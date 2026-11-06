import { describe, expect, it } from 'vitest';
import { cropRect } from '@/lib/photos/crop';

const W = 1600;
const H = 1067;

describe('cropRect: a found item becomes a 4:3 photo crop', () => {
  it('pads the box and grows it to 4:3 around its centre', () => {
    const r = cropRect({ x0: 700, y0: 500, x1: 900, y1: 650 }, W, H);
    expect(r.width / r.height).toBeCloseTo(4 / 3, 2);
    // Padded by 12% of the larger side on each edge (200 → 248 wide), then 4:3.
    expect(r.width).toBeGreaterThanOrEqual(248);
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    expect(cx).toBeCloseTo(800, 0);
    expect(cy).toBeCloseTo(575, 0);
  });

  it('a tall box grows sideways, not past its height', () => {
    const r = cropRect({ x0: 700, y0: 300, x1: 760, y1: 700 }, W, H);
    expect(r.width / r.height).toBeCloseTo(4 / 3, 2);
    expect(r.height).toBeGreaterThanOrEqual(400);
  });

  it('shifts a crop at the edge back inside the photo instead of cutting it', () => {
    const r = cropRect({ x0: 1450, y0: 950, x1: 1600, y1: 1067 }, W, H);
    expect(r.left + r.width).toBeLessThanOrEqual(W);
    expect(r.top + r.height).toBeLessThanOrEqual(H);
    expect(r.left).toBeGreaterThanOrEqual(0);
    expect(r.width / r.height).toBeCloseTo(4 / 3, 2);
  });

  it('a box as big as the photo shrinks to the largest 4:3 that fits', () => {
    const r = cropRect({ x0: 0, y0: 0, x1: W, y1: H }, W, H);
    expect(r.left).toBeGreaterThanOrEqual(0);
    expect(r.top).toBeGreaterThanOrEqual(0);
    expect(r.left + r.width).toBeLessThanOrEqual(W);
    expect(r.top + r.height).toBeLessThanOrEqual(H);
    expect(Math.max(r.width - W, r.height - H)).toBeLessThanOrEqual(0);
    expect(r.width / r.height).toBeCloseTo(4 / 3, 1);
  });

  it('returns whole pixels', () => {
    const r = cropRect({ x0: 10.4, y0: 20.6, x1: 333.3, y1: 222.2 }, W, H);
    for (const v of Object.values(r)) expect(Number.isInteger(v)).toBe(true);
  });

  it('accepts corners in either order', () => {
    expect(cropRect({ x0: 900, y0: 650, x1: 700, y1: 500 }, W, H)).toEqual(cropRect({ x0: 700, y0: 500, x1: 900, y1: 650 }, W, H));
  });
});
