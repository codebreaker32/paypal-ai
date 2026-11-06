// Decoding a photo can take a lot of memory, so uploads are decoded one at a time across the
// whole process, never in parallel (review 2 S1). sharp is wrapped to count pipelines in flight.
import sharpReal from 'sharp';
import { describe, expect, it, vi } from 'vitest';

const live = vi.hoisted(() => ({ now: 0, max: 0, limits: [] as unknown[] }));

vi.mock('sharp', async (importOriginal) => {
  const real = (await importOriginal<{ default: typeof sharpReal }>()).default;
  const wrapped = (...args: Parameters<typeof real>) => {
    live.limits.push((args[1] as { limitInputPixels?: unknown } | undefined)?.limitInputPixels);
    const s = real(...args);
    for (const method of ['metadata', 'toBuffer'] as const) {
      const original = (s[method] as (...a: unknown[]) => Promise<unknown>).bind(s);
      (s as unknown as Record<string, unknown>)[method] = async (...a: unknown[]) => {
        live.now++;
        live.max = Math.max(live.max, live.now);
        try {
          return await original(...a);
        } finally {
          live.now--;
        }
      };
    }
    return s;
  };
  return { default: Object.assign(wrapped, real) };
});

const { MAX_PHOTO_PIXELS, decodePhotoPixels, normalizePhoto } = await import('@/lib/uploads');

describe('normalizePhoto concurrency', () => {
  it('decodes one photo at a time, even when several requests arrive together', async () => {
    const png = await sharpReal({ create: { width: 3000, height: 2000, channels: 3, background: '#c8965a' } }).png().toBuffer();
    live.max = 0;
    live.limits = [];
    await Promise.all([png, png, png, png, png, png].map((b) => normalizePhoto(b)));
    expect(live.max).toBe(1);
    // The decoding pipeline (not the header read) carries sharp's own pixel limit as a backstop.
    expect(live.limits.filter((l) => l === MAX_PHOTO_PIXELS)).toHaveLength(6);
  });

  it('decoding to raw pixels (Snap your counter) waits in the same line', async () => {
    const png = await sharpReal({ create: { width: 3000, height: 2000, channels: 3, background: '#c8965a' } }).png().toBuffer();
    live.max = 0;
    await Promise.all([normalizePhoto(png), decodePhotoPixels(png, 2000), normalizePhoto(png), decodePhotoPixels(png, 2000)]);
    expect(live.max).toBe(1);
  });
});
