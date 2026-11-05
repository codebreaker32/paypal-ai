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

const refused = () => new ApiError(409, 'ITEM_LIVE', '"Focaccia" is already in PayPal. You can mark it sold out or remove it.');
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
      if (++n === 1) throw new ApiError(0, 'NETWORK', "We couldn't reach Shelfie.");
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

  it('a refused item batch does not drop the shop patch from the same flush, and says what was refused', async () => {
    const states: SaveState[] = [];
    const saveShop = vi.fn(async () => {});
    const q = createSaveQueue({
      saveItems: async () => {
        throw refused();
      },
      saveShop,
      onState: (st) => states.push(st),
    });
    q.queueItem({ itemId: 'a', name: 'Focaccia Genovese' });
    q.queueShop({ name: 'Marigold Bakehouse' });
    await expect(q.flush()).rejects.toBeInstanceOf(ApiError);
    expect(saveShop).toHaveBeenCalledWith({ name: 'Marigold Bakehouse' });
    expect(q.hasPending()).toBe(false);
    const last = states.at(-1) as Extract<SaveState, { status: 'error' }>;
    expect(last.retryable).toBe(false);
    expect(last.message).toMatch(/item changes/i);
    expect(last.message).toContain(refused().message);
  });

  it('a retryable item failure keeps the edits for Retry while the shop patch is still sent', async () => {
    const saveShop = vi.fn(async () => {});
    const saveItems = vi.fn(async (): Promise<void> => {
      throw new ApiError(0, 'NETWORK', "We couldn't reach Shelfie.");
    });
    const q = createSaveQueue({ saveItems, saveShop, onState: () => {} });
    q.queueItem({ itemId: 'a', name: 'Rye' });
    q.queueShop({ about: 'Fresh bread daily' });
    await expect(q.flush()).rejects.toBeInstanceOf(ApiError);
    expect(saveShop).toHaveBeenCalledWith({ about: 'Fresh bread daily' });
    expect(q.hasPending()).toBe(true);
    saveItems.mockImplementation(async () => {});
    await q.flush();
    expect(saveItems).toHaveBeenLastCalledWith([{ itemId: 'a', name: 'Rye' }]);
    expect(saveShop).toHaveBeenCalledTimes(1);
  });

  it('the refusal message that stays up names only what was refused, not a retryable failure', async () => {
    const states: SaveState[] = [];
    let shopDown = true;
    const q = createSaveQueue({
      saveItems: async () => {
        throw refused();
      },
      saveShop: async () => {
        if (shopDown) throw new ApiError(0, 'NETWORK', "We couldn't reach Shelfie.");
      },
      onState: (st) => states.push(st),
    });
    q.queueItem({ itemId: 'a', name: 'Focaccia Genovese' });
    q.queueShop({ name: 'Marigold Bakehouse' });
    await expect(q.flush()).rejects.toBeInstanceOf(ApiError);
    expect(states.at(-1)).toMatchObject({ status: 'error', retryable: true });
    // Retry sends the shop patch; what stays up is the item refusal alone.
    shopDown = false;
    await q.flush();
    const last = states.at(-1) as Extract<SaveState, { status: 'error' }>;
    expect(last).toMatchObject({ status: 'error', retryable: false });
    expect(last.message).toContain(refused().message);
    expect(last.message).not.toContain("couldn't reach");
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
