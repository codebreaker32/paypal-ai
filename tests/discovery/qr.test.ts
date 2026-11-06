// The counter card's QR code, made locally (never by a third-party service).
import { describe, expect, it } from 'vitest';
import { qrSvg } from '@/lib/discovery/qr';

const SHOP = 'https://shelfie.example/s/marigold-bakehouse';

describe('qrSvg', () => {
  it('returns an SVG that scales to its box', async () => {
    const svg = await qrSvg(SHOP);
    expect(svg.trimStart().startsWith('<svg')).toBe(true);
    expect(svg).toContain('viewBox');
    expect(svg).not.toMatch(/\swidth=/);
  });

  it('is deterministic, and different links give different codes', async () => {
    expect(await qrSvg(SHOP)).toBe(await qrSvg(SHOP));
    expect(await qrSvg(SHOP)).not.toBe(await qrSvg(`${SHOP}-2`));
  });

  it('carries no text of its own (the link is printed beside it, not inside the SVG)', async () => {
    expect(await qrSvg(SHOP)).not.toContain('marigold');
  });
});
