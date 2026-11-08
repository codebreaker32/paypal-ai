// In-memory sliding-window rate limiter (one process; resets on restart). Used by the agent door, the buyer console,
// the setup routes (starting shops, retakes, menu readings, item photos and covers) and the auth routes.
import { authLimitsSkipped } from '@/lib/auth/guest';
import { hashToken } from '@/lib/domain/ids';

/** A key's own window, so eviction never judges it by another caller's (SR10). */
interface Bucket {
  windowMs: number;
  hits: number[];
}
type Buckets = Map<string, Bucket>;
const g = globalThis as unknown as { __shelfieRateLimits?: Buckets };
const buckets = (): Buckets => (g.__shelfieRateLimits ??= new Map());

const MAX_KEYS = 10_000;

const liveHits = (bucket: Bucket | undefined, windowMs: number, nowMs: number): number[] =>
  (bucket?.hits ?? []).filter((t) => t > nowMs - windowMs);

/** True when `key` has had fewer than `limit` hits in the last `windowMs`. Counts nothing. */
export function peek(key: string, limit: number, windowMs: number, nowMs: number = Date.now()): boolean {
  return liveHits(buckets().get(key), windowMs, nowMs).length < limit;
}

/** Counts a hit whatever the limit, for what is only known afterwards (a failed login). Evicts when the map is large. */
export function recordHit(key: string, windowMs: number, nowMs: number = Date.now()): void {
  const map = buckets();
  map.set(key, { windowMs, hits: [...liveHits(map.get(key), windowMs, nowMs), nowMs] });
  if (map.size > MAX_KEYS) {
    for (const [k, bucket] of map) if (liveHits(bucket, bucket.windowMs, nowMs).length === 0) map.delete(k);
  }
}

/** Takes back one hit made at exactly `at`, if it is still there. */
function forgetHit(key: string, at: number): void {
  const bucket = buckets().get(key);
  if (!bucket) return;
  const i = bucket.hits.indexOf(at);
  if (i >= 0) bucket.hits.splice(i, 1);
}

/** Records a hit and returns true when `key` has had fewer than `limit` allowed hits in the last `windowMs`. */
export function allow(key: string, limit: number, windowMs: number, nowMs: number = Date.now()): boolean {
  if (!peek(key, limit, windowMs, nowMs)) return false;
  recordHit(key, windowMs, nowMs);
  return true;
}

export function resetRateLimits(): void {
  buckets().clear();
}

const HOUR = 60 * 60_000;

/**
 * Per-address limits on starting shops, uploading retakes, live menu readings and item photos or covers (spec §15:
 * they spend the Anthropic key and the disk). The e2e and screenshot servers run with SHELFIE_TEST and
 * start dozens of shops from one address, so they skip these limits.
 */
export const SETUP_RATES = {
  shops: { limit: 10, windowMs: HOUR },
  retakes: { limit: 20, windowMs: HOUR },
  readings: { limit: 20, windowMs: HOUR },
  /** Item photos and shop covers (POST /api/shops/[id]/items/[itemId]/photo, /api/shops/[id]/cover). */
  photos: { limit: 120, windowMs: HOUR },
} as const;

/** Records a setup hit for `ip`; false once the address is over its hourly limit. */
export function allowSetup(kind: keyof typeof SETUP_RATES, ip: string, nowMs: number = Date.now()): boolean {
  if (process.env.SHELFIE_TEST) return true;
  const { limit, windowMs } = SETUP_RATES[kind];
  return allow(`setup-${kind}:${ip}`, limit, windowMs, nowMs);
}

const MINUTE = 60_000;
const QUARTER_HOUR = 15 * MINUTE;

/**
 * Limits on signing up, logging in, recovering and re-entering a password (SR11). The attempt limits are per address;
 * the failure limits are what stop guessing without letting a stranger lock a seller out, and the login and recovery
 * buckets are separate so a lockout on one leaves the other open. Every check happens before any password hash (SR8).
 */
export const AUTH_RATES = {
  signup: { limit: 10, windowMs: HOUR },
  loginAttempts: { limit: 50, windowMs: QUARTER_HOUR },
  loginFailuresEmailIp: { limit: 10, windowMs: QUARTER_HOUR },
  loginFailuresEmail: { limit: 100, windowMs: HOUR },
  recoverAttempts: { limit: 10, windowMs: HOUR },
  recoverFailuresEmailIp: { limit: 5, windowMs: HOUR },
  recoverFailuresEmail: { limit: 30, windowMs: HOUR },
  passwordFailures: { limit: 10, windowMs: QUARTER_HOUR },
  /** Counted right or wrong: a correct password buys hash work too, and the hash gate is shared by every seller. */
  passwordAttemptsAccount: { limit: 10, windowMs: HOUR },
  passwordAttemptsIp: { limit: 30, windowMs: HOUR },
} as const;

/** Rate-limit keys hold this, never the address (SR10). Whether an account exists makes no difference. */
const emailKey = (email: string): string => hashToken(email.trim().toLowerCase());

/** Hands a reserved failure back: nothing to keep when the guess was right, or was never checked. Safe to call twice. */
export type ReleaseFailure = () => void;

interface Slot {
  key: string;
  windowMs: number;
}

/**
 * Counts a failure before the hash runs, so requests in flight see each other and a burst stays within the limit.
 * Call only straight after the limit check, with no await between them.
 */
function reserveFailure(slots: Slot[], nowMs: number): ReleaseFailure {
  for (const { key, windowMs } of slots) recordHit(key, windowMs, nowMs);
  let held = true;
  return () => {
    if (!held) return;
    held = false;
    for (const { key } of slots) forgetHit(key, nowMs);
  };
}

const NOTHING_RESERVED: ReleaseFailure = () => {};

const countAttempt = (key: string, rate: { limit: number; windowMs: number }, nowMs: number): boolean =>
  allow(key, rate.limit, rate.windowMs, nowMs);

const underFailureLimit = (key: string, rate: { limit: number; windowMs: number }, nowMs: number): boolean =>
  peek(key, rate.limit, rate.windowMs, nowMs);

/** Records a sign-up attempt; false once the address is over its limit. */
export function allowSignup(ip: string, nowMs: number = Date.now()): boolean {
  return authLimitsSkipped() || countAttempt(`auth-signup-ip:${ip}`, AUTH_RATES.signup, nowMs);
}

/** Records a login attempt on the address (checked first), then checks the failure limits for this email. */
export function allowLogin(ip: string, email: string, nowMs: number = Date.now()): boolean {
  if (authLimitsSkipped()) return true;
  if (!countAttempt(`auth-login-ip:${ip}`, AUTH_RATES.loginAttempts, nowMs)) return false;
  const hashed = emailKey(email);
  return (
    underFailureLimit(`auth-login-email-ip:${hashed}:${ip}`, AUTH_RATES.loginFailuresEmailIp, nowMs) &&
    underFailureLimit(`auth-login-email:${hashed}`, AUTH_RATES.loginFailuresEmail, nowMs)
  );
}

function loginFailureSlots(ip: string, email: string): Slot[] {
  const hashed = emailKey(email);
  return [
    { key: `auth-login-email-ip:${hashed}:${ip}`, windowMs: AUTH_RATES.loginFailuresEmailIp.windowMs },
    { key: `auth-login-email:${hashed}`, windowMs: AUTH_RATES.loginFailuresEmail.windowMs },
  ];
}

/** A wrong password or an unknown email. A successful login records nothing. */
export function recordLoginFailure(ip: string, email: string, nowMs: number = Date.now()): void {
  if (authLimitsSkipped()) return;
  for (const { key, windowMs } of loginFailureSlots(ip, email)) recordHit(key, windowMs, nowMs);
}

/** `allowLogin`, then a failure counted up front: null when refused, else the function to call if the guess was right. */
export function reserveLogin(ip: string, email: string, nowMs: number = Date.now()): ReleaseFailure | null {
  if (authLimitsSkipped()) return NOTHING_RESERVED;
  return allowLogin(ip, email, nowMs) ? reserveFailure(loginFailureSlots(ip, email), nowMs) : null;
}

/** Records a recovery attempt on the address (checked first), then checks the failure limits for this email. */
export function allowRecovery(ip: string, email: string, nowMs: number = Date.now()): boolean {
  if (authLimitsSkipped()) return true;
  if (!countAttempt(`auth-recover-ip:${ip}`, AUTH_RATES.recoverAttempts, nowMs)) return false;
  const hashed = emailKey(email);
  return (
    underFailureLimit(`auth-recover-email-ip:${hashed}:${ip}`, AUTH_RATES.recoverFailuresEmailIp, nowMs) &&
    underFailureLimit(`auth-recover-email:${hashed}`, AUTH_RATES.recoverFailuresEmail, nowMs)
  );
}

function recoveryFailureSlots(ip: string, email: string): Slot[] {
  const hashed = emailKey(email);
  return [
    { key: `auth-recover-email-ip:${hashed}:${ip}`, windowMs: AUTH_RATES.recoverFailuresEmailIp.windowMs },
    { key: `auth-recover-email:${hashed}`, windowMs: AUTH_RATES.recoverFailuresEmail.windowMs },
  ];
}

export function recordRecoveryFailure(ip: string, email: string, nowMs: number = Date.now()): void {
  if (authLimitsSkipped()) return;
  for (const { key, windowMs } of recoveryFailureSlots(ip, email)) recordHit(key, windowMs, nowMs);
}

/** `allowRecovery`, then a failure counted up front: null when refused, else the function to call if the key was right. */
export function reserveRecovery(ip: string, email: string, nowMs: number = Date.now()): ReleaseFailure | null {
  if (authLimitsSkipped()) return NOTHING_RESERVED;
  return allowRecovery(ip, email, nowMs) ? reserveFailure(recoveryFailureSlots(ip, email), nowMs) : null;
}

/** Before checking a `currentPassword` field: false once the account has had too many wrong ones. Counts nothing. */
export function allowPasswordCheck(accountId: string, nowMs: number = Date.now()): boolean {
  return authLimitsSkipped() || underFailureLimit(`auth-password:${accountId}`, AUTH_RATES.passwordFailures, nowMs);
}

const passwordFailureSlot = (accountId: string): Slot => ({
  key: `auth-password:${accountId}`,
  windowMs: AUTH_RATES.passwordFailures.windowMs,
});

export function recordPasswordFailure(accountId: string, nowMs: number = Date.now()): void {
  if (authLimitsSkipped()) return;
  const { key, windowMs } = passwordFailureSlot(accountId);
  recordHit(key, windowMs, nowMs);
}

/**
 * Before hashing a `currentPassword` field: the failure limit, then the attempt limits per account and per address, all
 * checked before any is charged. Null when refused, else the function to call if the password was right. The attempts
 * stay counted either way (one account must not be able to keep the shared hash gate full).
 */
export function reservePasswordCheck(accountId: string, ip: string, nowMs: number = Date.now()): ReleaseFailure | null {
  if (authLimitsSkipped()) return NOTHING_RESERVED;
  const { passwordAttemptsAccount: perAccount, passwordAttemptsIp: perAddress } = AUTH_RATES;
  const accountKey = `auth-password-attempts-account:${accountId}`;
  const addressKey = `auth-password-attempts-ip:${ip}`;
  if (
    !allowPasswordCheck(accountId, nowMs) ||
    !peek(accountKey, perAccount.limit, perAccount.windowMs, nowMs) ||
    !peek(addressKey, perAddress.limit, perAddress.windowMs, nowMs)
  ) {
    return null;
  }
  recordHit(accountKey, perAccount.windowMs, nowMs);
  recordHit(addressKey, perAddress.windowMs, nowMs);
  return reserveFailure([passwordFailureSlot(accountId)], nowMs);
}
