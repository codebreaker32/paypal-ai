// Browser-side calls for the account routes. Every failure is an ApiError carrying the route's `code`, so a form picks
// its exact sentence by code. A finished login or logout ends with window.location.replace, which is the form's job.
import { call } from './http';

const post = (body?: unknown): RequestInit => ({
  method: 'POST',
  ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
});

async function bodyOf<T>(url: string, init: RequestInit): Promise<T> {
  return (await call<T>(url, init)).body;
}

export interface KeyAndNext {
  recoveryKey: string;
  next: string;
}

export const signup = (email: string, password: string) => bodyOf<KeyAndNext>('/api/auth/signup', post({ email, password }));

export const login = (email: string, password: string, next?: string) =>
  bodyOf<{ next: string }>('/api/auth/login', post({ email, password, ...(next ? { next } : {}) }));

export async function logout(): Promise<void> {
  await call('/api/auth/logout', post());
}

export const recover = (email: string, recoveryKey: string, newPassword: string) =>
  bodyOf<KeyAndNext>('/api/auth/recover', post({ email, recoveryKey, newPassword }));

/** Replaces the key: the old one stops working. */
export const createRecoveryKey = (currentPassword: string) =>
  bodyOf<{ recoveryKey: string }>('/api/account/recovery-key', post({ currentPassword }));

/** The seller has downloaded, copied or printed the key, so the banner goes. */
export async function markRecoverySaved(): Promise<void> {
  await call('/api/account/recovery-key', { method: 'PATCH' });
}

/** Sets a new password. Every other device is logged out; this one stays. */
export async function changePassword(currentPassword: string, password: string): Promise<void> {
  await call('/api/account/password', post({ currentPassword, password }));
}

export async function logOutOtherDevices(): Promise<void> {
  await call('/api/account/sessions', { method: 'DELETE' });
}

/** Deletes the account and its shops. The session cookie goes with it, so the caller leaves with window.location.replace. */
export async function deleteAccount(currentPassword: string): Promise<void> {
  await call('/api/account', { ...post({ currentPassword }), method: 'DELETE' });
}

export async function deleteShop(shopId: string, confirmName: string, currentPassword: string): Promise<void> {
  await call(`/api/shops/${shopId}`, { ...post({ confirmName, currentPassword }), method: 'DELETE' });
}
