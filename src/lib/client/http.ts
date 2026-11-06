// Browser-side JSON calls shared by the setup and dashboard screens. Every route answers errors as
// { error: { code, message } }; a failed call throws ApiError, a call that never reached us throws code NETWORK.

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const NETWORK_MESSAGE = "We couldn’t reach Shelfie. Check your connection and try again.";
const SERVER_MESSAGE = 'Something went wrong on our side. Try again in a moment.';

export interface CallOptions {
  /** The error code when the response has none (default SERVER_ERROR). */
  fallbackCode?: (status: number) => string;
  /** The message when the response has none (default: a generic "try again"). */
  fallbackMessage?: (status: number) => string | undefined;
}

/** Fetches JSON without caching; throws ApiError on a network failure or a non-2xx answer. */
export async function call<T>(url: string, init: RequestInit = {}, opts: CallOptions = {}): Promise<{ status: number; body: T }> {
  let res: Response;
  try {
    res = await fetch(url, { cache: 'no-store', ...init });
  } catch {
    throw new ApiError(0, 'NETWORK', NETWORK_MESSAGE);
  }
  const body = (await res.json().catch(() => null)) as (T & { error?: { code?: string; message?: string } }) | null;
  if (!res.ok) throw errorFrom(res.status, body, opts);
  return { status: res.status, body: body as T };
}

/** The ApiError for a non-2xx answer whose JSON body (or null) has been read. */
export function errorFrom(status: number, body: { error?: { code?: string; message?: string } } | null, opts: CallOptions = {}): ApiError {
  const code = body?.error?.code ?? opts.fallbackCode?.(status) ?? 'SERVER_ERROR';
  const message = body?.error?.message ?? opts.fallbackMessage?.(status) ?? SERVER_MESSAGE;
  return new ApiError(status, code, message);
}
