import { describe, expect, it, vi } from 'vitest';
import { loadWithRetry, whenStreamSettled } from '@/components/motion/load-features';

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

describe('whenStreamSettled', () => {
  // A stand-in for the document: its readyState and the data of its comment nodes (React's boundary markers).
  const fakeDoc = (readyState: DocumentReadyState, markers: string[]) => ({ readyState, markers });
  const pendingIn = (doc: { markers: string[] }) => doc.markers.some((m) => m === '$?' || m === '$~');

  it('resolves at once when the stream is done and no boundary waits to be revealed', async () => {
    const doc = fakeDoc('complete', ['$', '/$']);
    await expect(whenStreamSettled(doc, { hasPending: pendingIn, interval: 5, timeout: 1000 })).resolves.toBe('settled');
  });

  it('waits while the page is still streaming or a boundary is pending, then resolves', async () => {
    const doc = fakeDoc('loading', ['$?', '/$']);
    const done = vi.fn();
    whenStreamSettled(doc, { hasPending: pendingIn, interval: 5, timeout: 1000 }).then(done);
    await new Promise((r) => setTimeout(r, 30));
    expect(done).not.toHaveBeenCalled();
    doc.readyState = 'complete';
    doc.markers = ['$~', '/$']; // complete on the server, its reveal still queued
    await new Promise((r) => setTimeout(r, 30));
    expect(done).not.toHaveBeenCalled();
    doc.markers = ['$', '/$'];
    await vi.waitFor(() => expect(done).toHaveBeenCalledWith('settled'));
  });

  it('gives up waiting after the timeout, so motion still loads on a page whose boundary never resolves', async () => {
    const doc = fakeDoc('complete', ['$?']);
    await expect(whenStreamSettled(doc, { hasPending: pendingIn, interval: 5, timeout: 40 })).resolves.toBe('timeout');
  });

  it('resolves at once without a document (server render)', async () => {
    await expect(whenStreamSettled(undefined)).resolves.toBe('settled');
  });
});
