import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { vibrate, type VibrationEvent } from '@/lib/feedback/haptics';

const KEY = 'shelfie:feedback:v1';

describe('vibrate', () => {
  let store: Map<string, string>;
  let spy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    store = new Map();
    spy = vi.fn(() => true);
    vi.stubGlobal('localStorage', { getItem: (key: string) => store.get(key) ?? null, setItem: () => {} });
    vi.stubGlobal('navigator', { vibrate: spy });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each<[VibrationEvent, number | number[]]>([
    ['add', 10],
    ['flip', 10],
    ['success', [10, 40, 14]],
    ['error', [20, 40, 20]],
    ['order', [16, 60, 24]],
  ])('plays the pattern for %s', (event, pattern) => {
    vibrate(event);
    expect(spy).toHaveBeenCalledExactlyOnceWith(pattern);
  });

  it('does nothing when the switch is off', () => {
    store.set(KEY, 'false');
    vibrate('success');
    expect(spy).not.toHaveBeenCalled();
  });

  it('holds off until the page has had a gesture, where the browser would refuse and log it', () => {
    vi.stubGlobal('navigator', { vibrate: spy, userActivation: { hasBeenActive: false } });
    vibrate('order');
    expect(spy).not.toHaveBeenCalled();
  });

  it('vibrates once the page has had a gesture', () => {
    vi.stubGlobal('navigator', { vibrate: spy, userActivation: { hasBeenActive: true } });
    vibrate('order');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('does nothing on a device with no vibration', () => {
    vi.stubGlobal('navigator', {});
    expect(() => vibrate('success')).not.toThrow();
  });

  it('does nothing on the server, where there is no navigator', () => {
    vi.stubGlobal('navigator', undefined);
    expect(() => vibrate('success')).not.toThrow();
  });

  it('survives a vibrate call that throws', () => {
    vi.stubGlobal('navigator', {
      vibrate: () => {
        throw new Error('no');
      },
    });
    expect(() => vibrate('error')).not.toThrow();
  });
});
