// Which footer each page gets (brief WP7, Footer), and that its links are the ones the brief names.
import { describe, expect, it } from 'vitest';
import { FOOTER_NAV, FOOTER_SMALL, REPO_URL, footerKind } from '@/lib/brand/footer';

describe('footerKind', () => {
  it.each(['/', '/help', '/terms', '/privacy', '/help/'])('%s gets the full footer', (p) => {
    expect(footerKind(p)).toBe('site');
  });
  it.each(['/s/marigold-bakehouse', '/s/marigold-bakehouse/mcp', '/o/SHF-1', '/s', '/o'])('%s is a buyer page', (p) => {
    expect(footerKind(p)).toBe('buyer');
  });
  it.each(['/shops', '/shops/new', '/account', '/shops/shp_1/setup', '/login', '/signup', '/recover', '/no-such-page'])(
    '%s gets the one-row footer',
    (p) => {
      expect(footerKind(p)).toBe('compact');
    },
  );
  it('a path that merely starts like a buyer or site page is not one', () => {
    expect(footerKind('/shelf')).toBe('compact');
    expect(footerKind('/helpful')).toBe('compact');
    expect(footerKind('/order')).toBe('compact');
  });
});

describe('the site footer links', () => {
  const all = [...FOOTER_NAV, ...FOOTER_SMALL];
  it('has the four main links, in order', () => {
    expect(FOOTER_NAV.map((l) => l.label)).toEqual(['Product', 'Help', 'Legal', 'Open Source']);
  });
  it('links where the brief says', () => {
    expect(Object.fromEntries(all.map((l) => [l.label, l.href]))).toEqual({
      Product: '/#how-it-works',
      Help: '/help',
      Legal: '/terms',
      'Open Source': REPO_URL,
      Privacy: '/privacy',
      'agents.txt': '/agents.txt',
      'llms.txt': '/llms.txt',
    });
  });
  it('the repository is the one the README clones', () => {
    expect(REPO_URL).toBe('https://github.com/codebreaker32/paypal-ai');
  });
  it('anything that is not a page of the app is a plain link', () => {
    expect(all.filter((l) => l.native).map((l) => l.href)).toEqual([REPO_URL, '/agents.txt', '/llms.txt']);
  });
});
