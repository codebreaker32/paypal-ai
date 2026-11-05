// The one JSON error response every route handler uses: { error: { code, message } }, never cached.

export function jsonError(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status, headers: { 'cache-control': 'no-store' } });
}
