// What the /api/auth and /api/account routes share. Nothing here logs: passwords, keys and tokens must never reach the
// console (SR23), and `errorResponse` logs only an error's own message.
import { errorResponse } from '@/lib/catalog/http';
import type { Account } from '@/lib/db/repos/accounts';
import { jsonError } from '@/lib/http/json-error';
import { BodyTooLargeError, MAX_JSON_BODY_BYTES, readJsonLimited } from '@/lib/http/read-body';
import { allowPasswordCheck, recordPasswordFailure } from '@/lib/rate-limit';
import { HashBusyError, busyResponse, verifyPassword } from './password';

/** A response carrying a recovery key or starting a session: never cached (SR23). */
export const noStoreJson = (body: unknown, status = 200): Response =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

export const noStoreEmpty = (): Response => new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });

export const tooManyTries = (message = 'Too many tries from this connection. Wait a few minutes and try again.'): Response =>
  jsonError(429, 'RATE_LIMITED', message);

export const loginRequired = (): Response => jsonError(401, 'LOGIN_REQUIRED', 'Log in to do that.');

/**
 * A sensitive action's `currentPassword` field: null to carry on, else the refusal. Missing is 403 PASSWORD_REQUIRED and
 * wrong is 403 PASSWORD_WRONG; the limit comes before the hash (SR8), and only a wrong password counts. May throw
 * HashBusyError.
 */
export async function checkCurrentPassword(account: Pick<Account, 'id' | 'passwordHash'>, currentPassword: unknown): Promise<Response | null> {
  if (typeof currentPassword !== 'string' || currentPassword === '') {
    return jsonError(403, 'PASSWORD_REQUIRED', 'Enter your Shelfie password to do that.');
  }
  if (!allowPasswordCheck(account.id)) return tooManyTries('Too many tries. Wait a few minutes and try again.');
  if (await verifyPassword(currentPassword, account.passwordHash)) return null;
  recordPasswordFailure(account.id);
  return jsonError(403, 'PASSWORD_WRONG', 'That password doesn’t match.');
}

/** The JSON body as an object; {} for anything else, so every route answers bad input by its own rule. */
export async function readFields(req: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await readJsonLimited(req, MAX_JSON_BODY_BYTES);
  } catch (err) {
    if (err instanceof BodyTooLargeError) throw err;
    return {};
  }
  return body !== null && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
}

/** For a field used as a password or key: a non-string is just wrong, and costs the same to check. */
export const stringField = (value: unknown): string => (typeof value === 'string' ? value : '');

export function authFailure(err: unknown, where: string): Response {
  return err instanceof HashBusyError ? busyResponse() : errorResponse(err, where);
}
