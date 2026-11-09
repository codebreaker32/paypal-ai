// The public header's table of states (brief WP6, Header).
import { describe, expect, it } from 'vitest';
import { headerView } from '@/lib/brand/header';

const out = { account: null, ownerShopIds: [] as string[] };
const inside = { account: { email: 'rosa@example.com' }, ownerShopIds: [] as string[] };

describe('headerView', () => {
  it.each(['/s/marigold', '/s', '/o/SHF-123'])('is the logo alone on the buyer page %s', (pathname) => {
    expect(headerView({ pathname, ...out })).toEqual({ kind: 'bare', logoHref: '/' });
  });

  it('never shows a dashboard link on buyer pages', () => {
    expect(headerView({ pathname: '/s/m', account: null, ownerShopIds: ['a'] }).kind).toBe('bare');
  });

  it('a logged-in seller on a buyer page still only sees the logo, pointing at their shops', () => {
    expect(headerView({ pathname: '/s/m', ...inside })).toEqual({ kind: 'bare', logoHref: '/shops' });
  });

  it.each([['/shops'], ['/account'], ['/'], ['/help'], ['/shops/new']])('shows the account menu on %s when logged in', (pathname) => {
    expect(headerView({ pathname, ...inside })).toEqual({ kind: 'account', logoHref: '/shops', email: 'rosa@example.com' });
  });

  it('does not treat a path that only starts with a buyer prefix as a buyer page', () => {
    expect(headerView({ pathname: '/shops', ...out }).kind).toBe('public');
    expect(headerView({ pathname: '/ok', ...out }).kind).toBe('public');
  });

  it.each([
    ['/login', 'New to Shelfie?', 'Add your shop', '/signup'],
    ['/signup', 'Have an account?', 'Log in', '/login'],
    ['/recover', 'Have an account?', 'Log in', '/login'],
  ])('on %s offers the other door', (pathname, prompt, label, href) => {
    expect(headerView({ pathname, ...out })).toEqual({ kind: 'auth', logoHref: '/', prompt, label, href });
  });

  it('logged out with no owner cookie: Log in and Add your shop, no dashboard', () => {
    expect(headerView({ pathname: '/', ...out })).toEqual({ kind: 'public', logoHref: '/', dashboardHref: null });
  });

  it('logged out with one owner cookie links straight to that shop', () => {
    expect(headerView({ pathname: '/help', account: null, ownerShopIds: ['s1'] })).toEqual({
      kind: 'public',
      logoHref: '/',
      dashboardHref: '/shops/s1',
    });
  });

  it('logged out with several owner cookies goes to the start page, and hides the link on it', () => {
    const shops = { account: null, ownerShopIds: ['s1', 's2'] };
    expect(headerView({ pathname: '/help', ...shops })).toMatchObject({ dashboardHref: '/' });
    expect(headerView({ pathname: '/', ...shops })).toMatchObject({ dashboardHref: null });
  });

  it('with one owner cookie the link stays on the start page', () => {
    expect(headerView({ pathname: '/', account: null, ownerShopIds: ['s1'] })).toMatchObject({ dashboardHref: '/shops/s1' });
  });

  it('no owner shortcut on the auth pages', () => {
    expect(headerView({ pathname: '/login', account: null, ownerShopIds: ['s1'] }).kind).toBe('auth');
  });
});
