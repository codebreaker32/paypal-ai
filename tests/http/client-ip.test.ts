// The rate-limit key shared by the agent door and the buyer console.
import { describe, expect, it } from 'vitest';
import { clientIp } from '@/lib/http/client-ip';

const req = (headers: Record<string, string>) => new Request('http://localhost/x', { headers });

describe('clientIp', () => {
  it('takes the rightmost X-Forwarded-For entry (the address our hosting proxy saw; leftmost ones are client-supplied)', () => {
    expect(clientIp(req({ 'x-forwarded-for': '203.0.113.9, 198.51.100.7' }))).toBe('198.51.100.7');
    expect(clientIp(req({ 'x-forwarded-for': ' 198.51.100.7 ,, ' }))).toBe('198.51.100.7');
  });

  it('falls back to X-Real-IP, then to "local"', () => {
    expect(clientIp(req({ 'x-real-ip': ' 192.0.2.4 ' }))).toBe('192.0.2.4');
    expect(clientIp(req({ 'x-forwarded-for': ' , ' }))).toBe('local');
    expect(clientIp(req({}))).toBe('local');
  });
});
