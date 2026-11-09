import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const KEY = 'shelfie:feedback:v1';

function stubStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
  });
  return store;
}

function stubBrokenStorage() {
  const boom = () => {
    throw new Error('storage is blocked');
  };
  vi.stubGlobal('localStorage', { getItem: boom, setItem: boom });
}

const load = () => import('@/lib/feedback/prefs');

describe('feedback preference', () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is on when nothing was ever saved', async () => {
    stubStorage();
    const { isFeedbackOn } = await load();
    expect(isFeedbackOn()).toBe(true);
  });

  it('is on when the saved value is garbage', async () => {
    stubStorage({ [KEY]: 'banana' });
    const { isFeedbackOn } = await load();
    expect(isFeedbackOn()).toBe(true);
  });

  it('saves off under the versioned key, and a fresh page load reads it back', async () => {
    const store = stubStorage();
    (await load()).setFeedbackOn(false);
    expect(store.get(KEY)).toBe('false');

    vi.resetModules();
    expect((await load()).isFeedbackOn()).toBe(false);
  });

  it('turns back on', async () => {
    stubStorage({ [KEY]: 'false' });
    const { isFeedbackOn, setFeedbackOn } = await load();
    setFeedbackOn(true);
    expect(isFeedbackOn()).toBe(true);
  });

  it('is on, and does not throw, when there is no localStorage at all', async () => {
    const { isFeedbackOn, setFeedbackOn } = await load();
    expect(typeof localStorage).toBe('undefined');
    expect(isFeedbackOn()).toBe(true);
    expect(() => setFeedbackOn(false)).not.toThrow();
  });

  it('is on when reading storage throws', async () => {
    stubBrokenStorage();
    const { isFeedbackOn } = await load();
    expect(isFeedbackOn()).toBe(true);
  });

  it('keeps the choice for this page when saving throws', async () => {
    stubBrokenStorage();
    const { isFeedbackOn, setFeedbackOn } = await load();
    setFeedbackOn(false);
    expect(isFeedbackOn()).toBe(false);
  });

  it('tells subscribers about a change, and stops once unsubscribed', async () => {
    stubStorage();
    const { setFeedbackOn, subscribeFeedback } = await load();
    const listener = vi.fn();
    const unsubscribe = subscribeFeedback(listener);

    setFeedbackOn(false);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    setFeedbackOn(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('hears a change from another tab, only for its own key', async () => {
    stubStorage();
    const target = new EventTarget();
    vi.stubGlobal('window', target);
    const { subscribeFeedback } = await load();
    const listener = vi.fn();
    const unsubscribe = subscribeFeedback(listener);

    target.dispatchEvent(Object.assign(new Event('storage'), { key: 'shelfie:cart:x' }));
    expect(listener).not.toHaveBeenCalled();

    target.dispatchEvent(Object.assign(new Event('storage'), { key: KEY }));
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    target.dispatchEvent(Object.assign(new Event('storage'), { key: KEY }));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('renders as on from the server, whatever is saved, so hydration matches', async () => {
    stubStorage({ [KEY]: 'false' });
    const { useFeedbackOn } = await load();
    function Probe() {
      return createElement('i', null, String(useFeedbackOn()));
    }
    expect(renderToStaticMarkup(createElement(Probe))).toBe('<i>true</i>');
  });
});
