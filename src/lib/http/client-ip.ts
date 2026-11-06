// The rate-limit key for a request, shared by the agent door and the buyer console.

/**
 * The rightmost X-Forwarded-For entry is the address our hosting proxy saw; leftmost ones are client-supplied.
 * On Render (RENDER is set) traffic arrives through Cloudflare, so that rightmost entry is a Cloudflare edge
 * address shared by unrelated visitors; there we use CF-Connecting-IP, which Cloudflare overwrites on every
 * request. It is never read elsewhere, where any client could send it to dodge the limits.
 */
export function clientIp(req: Request): string {
  const cloudflare = process.env.RENDER ? req.headers.get('cf-connecting-ip')?.trim() : undefined;
  if (cloudflare) return cloudflare;
  const forwarded = req.headers.get('x-forwarded-for')?.split(',').map((s) => s.trim()).filter(Boolean).at(-1);
  return forwarded || req.headers.get('x-real-ip')?.trim() || 'local';
}
