// Nothing on the account routes writes to the console, where a password, key or token could end up.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const FILES = [
  'src/lib/auth/owner.ts',
  'src/lib/auth/http.ts',
  'src/lib/client/auth.ts',
  'src/app/api/auth/signup/route.ts',
  'src/app/api/auth/login/route.ts',
  'src/app/api/auth/logout/route.ts',
  'src/app/api/auth/recover/route.ts',
  'src/app/api/auth/google/start/route.ts',
  'src/app/api/auth/google/callback/route.ts',
  'src/lib/auth/google.ts',
  'src/lib/buyer/paypal-login.ts',
  'src/lib/buyer/session.ts',
  'src/lib/db/repos/buyer-sessions.ts',
  'src/app/api/buyer/paypal/start/route.ts',
  'src/app/api/buyer/paypal/callback/route.ts',
  'src/app/api/buyer/logout/route.ts',
  'src/app/api/buyer/orders/route.ts',
  'src/app/api/account/recovery-key/route.ts',
  'src/lib/db/repos/payee-changes.ts',
];

describe('account routes and modules', () => {
  it.each(FILES)('%s never calls console', (file) => {
    expect(fs.readFileSync(path.join(process.cwd(), file), 'utf8')).not.toMatch(/\bconsole\./);
  });
});
