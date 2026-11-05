// JSON responses for Task 8's route handlers. Errors follow the wave-2 contract: { error: { code, message } }.

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

export function jsonError(status: number, code: string, message: string): Response {
  return json({ error: { code, message } }, status);
}

/** Reads a JSON body; null when it is missing or not JSON. */
export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
