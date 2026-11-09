// currentShellAccount with a real session (brief WP6, SR22): the shell's account slot and recovery banner read this.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type Database from 'better-sqlite3';

const state = vi.hoisted(() => ({
  db: null as unknown as Database.Database,
  jar: new Map<string, string>(),
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (state.jar.has(name) ? { name, value: state.jar.get(name)! } : undefined),
    set: (name: string, value: string) => void state.jar.set(name, value),
  }),
}));
vi.mock('@/lib/db', async (orig) => ({
  ...(await orig<typeof import('@/lib/db')>()),
  getDb: () => state.db,
}));

import { createTestDb } from '@/lib/db';
import * as accounts from '@/lib/db/repos/accounts';
import { startSession } from '@/lib/auth/session';
import { currentShellAccount } from '@/lib/seller/shell';

beforeEach(() => {
  state.db = createTestDb() as unknown as Database.Database;
  state.jar.clear();
});

const newAccount = () =>
  accounts.create(state.db as never, { email: 'rosa@example.com', passwordHash: 'x', recoveryHash: 'y', termsVersion: '1' });

describe('currentShellAccount', () => {
  it('is null with no session', async () => {
    await expect(currentShellAccount()).resolves.toBeNull();
  });

  it('gives the email and that the key is unsaved', async () => {
    const account = newAccount();
    await startSession(account.id);
    await expect(currentShellAccount()).resolves.toEqual({ email: 'rosa@example.com', recoveryUnsaved: true });
  });

  it('stops warning once the key is saved', async () => {
    const account = newAccount();
    await startSession(account.id);
    accounts.markRecoverySaved(state.db as never, account.id);
    await expect(currentShellAccount()).resolves.toEqual({ email: 'rosa@example.com', recoveryUnsaved: false });
  });
});
