// SR1 (no proxy) and SR3 (the origin rules behind assertSameOrigin).
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { assertSameOrigin } from '@/lib/http/same-origin';

const req = (headers: Record<string, string>) => new Request('http://internal:3000/api/x', { method: 'POST', headers });

async function expectRefused(res: Response | null) {
  expect(res).not.toBeNull();
  expect(res!.status).toBe(403);
  expect((await res!.json()).error.code).toBe('BAD_ORIGIN');
}

describe('assertSameOrigin', () => {
  beforeEach(() => {
    vi.stubEnv('APP_URL', 'https://shelfie.example');
    vi.stubEnv('RENDER_EXTERNAL_URL', '');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('passes an Origin whose host equals the Host header', () => {
    expect(assertSameOrigin(req({ origin: 'http://localhost:3100', host: 'localhost:3100' }))).toBeNull();
  });

  it('passes an Origin whose host equals X-Forwarded-Host, which wins over Host', () => {
    expect(assertSameOrigin(req({ origin: 'https://proxy.example', host: 'internal:3000', 'x-forwarded-host': 'proxy.example' }))).toBeNull();
  });

  it('takes the first X-Forwarded-Host entry when a proxy chain sends several', () => {
    expect(assertSameOrigin(req({ origin: 'https://proxy.example', 'x-forwarded-host': 'proxy.example, internal:3000' }))).toBeNull();
  });

  it('passes an Origin whose host equals APP_URL\'s', () => {
    expect(assertSameOrigin(req({ origin: 'https://shelfie.example', host: 'internal:3000' }))).toBeNull();
  });

  it('compares hosts case-insensitively', () => {
    expect(assertSameOrigin(req({ origin: 'http://LocalHost:3100', host: 'LOCALHOST:3100' }))).toBeNull();
  });

  it('refuses another site', async () => {
    await expectRefused(assertSameOrigin(req({ origin: 'https://evil.example', host: 'localhost:3100' })));
  });

  it('refuses a host that merely starts with ours', async () => {
    await expectRefused(assertSameOrigin(req({ origin: 'https://shelfie.example.evil.example', host: 'shelfie.example' })));
  });

  it('with X-Forwarded-Host present, does not fall back to Host', async () => {
    await expectRefused(assertSameOrigin(req({ origin: 'http://internal:3000', host: 'internal:3000', 'x-forwarded-host': 'proxy.example' })));
  });

  it('refuses Origin: null', async () => {
    await expectRefused(assertSameOrigin(req({ origin: 'null', host: 'localhost:3100' })));
  });

  it('refuses an unparsable Origin', async () => {
    await expectRefused(assertSameOrigin(req({ origin: 'not a url', host: 'localhost:3100' })));
  });

  it('refuses an Origin with no host, even when there is no Host header to compare with', async () => {
    await expectRefused(assertSameOrigin(req({ origin: 'file:///etc/passwd' })));
  });

  it('with no Origin: passes same-origin, same-site, none and a missing Sec-Fetch-Site', () => {
    expect(assertSameOrigin(req({ host: 'localhost:3100' }))).toBeNull();
    for (const site of ['same-origin', 'same-site', 'none']) {
      expect(assertSameOrigin(req({ host: 'localhost:3100', 'sec-fetch-site': site }))).toBeNull();
    }
  });

  it('with no Origin: refuses Sec-Fetch-Site cross-site', async () => {
    await expectRefused(assertSameOrigin(req({ host: 'localhost:3100', 'sec-fetch-site': 'cross-site' })));
  });

  it('never caches the refusal', () => {
    expect(assertSameOrigin(req({ origin: 'https://evil.example' }))?.headers.get('cache-control')).toBe('no-store');
  });
});

describe('SR1', () => {
  it('has no proxy or middleware file, which would truncate large uploads', () => {
    for (const name of ['src/proxy.ts', 'src/middleware.ts', 'proxy.ts', 'middleware.ts', 'src/proxy.js', 'src/middleware.js', 'proxy.js', 'middleware.js']) {
      expect(fs.existsSync(path.join(process.cwd(), name)), name).toBe(false);
    }
  });
});
