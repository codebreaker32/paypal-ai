import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createActionRunner, useAction } from '@/lib/feedback/use-action';

/** A promise the test settles by hand, so each status can be observed. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setup(fn: (...args: never[]) => Promise<unknown>, successMs = 1400) {
  const notified: string[] = [];
  const runner = createActionRunner(fn as (...args: unknown[]) => Promise<unknown>, {
    successMs,
    notify: (event) => notified.push(event),
  });
  return { runner, notified, status: () => runner.getSnapshot().status, error: () => runner.getSnapshot().error };
}

describe('createActionRunner', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts idle with no error', () => {
    const { status, error } = setup(async () => {});
    expect(status()).toBe('idle');
    expect(error()).toBeNull();
  });

  it('is loading as soon as run is called, before the action settles', () => {
    const job = deferred<string>();
    const { runner, status } = setup(() => job.promise);
    void runner.run();
    expect(status()).toBe('loading');
  });

  it('passes the arguments through and resolves with the result', async () => {
    const fn = vi.fn(async (a: number, b: number) => a + b);
    const { runner } = setup(fn as never);
    await expect(runner.run(2, 3)).resolves.toBe(5);
    expect(fn).toHaveBeenCalledWith(2, 3);
  });

  it('shows success, reports it once, then returns to idle after successMs', async () => {
    const { runner, status, notified } = setup(async () => 'ok', 1400);
    await runner.run();
    expect(status()).toBe('success');
    expect(notified).toEqual(['success']);
    vi.advanceTimersByTime(1399);
    expect(status()).toBe('success');
    vi.advanceTimersByTime(1);
    expect(status()).toBe('idle');
    expect(notified).toEqual(['success']);
  });

  it('honours a custom successMs', async () => {
    const { runner, status } = setup(async () => 'ok', 300);
    await runner.run();
    vi.advanceTimersByTime(300);
    expect(status()).toBe('idle');
  });

  it('on failure goes back to idle, keeps the message, reports error, and never rejects', async () => {
    const { runner, status, error, notified } = setup(async () => {
      throw new Error('PayPal said no');
    });
    await expect(runner.run()).resolves.toBeUndefined();
    expect(status()).toBe('idle');
    expect(error()).toBe('PayPal said no');
    expect(notified).toEqual(['error']);
  });

  it('uses a plain sentence when the failure is not an Error', async () => {
    const { runner, error } = setup(() => Promise.reject('boom'));
    await runner.run();
    expect(error()).toBe('Something went wrong. Try again.');
  });

  it('clears the last error when a new run starts', async () => {
    let fail = true;
    const job = deferred<string>();
    const { runner, error } = setup(() => {
      if (fail) throw new Error('nope');
      return job.promise;
    });
    await runner.run();
    expect(error()).toBe('nope');
    fail = false;
    void runner.run();
    expect(error()).toBeNull();
  });

  it('ignores a second run while the first is in flight', async () => {
    const job = deferred<string>();
    const fn = vi.fn(() => job.promise);
    const { runner, notified } = setup(fn);
    const first = runner.run();
    await expect(runner.run()).resolves.toBeUndefined();
    expect(fn).toHaveBeenCalledTimes(1);
    job.resolve('done');
    await expect(first).resolves.toBe('done');
    expect(notified).toEqual(['success']);
  });

  it('a run during the success window restarts cleanly: the old timer cannot end it', async () => {
    const job = deferred<string>();
    let call = 0;
    const { runner, status } = setup(() => (++call === 1 ? Promise.resolve('one') : job.promise));
    await runner.run();
    vi.advanceTimersByTime(1000);
    void runner.run();
    vi.advanceTimersByTime(1000); // past the first success's return to idle
    expect(status()).toBe('loading');
  });

  it('tells subscribers about each change and stops after unsubscribe', async () => {
    const { runner } = setup(async () => 'ok', 100);
    const seen: string[] = [];
    const unsubscribe = runner.subscribe(() => seen.push(runner.getSnapshot().status));
    await runner.run();
    expect(seen).toEqual(['loading', 'success']);
    unsubscribe();
    vi.advanceTimersByTime(100);
    expect(seen).toEqual(['loading', 'success']);
  });

  it('keeps the snapshot identity between changes, as useSyncExternalStore needs', () => {
    const { runner } = setup(async () => {});
    expect(runner.getSnapshot()).toBe(runner.getSnapshot());
  });

  it('update makes the next run use the newest function and successMs', async () => {
    const first = vi.fn(async () => 'first');
    const second = vi.fn(async () => 'second');
    const { runner, status } = setup(first, 1400);
    runner.update(second as never, 200);
    await expect(runner.run()).resolves.toBe('second');
    expect(first).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(status()).toBe('idle');
  });

  it('stop cancels the pending return to idle', async () => {
    const { runner, status } = setup(async () => 'ok', 100);
    await runner.run();
    runner.stop();
    vi.advanceTimersByTime(500);
    expect(status()).toBe('success');
  });
});

describe('useAction', () => {
  it('renders on the server as idle with no error', () => {
    let seen: unknown;
    function Probe() {
      const { status, error, run } = useAction(async () => 'ok');
      seen = { status, error, run: typeof run };
      return null;
    }
    renderToStaticMarkup(createElement(Probe));
    expect(seen).toEqual({ status: 'idle', error: null, run: 'function' });
  });
});
