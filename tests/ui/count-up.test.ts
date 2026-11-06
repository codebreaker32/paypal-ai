import { describe, expect, it } from 'vitest';
import { COUNT_UP_MS, easeOutCount, stepCents } from '@/components/motion/count-up-step';

describe('stepCents', () => {
  it('starts at `from` and ends exactly at `to`', () => {
    expect(stepCents(450, 1299, 0)).toBe(450);
    expect(stepCents(450, 1299, 1)).toBe(1299);
  });

  it('always returns whole cents', () => {
    for (let p = 0; p <= 1; p += 0.013) {
      expect(Number.isInteger(stepCents(0, 1001, p))).toBe(true);
      expect(Number.isInteger(stepCents(997, 3, p))).toBe(true);
    }
  });

  it('counts down when from > to, never passing either end', () => {
    const mid = stepCents(2000, 500, 0.5);
    expect(mid).toBeLessThan(2000);
    expect(mid).toBeGreaterThan(500);
    expect(stepCents(2000, 500, 1)).toBe(500);
  });

  it('clamps progress outside 0..1', () => {
    expect(stepCents(100, 200, -0.5)).toBe(100);
    expect(stepCents(100, 200, 1.7)).toBe(200);
    expect(stepCents(100, 200, Number.NaN)).toBe(200);
  });

  it('is monotonic on the way up and on the way down', () => {
    let last = -1;
    for (let i = 0; i <= 20; i++) {
      const v = stepCents(0, 5000, i / 20);
      expect(v).toBeGreaterThanOrEqual(last);
      last = v;
    }
    last = Infinity;
    for (let i = 0; i <= 20; i++) {
      const v = stepCents(5000, 0, i / 20);
      expect(v).toBeLessThanOrEqual(last);
      last = v;
    }
  });

  it('returns `to` when nothing changes', () => {
    expect(stepCents(750, 750, 0.3)).toBe(750);
  });

  it('eases out: past halfway at half time', () => {
    expect(stepCents(0, 1000, 0.5)).toBeGreaterThan(500);
  });
});

describe('easeOutCount', () => {
  it('maps 0 to 0 and 1 to 1', () => {
    expect(easeOutCount(0)).toBe(0);
    expect(easeOutCount(1)).toBe(1);
  });
});

describe('COUNT_UP_MS', () => {
  it('is the slow motion token (360 ms)', () => {
    expect(COUNT_UP_MS).toBe(360);
  });
});
