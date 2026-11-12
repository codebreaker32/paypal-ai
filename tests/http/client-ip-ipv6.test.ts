// One IPv6 customer holds a whole /64, so a limit keyed on the full address is a limit on nothing.
import { describe, expect, it, vi, afterEach } from 'vitest';
import { clientIp } from '@/lib/http/client-ip';

const ip = (address: string) => clientIp(new Request('http://localhost/x', { headers: { 'x-forwarded-for': address } }));

describe('clientIp and IPv6', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('buckets an address by its first 64 bits', () => {
    expect(ip('2001:db8:1:2:3:4:5:6')).toBe('2001:db8:1:2::/64');
  });

  it('gives two addresses in one /64 the same key, and neighbouring /64s different ones', () => {
    expect(ip('2001:db8:1:2:aaaa::1')).toBe(ip('2001:db8:1:2:bbbb::2'));
    expect(ip('2001:db8:1:2::1')).not.toBe(ip('2001:db8:1:3::1'));
  });

  it('reads every spelling of an address the same way', () => {
    for (const spelling of ['2001:db8::1', '2001:DB8::1', '2001:0db8:0000:0000::1', '2001:db8:0:0:0:0:0:1']) {
      expect(ip(spelling), spelling).toBe('2001:db8:0:0::/64');
    }
  });

  it('handles :: at either end', () => {
    expect(ip('::1')).toBe('0:0:0:0::/64');
    expect(ip('2001:db8:1:2::')).toBe('2001:db8:1:2::/64');
  });

  it('drops a zone id', () => {
    expect(ip('fe80::1%eth0')).toBe('fe80:0:0:0::/64');
  });

  it('treats an IPv4-mapped address as the IPv4 address, in either spelling', () => {
    expect(ip('::ffff:192.0.2.1')).toBe('192.0.2.1');
    expect(ip('::ffff:c000:201')).toBe('192.0.2.1');
    expect(ip('0:0:0:0:0:ffff:192.0.2.1')).toBe('192.0.2.1');
  });

  it('leaves IPv4 and anything unparsable unchanged', () => {
    expect(ip('203.0.113.9')).toBe('203.0.113.9');
    expect(ip('unknown')).toBe('unknown');
  });

  it('applies to every header it reads', () => {
    vi.stubEnv('RENDER', 'true');
    const fromCloudflare = clientIp(new Request('http://localhost/x', { headers: { 'cf-connecting-ip': '2001:db8:1:2:3:4:5:6' } }));
    expect(fromCloudflare).toBe('2001:db8:1:2::/64');
    vi.stubEnv('RENDER', '');
    const fromRealIp = clientIp(new Request('http://localhost/x', { headers: { 'x-real-ip': '2001:db8:1:2:3:4:5:6' } }));
    expect(fromRealIp).toBe('2001:db8:1:2::/64');
  });
});
