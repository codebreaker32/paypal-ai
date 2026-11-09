// SR20: the harness flags mean nothing on a real deployment.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { authLimitsSkipped, guestShopsAllowed } from '@/lib/auth/guest';

afterEach(() => vi.unstubAllEnvs());

describe('guestShopsAllowed', () => {
  it('honours SHELFIE_ALLOW_GUEST_SHOPS=1 off Render', () => {
    vi.stubEnv('RENDER', '');
    vi.stubEnv('SHELFIE_ALLOW_GUEST_SHOPS', '1');
    expect(guestShopsAllowed()).toBe(true);
  });

  it('ignores the flag on Render', () => {
    vi.stubEnv('RENDER', 'true');
    vi.stubEnv('SHELFIE_ALLOW_GUEST_SHOPS', '1');
    expect(guestShopsAllowed()).toBe(false);
  });

  it('is closed without the flag, off Render', () => {
    vi.stubEnv('RENDER', '');
    vi.stubEnv('SHELFIE_ALLOW_GUEST_SHOPS', '');
    expect(guestShopsAllowed()).toBe(false);
  });

  it('accepts only the exact value 1', () => {
    vi.stubEnv('RENDER', '');
    vi.stubEnv('SHELFIE_ALLOW_GUEST_SHOPS', 'true');
    expect(guestShopsAllowed()).toBe(false);
  });
});

describe('authLimitsSkipped', () => {
  it('is true with SHELFIE_TEST off Render', () => {
    vi.stubEnv('RENDER', '');
    vi.stubEnv('SHELFIE_TEST', '1');
    expect(authLimitsSkipped()).toBe(true);
  });

  it('is false without SHELFIE_TEST', () => {
    vi.stubEnv('RENDER', '');
    vi.stubEnv('SHELFIE_TEST', '');
    expect(authLimitsSkipped()).toBe(false);
  });

  it('ignores SHELFIE_TEST on Render', () => {
    vi.stubEnv('RENDER', 'true');
    vi.stubEnv('SHELFIE_TEST', '1');
    expect(authLimitsSkipped()).toBe(false);
  });
});
