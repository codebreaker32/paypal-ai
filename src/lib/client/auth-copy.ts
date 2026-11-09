// The exact sentences of the sign-up, login and recovery forms (brief WP6). A route's failure arrives as an ApiError with
// a `code`; each form turns it into one problem, naming the field it belongs under. Pure, so the copy is testable.
import { MIN_PASSWORD_LENGTH, passwordLength } from '@/lib/auth/password-policy';
import { parsePayeeEmail } from '@/lib/domain/payee';
import { sameShopName } from '@/lib/domain/shop-name';
import { ApiError } from './http';

/** One piece of a message: plain words, or words that link somewhere. */
export type MessageBit = string | { text: string; href: string };

export type ProblemField = 'email' | 'password' | 'newPassword' | 'name' | 'recoveryKey' | 'form';

export interface AuthProblem {
  field: ProblemField;
  message: MessageBit[];
}

export const EMAIL_TEXT = 'Enter your email, like rosa@example.com.';
export const SHORT_PASSWORD_TEXT = 'Use at least 15 characters.';
export const BUSY_TEXT = 'Shelfie is busy. Try again in a few seconds.';
const NETWORK_TEXT = 'Couldn’t reach Shelfie. Check your connection and try again.';

const problem = (field: ProblemField, ...message: MessageBit[]): AuthProblem => ({ field, message });

/** The failures every form words the same way; null for the ones it words itself. */
function common(err: unknown): AuthProblem | null {
  if (!(err instanceof ApiError) || err.code === 'NETWORK') return problem('form', NETWORK_TEXT);
  if (err.code === 'BUSY') return problem('form', BUSY_TEXT);
  return null;
}

const unexpected = (err: unknown): AuthProblem => problem('form', (err as ApiError).message);

export function signupProblem(err: unknown): AuthProblem {
  const shared = common(err);
  if (shared) return shared;
  const e = err as ApiError;
  switch (e.code) {
    case 'INVALID_EMAIL':
      return problem('email', EMAIL_TEXT);
    case 'WEAK_PASSWORD':
      return problem('password', e.message);
    case 'EMAIL_TAKEN':
      return problem(
        'email',
        'There’s already an account with this email. ',
        { text: 'Log in', href: '/login' },
        ' or ',
        { text: 'use your recovery key', href: '/recover' },
        '.',
      );
    case 'RATE_LIMITED':
      return problem('form', 'Too many tries from this connection. Wait a few minutes and try again.');
    default:
      return unexpected(err);
  }
}

export function loginProblem(err: unknown): AuthProblem {
  const shared = common(err);
  if (shared) return shared;
  const e = err as ApiError;
  switch (e.code) {
    case 'BAD_CREDENTIALS':
      return problem('form', 'That email and password don’t match. Try again, or ', { text: 'reset your password', href: '/recover' }, '.');
    case 'RATE_LIMITED':
      return problem('form', 'Too many tries. Wait 15 minutes, or ', { text: 'reset your password with your recovery key', href: '/recover' }, '.');
    default:
      return unexpected(err);
  }
}

export function recoverProblem(err: unknown): AuthProblem {
  const shared = common(err);
  if (shared) return shared;
  const e = err as ApiError;
  switch (e.code) {
    case 'BAD_RECOVERY':
      return problem('form', 'That email and recovery key don’t match. Check for typos.');
    case 'WEAK_PASSWORD':
      return problem('password', e.message);
    default:
      return unexpected(err);
  }
}

/** A sensitive action's password field (create a new recovery key). */
export function currentPasswordProblem(err: unknown): AuthProblem {
  const shared = common(err);
  if (shared) return shared;
  const e = err as ApiError;
  switch (e.code) {
    case 'PASSWORD_WRONG':
      return problem('password', 'That password doesn’t match.');
    case 'PASSWORD_REQUIRED':
      return problem('password', 'Enter your password.');
    case 'RATE_LIMITED':
      return problem('password', e.message);
    default:
      return unexpected(err);
  }
}

/** Changing the password on `/account`: the current one goes under its field, a weak new one under the new field. */
export function changePasswordProblem(err: unknown): AuthProblem {
  if (err instanceof ApiError && err.code === 'WEAK_PASSWORD') return problem('newPassword', err.message);
  return currentPasswordProblem(err);
}

/** The delete sheet. An `OPEN_ORDERS` refusal keeps the server's sentence, which counts the orders. */
export function deleteShopProblem(err: unknown): AuthProblem {
  if (err instanceof ApiError && err.code === 'NAME_MISMATCH') return problem('name', err.message);
  return currentPasswordProblem(err);
}

const emailProblem = (email: string): AuthProblem | null => (parsePayeeEmail(email).ok ? null : problem('email', EMAIL_TEXT));
const newPasswordProblem = (password: string): AuthProblem | null =>
  passwordLength(password) < MIN_PASSWORD_LENGTH ? problem('password', SHORT_PASSWORD_TEXT) : null;

// The checks a form can make before asking the server: the server stays the authority (the blocklist is only there).

export function checkSignup(email: string, password: string): AuthProblem | null {
  return emailProblem(email) ?? newPasswordProblem(password);
}

/** Only that both are there: a typo is the server's to answer, and an older password may be any length. */
export function checkLogin(email: string, password: string): AuthProblem | null {
  if (!email.trim()) return problem('email', EMAIL_TEXT);
  if (!password) return problem('password', 'Enter your password.');
  return null;
}

export function checkCurrentPassword(password: string): AuthProblem | null {
  return password ? null : problem('password', 'Enter your password.');
}

export function checkChangePassword(currentPassword: string, newPassword: string): AuthProblem | null {
  return checkCurrentPassword(currentPassword) ?? (passwordLength(newPassword) < MIN_PASSWORD_LENGTH ? problem('newPassword', SHORT_PASSWORD_TEXT) : null);
}

/** The same comparison as the server's (`sameShopName`). The name is checked first, as it is there. */
export function checkDeleteShop(typedName: string, shopName: string, currentPassword: string): AuthProblem | null {
  if (!sameShopName(typedName, shopName)) return problem('name', 'Type the shop’s name exactly as it appears.');
  return checkCurrentPassword(currentPassword);
}

export function checkRecover(email: string, recoveryKey: string, newPassword: string): AuthProblem | null {
  if (!email.trim()) return problem('email', EMAIL_TEXT);
  if (!recoveryKey.trim()) return problem('recoveryKey', 'Enter your recovery key.');
  return newPasswordProblem(newPassword);
}

/** The line under a new password, updated as they type. */
export function passwordHint(password: string): string {
  const typed = passwordLength(password);
  if (typed === 0) return 'At least 15 characters. A short sentence works well.';
  return typed >= MIN_PASSWORD_LENGTH ? 'Long enough' : `${MIN_PASSWORD_LENGTH - typed} more to go`;
}
