// The rate-limit key for a request, shared by the agent door and the buyer console.

/** The rightmost X-Forwarded-For entry is the address our hosting proxy saw; leftmost ones are client-supplied. */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',').map((s) => s.trim()).filter(Boolean).at(-1);
  return forwarded || req.headers.get('x-real-ip')?.trim() || 'local';
}
