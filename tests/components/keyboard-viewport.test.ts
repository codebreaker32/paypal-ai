import { describe, expect, it } from 'vitest';
import { keyboardViewport } from '@/components/shop/use-keyboard-viewport';

describe('keyboardViewport', () => {
  it('returns the visible box while a keyboard covers the page', () => {
    expect(keyboardViewport({ innerHeight: 844, height: 500, offsetTop: 0, scale: 1 })).toEqual({ h: 500, y: 0 });
    expect(keyboardViewport({ innerHeight: 844, height: 500, offsetTop: 37, scale: 1 })).toEqual({ h: 500, y: 37 });
  });

  it('is null while the page is pinch-zoomed', () => {
    expect(keyboardViewport({ innerHeight: 844, height: 400, offsetTop: 10, scale: 1.5 })).toBeNull();
    expect(keyboardViewport({ innerHeight: 844, height: 400, offsetTop: 10, scale: 1.02 })).toBeNull();
  });

  it('allows a scale within 1.01', () => {
    expect(keyboardViewport({ innerHeight: 844, height: 400, offsetTop: 0, scale: 1.01 })).toEqual({ h: 400, y: 0 });
  });

  it('is null for a gap under 120 px (browser bars, not a keyboard)', () => {
    expect(keyboardViewport({ innerHeight: 844, height: 800, offsetTop: 0, scale: 1 })).toBeNull();
    expect(keyboardViewport({ innerHeight: 844, height: 725, offsetTop: 0, scale: 1 })).toBeNull();
  });

  it('a gap of exactly 120 px counts', () => {
    expect(keyboardViewport({ innerHeight: 844, height: 724, offsetTop: 0, scale: 1 })).toEqual({ h: 724, y: 0 });
  });
});
