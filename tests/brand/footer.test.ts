// Which footer each page gets (brief WP7, Footer), and that its links are the ones the brief names.
import { describe, expect, it } from 'vitest';
import { FOOTER_GROUPS, REPO_URL, footerKind } from '@/lib/brand/footer';

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

describe('FOOTER_GROUPS', () => {
  it('has the four groups, in order', () => {
    expect(FOOTER_GROUPS.map((g) => g.label)).toEqual(['Product', 'Help', 'For AI assistants', 'Legal']);
  });
  it('links where the brief says', () => {
    const links = Object.fromEntries(FOOTER_GROUPS.flatMap((g) => g.links.map((l) => [l.label, l.href])));
    expect(links).toEqual({
      'Add your shop': '/signup',
      'Log in': '/login',
      Help: '/help',
      'agents.txt': '/agents.txt',
      'llms.txt': '/llms.txt',
      Terms: '/terms',
      Privacy: '/privacy',
      'Open source on GitHub': REPO_URL,
    });
  });
  it('the repository is the one the README clones', () => {
    expect(REPO_URL).toBe('https://github.com/codebreaker32/paypal-ai');
  });
  it('anything that is not a page of the app is a plain link', () => {
    const native = FOOTER_GROUPS.flatMap((g) => g.links).filter((l) => l.native).map((l) => l.href);
    expect(native).toEqual(['/agents.txt', '/llms.txt', REPO_URL]);
  });
});
