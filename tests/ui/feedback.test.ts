import { afterEach, describe, expect, it, vi } from 'vitest';
import { feedback } from '@/lib/feedback';

describe('feedback', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each(['success', 'error'] as const)('dispatches shelfie:feedback with the event name for %s', (event) => {
    const target = new EventTarget();
    vi.stubGlobal('window', target);
    const seen: unknown[] = [];
    target.addEventListener('shelfie:feedback', (e) => seen.push((e as CustomEvent).detail));

    feedback(event);

    expect(seen).toEqual([{ event }]);
  });

  it('does nothing on the server, where there is no window', () => {
    expect(typeof window).toBe('undefined');
    expect(() => feedback('success')).not.toThrow();
  });
});
