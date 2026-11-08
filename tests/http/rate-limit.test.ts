// SR10: each key keeps its own window, eviction follows that key's window, and limits can be checked without counting.
import { beforeEach, describe, expect, it } from 'vitest';
import { allow, peek, recordHit, resetRateLimits } from '@/lib/rate-limit';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const t0 = 10_000_000;

const keyCount = () => (globalThis as unknown as { __shelfieRateLimits: Map<string, unknown> }).__shelfieRateLimits.size;

describe('peek', () => {
  beforeEach(() => resetRateLimits());

  it('says whether a hit would be allowed, without counting one', () => {
    expect(peek('k', 1, HOUR, t0)).toBe(true);
    expect(peek('k', 1, HOUR, t0)).toBe(true);
    expect(allow('k', 1, HOUR, t0)).toBe(true);
    expect(peek('k', 1, HOUR, t0)).toBe(false);
  });

  it('ignores hits that have left the window', () => {
    allow('k', 1, HOUR, t0);
    expect(peek('k', 1, HOUR, t0 + HOUR - 1)).toBe(false);
    expect(peek('k', 1, HOUR, t0 + HOUR)).toBe(true);
  });
});

describe('recordHit', () => {
  beforeEach(() => resetRateLimits());

  it('counts a hit regardless of the limit, so failures can be recorded after the fact', () => {
    recordHit('k', HOUR, t0);
    recordHit('k', HOUR, t0 + 1);
    expect(peek('k', 2, HOUR, t0 + 2)).toBe(false);
    expect(peek('k', 3, HOUR, t0 + 2)).toBe(true);
    expect(allow('k', 2, HOUR, t0 + 2)).toBe(false);
  });
});

describe('eviction (SR10)', () => {
  beforeEach(() => resetRateLimits());

  it('a 15-minute caller over 10,000 keys leaves a live hourly bucket intact', () => {
    expect(allow('hourly', 1, HOUR, t0)).toBe(true);
    const later = t0 + 20 * MINUTE; // past 15 minutes, well inside the hour
    for (let i = 0; i <= 10_001; i++) allow(`short:${i}`, 5, 15 * MINUTE, later);
    expect(allow('hourly', 1, HOUR, later)).toBe(false);
  });

  it('removes keys past their own window once the map is over 10,000', () => {
    for (let i = 0; i < 5; i++) allow(`brief:${i}`, 5, 1000, t0);
    const later = t0 + 2000;
    for (let i = 0; i <= 10_000; i++) allow(`long:${i}`, 5, HOUR, later);
    expect(keyCount()).toBe(10_001);
  });

  it('recordHit evicts too', () => {
    for (let i = 0; i < 5; i++) recordHit(`brief:${i}`, 1000, t0);
    const later = t0 + 2000;
    for (let i = 0; i <= 10_000; i++) recordHit(`long:${i}`, HOUR, later);
    expect(keyCount()).toBe(10_001);
  });
});
