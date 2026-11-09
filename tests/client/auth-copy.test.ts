// The exact sentences of the three account forms (brief WP6).
import { describe, expect, it } from 'vitest';
import {
  type AuthProblem,
  BUSY_TEXT,
  checkCurrentPassword,
  checkLogin,
  checkRecover,
  checkSignup,
  currentPasswordProblem,
  loginProblem,
  passwordHint,
  recoverProblem,
  signupProblem,
} from '@/lib/client/auth-copy';
import { ApiError } from '@/lib/client/http';

const text = (p: AuthProblem) => p.message.map((b) => (typeof b === 'string' ? b : b.text)).join('');
const links = (p: AuthProblem) => p.message.filter((b): b is { text: string; href: string } => typeof b !== 'string');
const err = (code: string, message = 'server said', status = 400) => new ApiError(status, code, message);

describe('signupProblem', () => {
  it('invalid email goes to the email field', () => {
    const p = signupProblem(err('INVALID_EMAIL'));
    expect(p.field).toBe('email');
    expect(text(p)).toBe('Enter your email, like rosa@example.com.');
  });

  it('a weak password shows the server’s sentence at the password field', () => {
    const p = signupProblem(err('WEAK_PASSWORD', 'Use at least 15 characters.'));
    expect(p.field).toBe('password');
    expect(text(p)).toBe('Use at least 15 characters.');
  });

  it('a taken email links to both ways in', () => {
    const p = signupProblem(err('EMAIL_TAKEN', 'x', 409));
    expect(p.field).toBe('email');
    expect(text(p)).toBe('There’s already an account with this email. Log in or use your recovery key.');
    expect(links(p)).toEqual([
      { text: 'Log in', href: '/login' },
      { text: 'use your recovery key', href: '/recover' },
    ]);
  });

  it('rate limited, offline and busy', () => {
    expect(text(signupProblem(err('RATE_LIMITED', 'x', 429)))).toBe('Too many tries from this connection. Wait a few minutes and try again.');
    expect(text(signupProblem(err('NETWORK', 'x', 0)))).toBe('Couldn’t reach Shelfie. Check your connection and try again.');
    expect(text(signupProblem(err('BUSY', 'x', 503)))).toBe(BUSY_TEXT);
    expect(BUSY_TEXT).toBe('Shelfie is busy. Try again in a few seconds.');
  });

  it('anything else keeps the server’s sentence on the form', () => {
    const p = signupProblem(err('BAD_ORIGIN', 'Refused'));
    expect(p.field).toBe('form');
    expect(text(p)).toBe('Refused');
  });

  it('a thrown non-ApiError still says something useful', () => {
    expect(text(signupProblem(new TypeError('boom')))).toBe('Couldn’t reach Shelfie. Check your connection and try again.');
  });
});

describe('loginProblem', () => {
  it('bad credentials link to the reset page and name no field (SR9)', () => {
    const p = loginProblem(err('BAD_CREDENTIALS', 'x', 401));
    expect(p.field).toBe('form');
    expect(text(p)).toBe('That email and password don’t match. Try again, or reset your password.');
    expect(links(p)).toEqual([{ text: 'reset your password', href: '/recover' }]);
  });

  it('rate limited points at the recovery key', () => {
    const p = loginProblem(err('RATE_LIMITED', 'x', 429));
    expect(text(p)).toBe('Too many tries. Wait 15 minutes, or reset your password with your recovery key.');
    expect(links(p)).toEqual([{ text: 'reset your password with your recovery key', href: '/recover' }]);
  });

  it('busy and offline', () => {
    expect(text(loginProblem(err('BUSY', 'x', 503)))).toBe(BUSY_TEXT);
    expect(text(loginProblem(err('NETWORK', 'x', 0)))).toBe('Couldn’t reach Shelfie. Check your connection and try again.');
  });
});

describe('recoverProblem', () => {
  it('a wrong key is one sentence for email and key alike', () => {
    const p = recoverProblem(err('BAD_RECOVERY', 'x', 401));
    expect(p.field).toBe('form');
    expect(text(p)).toBe('That email and recovery key don’t match. Check for typos.');
  });

  it('a weak new password goes to the password field', () => {
    const p = recoverProblem(err('WEAK_PASSWORD', 'That password is too common.'));
    expect(p.field).toBe('password');
    expect(text(p)).toBe('That password is too common.');
  });

  it('rate limited keeps the server’s hourly sentence', () => {
    expect(text(recoverProblem(err('RATE_LIMITED', 'Too many tries. Wait an hour and try again.', 429)))).toBe(
      'Too many tries. Wait an hour and try again.',
    );
  });

  it('busy', () => {
    expect(text(recoverProblem(err('BUSY', 'x', 503)))).toBe(BUSY_TEXT);
  });
});

describe('checks before sending', () => {
  const long = 'a short sentence only i know';

  it('signup: a bad email, then a short password', () => {
    expect(checkSignup('nope', long)?.field).toBe('email');
    expect(text(checkSignup('', long)!)).toBe('Enter your email, like rosa@example.com.');
    const short = checkSignup('rosa@example.com', 'tooshort')!;
    expect(short.field).toBe('password');
    expect(text(short)).toBe('Use at least 15 characters.');
    expect(checkSignup('rosa@example.com', long)).toBeNull();
  });

  it('login: both fields must be filled, nothing more (old passwords may be any length)', () => {
    expect(checkLogin('', 'x')?.field).toBe('email');
    expect(text(checkLogin('rosa@example.com', '')!)).toBe('Enter your password.');
    expect(checkLogin('rosa@example.com', 'x')).toBeNull();
  });

  it('recover: email, key, then a long enough new password', () => {
    expect(checkRecover('', 'k', long)?.field).toBe('email');
    const key = checkRecover('rosa@example.com', '  ', long)!;
    expect(key.field).toBe('recoveryKey');
    expect(text(key)).toBe('Enter your recovery key.');
    expect(checkRecover('rosa@example.com', 'k', 'short')?.field).toBe('password');
    expect(checkRecover('rosa@example.com', 'k', long)).toBeNull();
  });
});

describe('passwordHint', () => {
  it('starts with the advice', () => {
    expect(passwordHint('')).toBe('At least 15 characters. A short sentence works well.');
  });
  it('counts down', () => {
    expect(passwordHint('a')).toBe('14 more to go');
    expect(passwordHint('a'.repeat(14))).toBe('1 more to go');
  });
  it('then says enough', () => {
    expect(passwordHint('a'.repeat(15))).toBe('Long enough');
    expect(passwordHint('a'.repeat(40))).toBe('Long enough');
  });
  it('counts an emoji as one character, like the server', () => {
    expect(passwordHint('😀'.repeat(14))).toBe('1 more to go');
  });
});

describe('the current-password check on /account', () => {
  it('needs something typed before it asks the server', () => {
    expect(checkCurrentPassword('')).toEqual({ field: 'password', message: ['Enter your password.'] });
    expect(checkCurrentPassword('any length')).toBeNull();
  });

  it('words a wrong password exactly, under the field', () => {
    expect(currentPasswordProblem(new ApiError(403, 'PASSWORD_WRONG', 'x'))).toEqual({ field: 'password', message: ['That password doesn’t match.'] });
  });

  it('asks for a missing password under the field too', () => {
    expect(currentPasswordProblem(new ApiError(403, 'PASSWORD_REQUIRED', 'x')).field).toBe('password');
  });

  it('keeps the shared busy and network wording, and the route’s words for a limit', () => {
    expect(currentPasswordProblem(new ApiError(503, 'BUSY', 'x'))).toEqual({ field: 'form', message: ['Shelfie is busy. Try again in a few seconds.'] });
    expect(currentPasswordProblem(new ApiError(0, 'NETWORK', 'x')).field).toBe('form');
    expect(currentPasswordProblem(new ApiError(429, 'RATE_LIMITED', 'Slow down.'))).toEqual({ field: 'password', message: ['Slow down.'] });
  });
});
