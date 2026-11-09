// `Share…` on the shop-link row: only on a touch device whose browser has the share sheet. Closing the sheet is the
// visitor's choice, not a failure; anything else shows the same toast a refused clipboard does.
import { describe, expect, it, vi } from 'vitest';
import { canNativeShare, shareAndReport } from '@/components/ui/share-button';

const data = { title: 'Rosa Bakes', url: 'https://shelfie.example/s/rosa' };
const failed = { title: 'Couldn’t copy', description: 'Select the text and copy it yourself.', tone: 'danger' };

describe('canNativeShare', () => {
  const share = async () => {};

  it('needs both the share sheet and a coarse pointer', () => {
    expect(canNativeShare({ share }, true)).toBe(true);
    expect(canNativeShare({ share }, false)).toBe(false);
    expect(canNativeShare({}, true)).toBe(false);
    expect(canNativeShare({}, false)).toBe(false);
  });
});

describe('shareAndReport', () => {
  it('passes the link to the share sheet and stays quiet when it works', async () => {
    const toast = vi.fn();
    const share = vi.fn(async () => {});
    await shareAndReport(data, toast, share);
    expect(share).toHaveBeenCalledWith(data);
    expect(toast).not.toHaveBeenCalled();
  });

  it('ignores AbortError: the seller closed the sheet', async () => {
    const toast = vi.fn();
    await shareAndReport(data, toast, () => Promise.reject(new DOMException('Share canceled', 'AbortError')));
    expect(toast).not.toHaveBeenCalled();
  });

  it('shows the failure toast for any other error', async () => {
    for (const error of [new DOMException('Not allowed', 'NotAllowedError'), new TypeError('bad data'), 'nope', undefined]) {
      const toast = vi.fn();
      await shareAndReport(data, toast, () => Promise.reject(error));
      expect(toast).toHaveBeenCalledExactlyOnceWith(failed);
    }
  });

  it('shows the failure toast when the call itself throws', async () => {
    const toast = vi.fn();
    await shareAndReport(data, toast, () => {
      throw new TypeError('not callable');
    });
    expect(toast).toHaveBeenCalledExactlyOnceWith(failed);
  });

  describe('a second tap while a share is open', () => {
    const inFlight = () => ({ current: false });
    const stillOpen = () => new DOMException('An earlier share has not yet completed.', 'InvalidStateError');

    it('never reaches the share sheet and shows no toast', async () => {
      const toast = vi.fn();
      let finish = () => {};
      const share = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
      const pending = inFlight();

      const first = shareAndReport(data, toast, share, pending);
      await shareAndReport(data, toast, () => Promise.reject(stillOpen()), pending);
      await shareAndReport(data, toast, share, pending);

      expect(share).toHaveBeenCalledTimes(1);
      expect(toast).not.toHaveBeenCalled();
      finish();
      await first;
    });

    it('lets the next share through once the first one ends, however it ended', async () => {
      const endings: Array<() => Promise<void>> = [
        async () => {},
        () => Promise.reject(new DOMException('Share canceled', 'AbortError')),
        () => Promise.reject(new TypeError('bad data')),
        () => {
          throw new TypeError('not callable');
        },
      ];
      for (const ending of endings) {
        const pending = inFlight();
        await shareAndReport(data, vi.fn(), ending, pending);
        const share = vi.fn(async () => {});
        await shareAndReport(data, vi.fn(), share, pending);
        expect(share).toHaveBeenCalledTimes(1);
      }
    });
  });
});
