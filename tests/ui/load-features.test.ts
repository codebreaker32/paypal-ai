import { describe, expect, it, vi } from 'vitest';
import { loadWithRetry } from '@/components/motion/load-features';

describe('loadWithRetry', () => {
  it('resolves with the first load when it works', async () => {
    const load = vi.fn().mockResolvedValue('features');
    const giveUp = vi.fn();
    await expect(loadWithRetry(load, giveUp)).resolves.toBe('features');
    expect(load).toHaveBeenCalledTimes(1);
    expect(giveUp).not.toHaveBeenCalled();
  });

  it('retries once after a failed load', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('chunk failed')).mockResolvedValue('features');
    const giveUp = vi.fn();
    await expect(loadWithRetry(load, giveUp)).resolves.toBe('features');
    expect(load).toHaveBeenCalledTimes(2);
    expect(giveUp).not.toHaveBeenCalled();
  });

  it('gives up after two failures: calls giveUp and never rejects', async () => {
    const load = vi.fn().mockRejectedValue(new Error('offline'));
    const giveUp = vi.fn();
    const settled = vi.fn();
    loadWithRetry(load, giveUp).then(settled, settled);
    await vi.waitFor(() => expect(giveUp).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 10));
    expect(load).toHaveBeenCalledTimes(2);
    expect(settled).not.toHaveBeenCalled();
  });
});
