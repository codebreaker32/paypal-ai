// The publish progress bar: it fills with the items PayPal took, shows the ones it refused as their own part,
// and never reads as complete while some items didn't go through.
import { describe, expect, it } from 'vitest';
import { publishCounts } from '@/components/setup/review-model';

const rows = (...states: ('pending' | 'ok' | 'failed')[]) => states.map((state) => ({ state }));

describe('publishCounts', () => {
  it('counts added, failed and finished items separately', () => {
    expect(publishCounts(rows('ok', 'ok', 'failed', 'pending'))).toEqual({ total: 4, added: 2, failed: 1, finished: 3, addedShare: 0.5, finishedShare: 0.75 });
  });

  it('a publish where 2 of 9 failed fills the bar to 7/9 with the added items, not to the end', () => {
    const c = publishCounts(rows('ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'failed', 'failed'));
    expect(c.added).toBe(7);
    expect(c.addedShare).toBeCloseTo(7 / 9);
    expect(c.finishedShare).toBe(1);
  });

  it('is empty before PayPal answers', () => {
    expect(publishCounts([])).toEqual({ total: 0, added: 0, failed: 0, finished: 0, addedShare: 0, finishedShare: 0 });
  });
});
