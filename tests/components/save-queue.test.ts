// The review screen's autosave queue (useAutosave wraps it): retryable failures keep the edits for
// Retry; a save the server refuses (4xx) is dropped, its message stays up, and the screen is asked
// to show the server's version once nothing else is waiting.
import { describe, expect, it, vi } from 'vitest';
import { ApiError, type ItemUpdate } from '@/components/setup/api';
import { createSaveQueue, type SaveState } from '@/components/setup/save-queue';

function setup(saveItems: (u: ItemUpdate[]) => Promise<unknown>) {
  const states: SaveState[] = [];
  const onRejected = vi.fn();
  const save = vi.fn(saveItems);
  const q = createSaveQueue({ saveItems: save, saveShop: async () => {}, onState: (s) => states.push(s), onRejected });
  return { q, save, states, onRejected, last: () => states.at(-1) };
}

const refused = () => new ApiError('ITEM_LIVE', '"Focaccia" is already in PayPal. You can mark it sold out or remove it.', 409);
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('createSaveQueue', () => {
  it('saves queued edits in one batch', async () => {
    const { q, save, last, onRejected } = setup(async () => {});
    q.queueItem({ itemId: 'a', name: 'Rye' });
    q.queueItem({ itemId: 'a', resolveIssues: true });
    q.queueItem({ itemId: 'b', status: 'removed' });
    await q.flush();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0]).toEqual([{ itemId: 'a', name: 'Rye', resolveIssues: true }, { itemId: 'b', status: 'removed', resolveIssues: undefined }]);
    expect(last()).toEqual({ status: 'saved' });
    expect(onRejected).not.toHaveBeenCalled();
  });

  it('a refused save is dropped, keeps its message, and asks for the server version once', async () => {
    const { q, save, last, onRejected } = setup(async () => {
      throw refused();
    });
    q.queueItem({ itemId: 'a', name: 'Focaccia Genovese' }, { immediate: true });
    await expect(q.flush()).rejects.toBeInstanceOf(ApiError);
    expect(last()).toEqual({ status: 'error', message: refused().message, retryable: false });
    await tick();
    expect(onRejected).toHaveBeenCalledTimes(1);
    // Nothing is kept for a retry: the refused batch is gone.
    expect(q.hasPending()).toBe(false);
    await q.flush();
    expect(save).toHaveBeenCalledTimes(1);
    expect(onRejected).toHaveBeenCalledTimes(1);
  });

  it('a refused save waits for edits made meanwhile, then asks for the server version; the message stays', async () => {
    let fail!: (e: unknown) => void;
    let n = 0;
    const { q, save, last, onRejected } = setup((u) => {
      n++;
      return n === 1 ? new Promise((_, reject) => (fail = reject)) : Promise.resolve(u);
    });
    q.queueItem({ itemId: 'a', name: 'Focaccia Genovese' });
    const first = q.flush();
    await tick();
    q.queueItem({ itemId: 'b', name: 'Seeded rye' }); // typed while the first save is out
    fail(refused());
    await expect(first).rejects.toBeInstanceOf(ApiError);
    await tick();
    expect(onRejected).not.toHaveBeenCalled(); // "Seeded rye" still has to save first
    await q.flush();
    expect(save.mock.calls[1][0]).toEqual([{ itemId: 'b', name: 'Seeded rye', resolveIssues: undefined }]);
    await tick();
    expect(onRejected).toHaveBeenCalledTimes(1);
    expect(last()).toEqual({ status: 'error', message: refused().message, retryable: false });
  });

  it('a retryable failure keeps the edits for Retry and does not reload the screen', async () => {
    let n = 0;
    const { q, save, last, onRejected } = setup(async () => {
      if (++n === 1) throw new ApiError('NETWORK', "We couldn't reach Shelfie.", 0);
    });
    q.queueItem({ itemId: 'a', name: 'Rye' });
    await expect(q.flush()).rejects.toBeInstanceOf(ApiError);
    expect(last()).toMatchObject({ status: 'error', retryable: true });
    expect(q.hasPending()).toBe(true);
    await q.flush();
    expect(save.mock.calls[1][0]).toEqual(save.mock.calls[0][0]);
    expect(last()).toEqual({ status: 'saved' });
    await tick();
    expect(onRejected).not.toHaveBeenCalled();
  });

  it('a new edit after a refusal clears the message', async () => {
    let n = 0;
    const { q, last } = setup(async () => {
      if (++n === 1) throw refused();
    });
    q.queueItem({ itemId: 'a', name: 'X' });
    await q.flush().catch(() => {});
    q.queueItem({ itemId: 'b', soldOut: true });
    expect(last()).toEqual({ status: 'pending' });
    await q.flush();
    expect(last()).toEqual({ status: 'saved' });
  });
});
