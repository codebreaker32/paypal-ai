import { beforeEach, describe, expect, it } from 'vitest';
import { allow, resetRateLimits } from '@/lib/rate-limit';

describe('allow (sliding window)', () => {
  beforeEach(() => resetRateLimits());

  it('allows `limit` hits per window per key, then frees up as old hits leave the window', () => {
    const t0 = 1_000_000;
    expect(allow('k', 3, 1000, t0)).toBe(true);
    expect(allow('k', 3, 1000, t0 + 100)).toBe(true);
    expect(allow('k', 3, 1000, t0 + 200)).toBe(true);
    expect(allow('k', 3, 1000, t0 + 300)).toBe(false);
    expect(allow('other', 3, 1000, t0 + 300)).toBe(true);
    // Rejected calls don't count; the first hit leaves the window at t0 + 1000.
    expect(allow('k', 3, 1000, t0 + 999)).toBe(false);
    expect(allow('k', 3, 1000, t0 + 1001)).toBe(true);
    expect(allow('k', 3, 1000, t0 + 1002)).toBe(false);
  });
});
