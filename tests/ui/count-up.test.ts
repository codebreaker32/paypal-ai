import { describe, expect, it } from 'vitest';
import { COUNT_UP_MS, easeOutCount, finishCount, startCount, stepCents } from '@/components/motion/count-up-step';

describe('startCount', () => {
  function fakeClock() {
    let t = 0;
    let next = 1;
    const queue = new Map<number, (now: number) => void>();
    return {
      clock: {
        now: () => t,
        request: (cb: (now: number) => void) => {
          queue.set(next, cb);
          return next++;
        },
        cancel: (id: number) => void queue.delete(id),
      },
      /** Advances time and runs the frames queued so far. */
      frame(ms: number) {
        t += ms;
        const due = [...queue.values()];
        queue.clear();
        for (const cb of due) cb(t);
      },
      pending: () => queue.size,
    };
  }
  const fmt = (c: number) => `$${(c / 100).toFixed(2)}`;
  const targets = () => ({ final: { style: { opacity: '' } }, tween: { textContent: '' as string | null } });

  it('shows the old value and hides the new text synchronously, before any frame runs', () => {
    const { clock } = fakeClock();
    const t = targets();
    startCount(t, 1250, 5571, fmt, clock, () => {});
    expect(t.final.style.opacity).toBe('0');
    expect(t.tween.textContent).toBe('$12.50');
  });

  it('steps through frames and lands on the new value, then hands back to the final text', () => {
    const c = fakeClock();
    const t = targets();
    const seen: number[] = [];
    startCount(t, 1250, 5571, fmt, c.clock, (v) => seen.push(v));
    c.frame(100);
    expect(t.final.style.opacity).toBe('0');
    expect(seen.at(-1)).toBeGreaterThan(1250);
    expect(seen.at(-1)).toBeLessThan(5571);
    c.frame(COUNT_UP_MS);
    expect(seen.at(-1)).toBe(5571);
    expect(t.tween.textContent).toBe('');
    expect(t.final.style.opacity).toBe('');
    expect(c.pending()).toBe(0);
  });

  it('stops when cancelled, leaving the overlay for the next count to take over', () => {
    const c = fakeClock();
    const t = targets();
    const stop = startCount(t, 0, 1000, fmt, c.clock, () => {});
    c.frame(50);
    stop();
    expect(c.pending()).toBe(0);
    expect(t.final.style.opacity).toBe('0');
  });
});

describe('finishCount', () => {
  it('clears the overlay and shows the final text', () => {
    const t = { final: { style: { opacity: '0' } }, tween: { textContent: '$3.00' as string | null } };
    finishCount(t);
    expect(t.final.style.opacity).toBe('');
    expect(t.tween.textContent).toBe('');
  });
});

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
