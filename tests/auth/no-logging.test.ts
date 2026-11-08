// SR23: nothing in the account modules writes to the console, where a password, key or token could end up.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.join(process.cwd(), 'src/lib');
const MODULES = [
  'auth/password.ts',
  'auth/password-policy.ts',
  'auth/common-passwords.ts',
  'auth/recovery.ts',
  'auth/session.ts',
  'auth/next-path.ts',
  'auth/guest.ts',
  'db/repos/accounts.ts',
  'db/repos/sessions.ts',
];

describe('auth modules', () => {
  it.each(MODULES)('%s never calls console', (file) => {
    expect(fs.readFileSync(path.join(ROOT, file), 'utf8')).not.toMatch(/\bconsole\./);
  });
});
