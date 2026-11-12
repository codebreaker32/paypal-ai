// The rules for a new password. No node:crypto here, so a browser form can import the limits.
import { isCommonPassword } from './common-passwords';

export const MIN_PASSWORD_LENGTH = 15;
export const MAX_PASSWORD_LENGTH = 128;

export type PasswordProblem = 'too_short' | 'too_long' | 'repeated' | 'common' | 'email';
export type PasswordCheck = { ok: true } | { ok: false; problem: PasswordProblem; message: string };

const TOO_SHORT = 'Use at least 15 characters.';
const TOO_LONG = 'Use 128 characters or fewer.';
const TOO_COMMON = 'That password is too common. Try a short sentence only you would say.';
const IS_EMAIL = 'Your password can’t be your email. Try a short sentence only you would say.';

/** Length in characters (code points), so an emoji counts as one. */
export const passwordLength = (password: string): number => [...password].length;

/** 15 to 128 characters and no composition rules; refuses the blocklist, one repeated character and the account's email. */
export function checkNewPassword(password: unknown, email: string): PasswordCheck {
  if (typeof password !== 'string' || passwordLength(password) < MIN_PASSWORD_LENGTH) {
    return { ok: false, problem: 'too_short', message: TOO_SHORT };
  }
  if (passwordLength(password) > MAX_PASSWORD_LENGTH) return { ok: false, problem: 'too_long', message: TOO_LONG };
  if (new Set(password).size === 1) return { ok: false, problem: 'repeated', message: TOO_COMMON };
  if (isCommonPassword(password)) return { ok: false, problem: 'common', message: TOO_COMMON };
  if (password.toLowerCase() === email.toLowerCase()) return { ok: false, problem: 'email', message: IS_EMAIL };
  return { ok: true };
}
