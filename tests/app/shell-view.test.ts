// The seller shell's pure rules: which section a URL means, what each nav link points at, and the one banner it shows.
import { describe, expect, it } from 'vitest';
import { activeSection, pickBanner, sectionFromTab, sectionHref, sectionLabel, sectionTitle } from '@/lib/seller/shell-view';

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
