// The seller shell's pure rules: which section a URL means, what each nav link points at, and the one banner it shows.
import { describe, expect, it } from 'vitest';
import { activeSection, routerFollowsPushState, shopStatusWord, menuSummary, pickBanner, sectionFromTab, sectionHref, sectionLabel, sectionTitle } from '@/lib/seller/shell-view';

describe('sectionFromTab', () => {
  it('reads the three named sections and treats anything else as Orders', () => {
    expect(sectionFromTab('menu')).toBe('menu');
    expect(sectionFromTab('share')).toBe('share');
    expect(sectionFromTab('settings')).toBe('settings');
    expect(sectionFromTab('orders')).toBe('orders');
    expect(sectionFromTab(null)).toBe('orders');
    expect(sectionFromTab(undefined)).toBe('orders');
    expect(sectionFromTab('nonsense')).toBe('orders');
  });
});

describe('sectionHref', () => {
  it('sends Orders to the bare dashboard and the others to their tab', () => {
    expect(sectionHref('shp_1', 'orders')).toBe('/shops/shp_1');
    expect(sectionHref('shp_1', 'menu')).toBe('/shops/shp_1?tab=menu');
    expect(sectionHref('shp_1', 'share')).toBe('/shops/shp_1?tab=share');
    expect(sectionHref('shp_1', 'settings')).toBe('/shops/shp_1?tab=settings');
  });
});

describe('sectionLabel and sectionTitle', () => {
  it('names each section for the nav and for the browser tab', () => {
    expect(sectionLabel('orders')).toBe('Orders');
    expect(sectionLabel('settings')).toBe('Settings');
    expect(sectionTitle('menu', 'Rosa Bakes')).toBe('Menu · Rosa Bakes · Shelfie');
  });
});

describe('activeSection', () => {
  const at = (path: string, tab?: string) => activeSection('shp_1', path, tab ?? null);
  it('follows ?tab on the dashboard', () => {
    expect(at('/shops/shp_1')).toBe('orders');
    expect(at('/shops/shp_1', 'menu')).toBe('menu');
    expect(at('/shops/shp_1', 'share')).toBe('share');
    expect(at('/shops/shp_1', 'settings')).toBe('settings');
  });
  it('keeps Orders active on order detail and Share active on the counter card', () => {
    expect(at('/shops/shp_1/orders/ord_9')).toBe('orders');
    expect(at('/shops/shp_1/card')).toBe('share');
  });
  it('marks nothing on setup', () => {
    expect(at('/shops/shp_1/setup')).toBeNull();
  });
});

describe('pickBanner', () => {
  const calm = { paypalDown: false, payeeMissing: false, status: 'live', recoveryUnsaved: false } as const;
  it('shows nothing when all is well', () => {
    expect(pickBanner(calm)).toBeNull();
  });
  it('shows one banner at a time, in priority order', () => {
    const all = { paypalDown: true, payeeMissing: true, status: 'paused', recoveryUnsaved: true } as const;
    expect(pickBanner(all)).toBe('paypal-down');
    expect(pickBanner({ ...all, paypalDown: false })).toBe('payee-missing');
    expect(pickBanner({ ...all, paypalDown: false, payeeMissing: false })).toBe('paused');
    expect(pickBanner({ ...all, paypalDown: false, payeeMissing: false, status: 'live' })).toBe('recovery-key');
  });
  it('does not ask a draft for its PayPal email: setup does', () => {
    expect(pickBanner({ ...calm, payeeMissing: true, status: 'draft' })).toBeNull();
  });
});

describe('menuSummary', () => {
  it('counts the items, the seller’s own photos and the examples', () => {
    expect(menuSummary({ total: 10, own: 4, examples: 6 })).toBe('10 items · 4 your photos · 6 examples');
  });
  it('uses the singular for one', () => {
    expect(menuSummary({ total: 1, own: 1, examples: 1 })).toBe('1 item · 1 your photo · 1 example');
  });
});

describe('shopStatusWord', () => {
  it('names the state, and a shop that cannot be paid says so before anything else', () => {
    expect(shopStatusWord('live', false)).toEqual({ tone: 'ok', word: 'Live' });
    expect(shopStatusWord('paused', false)).toEqual({ tone: 'warn', word: 'Paused' });
    expect(shopStatusWord('draft', false)).toEqual({ tone: 'neutral', word: 'Draft' });
    expect(shopStatusWord('live', true)).toEqual({ tone: 'warn', word: 'Not taking orders' });
    expect(shopStatusWord('paused', true)).toEqual({ tone: 'warn', word: 'Not taking orders' });
    expect(shopStatusWord('draft', true)).toEqual({ tone: 'neutral', word: 'Draft' });
  });
});

describe('routerFollowsPushState', () => {
  it('is false for a browser native (history.pushState before the router patches it)', () => {
    expect(routerFollowsPushState(Array.prototype.push)).toBe(false);
  });

  it('is false for a bound native, which is what Next puts back when it unmounts', () => {
    expect(routerFollowsPushState(Array.prototype.push.bind([]))).toBe(false);
  });

  it('is true for a script-defined wrapper (Next\'s patch)', () => {
    expect(routerFollowsPushState(function pushState() {})).toBe(true);
  });

  it('is false for anything that is not a function', () => {
    expect(routerFollowsPushState(undefined)).toBe(false);
  });
});

