// Which footer each page gets, and that its links are the intended ones.
import { describe, expect, it } from 'vitest';
import { FOOTER_GROUPS, REPO_URL, footerKind } from '@/lib/brand/footer';

describe('footerKind', () => {
  it.each(['/', '/browse', '/help', '/terms', '/privacy', '/help/'])('%s gets the full footer', (p) => {
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
  const all = FOOTER_GROUPS.flatMap((g) => g.links);
  it('has three titled columns, in order', () => {
    expect(FOOTER_GROUPS.map((g) => [g.title, g.links.map((l) => l.label)])).toEqual([
      ['Shelfie', ['Browse shops', 'How it works', 'FAQ', 'Help']],
      ['For AI assistants', ['agents.txt', 'llms.txt']],
      ['The project', ['Terms', 'Privacy', 'Open source on GitHub']],
    ]);
  });
  it('links to the intended pages', () => {
    expect(Object.fromEntries(all.map((l) => [l.label, l.href]))).toEqual({
      'Browse shops': '/browse',
      'How it works': '/#how-it-works',
      FAQ: '/#faq',
      Help: '/help',
      Terms: '/terms',
      Privacy: '/privacy',
      'Open source on GitHub': REPO_URL,
      'agents.txt': '/agents.txt',
      'llms.txt': '/llms.txt',
    });
  });
  it('the repository is the one the README clones', () => {
    expect(REPO_URL).toBe('https://github.com/codebreaker32/paypal-ai');
  });
  it('anything that is not a page of the app is a plain link', () => {
    expect(all.filter((l) => l.native).map((l) => l.href)).toEqual(['/agents.txt', '/llms.txt', REPO_URL]);
  });
});
