// Where login may send you (SR4): only our own seller pages, never another site or an open redirect.
import { describe, expect, it } from 'vitest';
import { loginPath, safeNext } from '@/lib/auth/next-path';

describe('safeNext', () => {
  it.each([
    ['/shops', '/shops'],
    ['/shops/new', '/shops/new'],
    ['/shops/shp_abc123', '/shops/shp_abc123'],
    ['/shops/shp_abc123/orders?tab=open', '/shops/shp_abc123/orders?tab=open'],
    ['/account', '/account'],
    ['/account#recovery-key', '/account#recovery-key'],
  ])('accepts %s', (input, expected) => {
    expect(safeNext(input)).toBe(expected);
  });

  it.each([
    ['//evil.example'],
    ['///evil.example'],
    ['/\\evil.example'],
    ['\\\\evil.example'],
    ['https://evil.example'],
    ['https://evil.example/shops'],
    ['http:evil.example'],
    ['javascript:alert(1)'],
    ['/api/x'],
    ['/claim/x'],
    ['/'],
    ['/login'],
    ['/shops/../claim/x'],
    ['/shops/%2e%2e/claim/x'],
    ['/shops/../../claim/x'],
    ['/shopsevil'],
    ['/accounts'],
    ['/account/x'],
  ])('rejects %s', (input) => {
    expect(safeNext(input)).toBeNull();
  });

  it.each([
    ['tab', '/shops\t'],
    ['newline', '/shops\n'],
    ['carriage return', '/sh\rops'],
    ['newline in a path that then looks fine', '/\n/evil.example'],
    ['NUL', '/shops\0'],
    ['DEL', '/shops\x7f'],
    ['a C1 control', '/shops\x85'],
  ])('rejects a control character: %s', (_name, input) => {
    expect(safeNext(input)).toBeNull();
  });

  it('rejects anything that is not a non-empty string', () => {
    for (const bad of [undefined, null, '', 42, ['/shops'], { path: '/shops' }]) expect(safeNext(bad)).toBeNull();
  });
});

describe('loginPath', () => {
  it('is plain /login with nothing to come back to', () => {
    expect(loginPath()).toBe('/login');
  });

  it('carries the path back, with readable slashes', () => {
    expect(loginPath('/shops/shp_abc')).toBe('/login?next=/shops/shp_abc');
  });

  it('encodes anything that could break out of the query', () => {
    expect(loginPath('/shops?a=1&b=2')).toBe('/login?next=/shops%3Fa%3D1%26b%3D2');
    expect(loginPath('/shops#x')).toBe('/login?next=/shops%23x');
  });
});
