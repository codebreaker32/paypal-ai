// The rate-limit key for a request, shared by the agent door, the buyer console and the auth routes.
import { isIPv6 } from 'node:net';

/**
 * The rightmost X-Forwarded-For entry is the address our hosting proxy saw; leftmost ones are client-supplied.
 * On Render (RENDER is set) traffic arrives through Cloudflare, so that rightmost entry is a Cloudflare edge
 * address shared by unrelated visitors; there we use CF-Connecting-IP, which Cloudflare overwrites on every
 * request. It is never read elsewhere, where any client could send it to dodge the limits.
 */
export function clientIp(req: Request): string {
  const cloudflare = process.env.RENDER ? req.headers.get('cf-connecting-ip')?.trim() : undefined;
  if (cloudflare) return addressBucket(cloudflare);
  const forwarded = req.headers.get('x-forwarded-for')?.split(',').map((s) => s.trim()).filter(Boolean).at(-1);
  return addressBucket(forwarded || req.headers.get('x-real-ip')?.trim() || 'local');
}

/** The eight 16-bit groups of a valid IPv6 address. */
function groupsOf(address: string): number[] {
  // A dotted tail (::ffff:192.0.2.1) is the last two groups written in decimal.
  const hex = address.replace(/(\d+)\.(\d+)\.(\d+)\.(\d+)$/, (_, a, b, c, d) =>
    `${((Number(a) << 8) | Number(b)).toString(16)}:${((Number(c) << 8) | Number(d)).toString(16)}`,
  );
  const [head, tail] = hex.split('::');
  const parse = (part?: string) => (part ? part.split(':').map((g) => parseInt(g, 16)) : []);
  const left = parse(head);
  const right = parse(tail);
  return [...left, ...new Array<number>(8 - left.length - right.length).fill(0), ...right];
}

/**
 * IPv6 is bucketed by /64 (one customer holds a whole /64, so the full address limits nothing) and an IPv4-mapped
 * address is its IPv4 address. IPv4 and anything unparsable are unchanged.
 */
function addressBucket(ip: string): string {
  const address = ip.split('%')[0];
  if (!isIPv6(address)) return ip;
  const groups = groupsOf(address);
  if (groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff) {
    return [groups[6] >> 8, groups[6] & 255, groups[7] >> 8, groups[7] & 255].join('.');
  }
  return `${groups.slice(0, 4).map((g) => g.toString(16)).join(':')}::/64`;
}
