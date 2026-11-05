import { describe, expect, it } from 'vitest';
import { sanitizeLabel } from '@/lib/text';
import { buildInstructions, sanitizeShopName } from '@/lib/mcp/instructions';

const ZW_BIDI = [0x200b, 0x200c, 0x200d, 0x200e, 0x200f, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069, 0xfeff];

describe('sanitizeLabel / sanitizeShopName', () => {
  it('strips control, line-separator, zero-width and bidi characters', () => {
    const hidden = ZW_BIDI.map((c) => String.fromCharCode(c)).join('');
    const raw = `Mari${hidden}gold\n\r\t${String.fromCharCode(0x2028)}Bake${String.fromCharCode(0x07)}house`;
    const out = sanitizeLabel(raw, 60);
    expect(out).toBe('Marigold Bake house');
    for (const c of [...ZW_BIDI, 0x2028, 0x2029, 0x07, 0x0a]) expect(out.includes(String.fromCharCode(c))).toBe(false);
  });

  it('swaps double quotes, collapses whitespace and caps the length', () => {
    expect(sanitizeLabel('  say  "hi"  ', 60)).toBe("say 'hi'");
    expect(sanitizeLabel('x'.repeat(100), 60)).toHaveLength(60);
    expect(sanitizeLabel('a '.repeat(40), 9)).toBe('a a a a a');
  });

  it('gives the shop-name fallback for empty names and keeps instructions free of hidden characters', () => {
    expect(sanitizeShopName(String.fromCharCode(0x200b, 0x202e))).toBe('this shop');
    const text = buildInstructions(`Rosa${String.fromCharCode(0x202e)}'s ${String.fromCharCode(0x2066)}Bakery`);
    expect(text).toContain("Rosa's Bakery");
    for (const c of ZW_BIDI) expect(text.includes(String.fromCharCode(c))).toBe(false);
  });
});
