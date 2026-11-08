import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRouteProgress, startsRouteNavigation } from '@/lib/feedback/route-progress';

function setup() {
  const settled = vi.fn();
  const progress = createRouteProgress({ onSettled: settled });
  const seen: string[] = [];
  const unsubscribe = progress.subscribe(() => seen.push(progress.getPhase()));
  return { progress, settled, seen, unsubscribe };
}

describe('route progress timing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts idle', () => {
    expect(setup().progress.getPhase()).toBe('idle');
  });

  it('shows nothing for the first 120 ms, then runs', () => {
    const { progress } = setup();
    progress.begin();
    vi.advanceTimersByTime(119);
    expect(progress.getPhase()).toBe('idle');
    vi.advanceTimersByTime(1);
    expect(progress.getPhase()).toBe('start');
  });

  it('moves from the run to the creep 800 ms after it showed', () => {
    const { progress } = setup();
    progress.begin();
    vi.advanceTimersByTime(120 + 799);
    expect(progress.getPhase()).toBe('start');
    vi.advanceTimersByTime(1);
    expect(progress.getPhase()).toBe('creep');
  });

  it('a navigation that lands inside the delay never shows the bar', () => {
    const { progress, seen, settled } = setup();
    progress.begin();
    vi.advanceTimersByTime(80);
    progress.finish();
    vi.advanceTimersByTime(20_000);
    expect(seen).toEqual([]);
    expect(progress.getPhase()).toBe('idle');
    expect(settled).toHaveBeenCalledTimes(1);
  });

  it('finishing a shown bar plays the finish, then goes idle', () => {
    const { progress, seen, settled } = setup();
    progress.begin();
    vi.advanceTimersByTime(300);
    progress.finish();
    expect(progress.getPhase()).toBe('finish');
    expect(settled).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(359);
    expect(progress.getPhase()).toBe('finish');
    vi.advanceTimersByTime(1);
    expect(seen).toEqual(['start', 'finish', 'idle']);
  });

  it('gives up after 10 s when the navigation never lands', () => {
    const { progress, settled } = setup();
    progress.begin();
    vi.advanceTimersByTime(9_999);
    expect(progress.getPhase()).toBe('creep');
    expect(settled).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(progress.getPhase()).toBe('finish');
    expect(settled).toHaveBeenCalledTimes(1);
  });

  it('finish does nothing when no navigation is running', () => {
    const { progress, seen, settled } = setup();
    progress.finish();
    expect(seen).toEqual([]);
    expect(settled).not.toHaveBeenCalled();
  });

  it('a second begin keeps the bar running and restarts the failsafe', () => {
    const { progress, seen } = setup();
    progress.begin();
    vi.advanceTimersByTime(9_000);
    progress.begin();
    vi.advanceTimersByTime(9_000); // 18 s since the first click, 9 s since the second
    expect(progress.getPhase()).toBe('creep');
    expect(seen).toEqual(['start', 'creep']);
    vi.advanceTimersByTime(1_000);
    expect(progress.getPhase()).toBe('finish');
  });

  it('a second begin settles the first navigation so its control is released', () => {
    const { progress, settled } = setup();
    progress.begin();
    vi.advanceTimersByTime(300);
    progress.begin();
    expect(settled).toHaveBeenCalledTimes(1);
  });

  it('a begin during the finish resets the bar and shows it after the delay again', () => {
    const { progress, seen } = setup();
    progress.begin();
    vi.advanceTimersByTime(300);
    progress.finish();
    vi.advanceTimersByTime(100);
    progress.begin();
    expect(progress.getPhase()).toBe('idle');
    vi.advanceTimersByTime(120);
    expect(progress.getPhase()).toBe('start');
    expect(seen).toEqual(['start', 'finish', 'idle', 'start']);
  });

  it('keeps the phase as a stable value between changes and stops telling unsubscribed listeners', () => {
    const { progress, seen, unsubscribe } = setup();
    unsubscribe();
    progress.begin();
    vi.advanceTimersByTime(120);
    expect(seen).toEqual([]);
    expect(progress.getPhase()).toBe(progress.getPhase());
  });
});

describe('startsRouteNavigation', () => {
  const current = 'https://shelfie.test/shops/1?tab=orders';
  const click = {
    url: 'https://shelfie.test/shops/2',
    current,
    target: '',
    download: false,
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
  };

  it.each([
    ['a same-origin page', {}],
    ['the same path with another query', { url: 'https://shelfie.test/shops/1?tab=menu' }],
    ['the same path with the query removed', { url: 'https://shelfie.test/shops/1' }],
    ['another page with a hash', { url: 'https://shelfie.test/help#faq' }],
    ['target _self', { target: '_self' }],
  ])('starts for %s', (_name, change) => {
    expect(startsRouteNavigation({ ...click, ...change })).toBe(true);
  });

  it.each([
    ['another origin', { url: 'https://www.sandbox.paypal.com/checkoutnow' }],
    ['another port', { url: 'https://shelfie.test:8443/shops/2' }],
    ['the same URL', { url: current }],
    ['a hash on this page', { url: `${current}#menu` }],
    ['a mailto link', { url: 'mailto:owner@example.com' }],
    ['a link that opens elsewhere', { target: '_blank' }],
    ['a named target', { target: 'receipt' }],
    ['a download', { download: true }],
    ['the middle button', { button: 1 }],
    ['cmd click', { metaKey: true }],
    ['ctrl click', { ctrlKey: true }],
    ['shift click', { shiftKey: true }],
    ['alt click', { altKey: true }],
    ['an unparseable href', { url: 'http://' }],
  ])('does not start for %s', (_name, change) => {
    expect(startsRouteNavigation({ ...click, ...change })).toBe(false);
  });
});
