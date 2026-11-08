// Password storage with node:crypto scrypt (SR5) behind a process-wide gate (SR7). A hash costs about a third of a
// second and 32 MB, so the gate keeps a burst of logins from starving the server. Passwords are never logged.
// hashPassword, verifyPassword and dummyVerify reject with HashBusyError when the gate is full: answer with busyResponse().
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { jsonError } from '@/lib/http/json-error';

export * from './password-policy';

const N = 32768;
const R = 8;
const P = 3;
const SALT_BYTES = 16;
const KEY_BYTES = 32;
/** Node's default limit (32 MB) is below what these parameters need. */
const MAX_MEMORY = 64 * 1024 * 1024;

const MAX_RUNNING = 2;
const MAX_QUEUED = 8;
const RETRY_AFTER_SECONDS = 5;

export class HashBusyError extends Error {
  constructor() {
    super('The password hash queue is full.');
  }
}

/** The route's answer to a HashBusyError. */
export function busyResponse(): Response {
  const res = jsonError(503, 'BUSY', 'Shelfie is busy. Try again in a few seconds.');
  res.headers.set('retry-after', String(RETRY_AFTER_SECONDS));
  return res;
}

interface HashGate {
  running: number;
  waiting: (() => void)[];
}

// On globalThis so that route bundles and dev reloads share one gate, as the rate limiter's buckets do.
const g = globalThis as unknown as { __shelfieHashGate?: HashGate };

async function gated<T>(work: () => Promise<T>): Promise<T> {
  const gate = (g.__shelfieHashGate ??= { running: 0, waiting: [] });
  if (gate.running < MAX_RUNNING) {
    gate.running++;
  } else {
    if (gate.waiting.length >= MAX_QUEUED) throw new HashBusyError();
    await new Promise<void>((resolve) => gate.waiting.push(resolve)); // the finishing call hands its slot over
  }
  try {
    return await work();
  } finally {
    const next = gate.waiting.shift();
    if (next) next();
    else gate.running--;
  }
}

interface Params {
  N: number;
  r: number;
  p: number;
}

function derive(password: string, salt: Buffer, keyBytes: number, params: Params): Promise<Buffer> {
  return gated(
    () =>
      new Promise<Buffer>((resolve, reject) => {
        scrypt(password, salt, keyBytes, { ...params, maxmem: MAX_MEMORY }, (err, key) => (err ? reject(err) : resolve(key)));
      }),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await derive(password, salt, KEY_BYTES, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

/** Null for anything scrypt could not run under MAX_MEMORY: such a value can never verify, and must not throw. */
function parseStored(stored: string): (Params & { salt: Buffer; key: Buffer }) | null {
  const m = /^scrypt\$(\d+)\$(\d+)\$(\d+)\$([\w-]+)\$([\w-]+)$/.exec(stored);
  if (!m) return null;
  const [n, r, p] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (n < 2 || r < 1 || p < 1 || 128 * r * (n + p + 2) > MAX_MEMORY || (n & (n - 1)) !== 0) return null;
  return { N: n, r, p, salt: Buffer.from(m[4], 'base64url'), key: Buffer.from(m[5], 'base64url') };
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parsed = parseStored(stored);
  if (!parsed) return false;
  const { salt, key, ...params } = parsed;
  return timingSafeEqual(await derive(password, salt, key.length, params), key);
}

/** After a successful login: true when the stored value is not in today's format, so it should be hashed again. */
export function needsRehash(stored: string): boolean {
  const parsed = parseStored(stored);
  return !parsed || parsed.N !== N || parsed.r !== R || parsed.p !== P || parsed.salt.length !== SALT_BYTES || parsed.key.length !== KEY_BYTES;
}

/** The same work as checking a password, for a login with an unknown email (SR9). */
export async function dummyVerify(password: string): Promise<void> {
  await hashPassword(password);
}
