// The rate-limit key shared by the agent door and the buyer console.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clientIp } from '@/lib/http/client-ip';

const req = (headers: Record<string, string>) => new Request('http://localhost/x', { headers });

describe('clientIp', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('takes the rightmost X-Forwarded-For entry (the address our hosting proxy saw; leftmost ones are client-supplied)', () => {
    expect(clientIp(req({ 'x-forwarded-for': '203.0.113.9, 198.51.100.7' }))).toBe('198.51.100.7');
    expect(clientIp(req({ 'x-forwarded-for': ' 198.51.100.7 ,, ' }))).toBe('198.51.100.7');
  });

  it('falls back to X-Real-IP, then to "local"', () => {
    expect(clientIp(req({ 'x-real-ip': ' 192.0.2.4 ' }))).toBe('192.0.2.4');
    expect(clientIp(req({ 'x-forwarded-for': ' , ' }))).toBe('local');
    expect(clientIp(req({}))).toBe('local');
  });

  // Render sits behind Cloudflare: X-Forwarded-For is `<client>, <Cloudflare edge>`, so the rightmost
  // entry is an edge address shared by unrelated visitors. Cloudflare overwrites CF-Connecting-IP.
  const behindCloudflare = {
    'cf-connecting-ip': ' 203.0.113.9 ',
    'x-forwarded-for': '6.6.6.6, 203.0.113.9, 104.22.17.40',
  };

  it('on Render, keys on CF-Connecting-IP (the real client), not the Cloudflare edge address', () => {
    vi.stubEnv('RENDER', 'true');
    expect(clientIp(req(behindCloudflare))).toBe('203.0.113.9');
    // Two buyers behind the same edge get different keys.
    expect(clientIp(req({ 'cf-connecting-ip': '99.61.165.29', 'x-forwarded-for': '99.61.165.29, 104.22.17.40' }))).toBe('99.61.165.29');
  });

  it('on Render without CF-Connecting-IP, keeps the rightmost X-Forwarded-For rule', () => {
    vi.stubEnv('RENDER', 'true');
    expect(clientIp(req({ 'cf-connecting-ip': ' ', 'x-forwarded-for': '6.6.6.6, 104.22.17.40' }))).toBe('104.22.17.40');
  });

  it('off Render, ignores CF-Connecting-IP (a client could send it to dodge the limits)', () => {
    vi.stubEnv('RENDER', '');
    expect(clientIp(req(behindCloudflare))).toBe('104.22.17.40');
    expect(clientIp(req({ 'cf-connecting-ip': '203.0.113.9' }))).toBe('local');
  });
});
