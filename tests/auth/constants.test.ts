// Fixed values other work packages read: the test-mode line, the terms version, the support address.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getConfig } from '@/lib/config';
import { TEST_MODE_LINE } from '@/lib/brand/test-mode';
import { TERMS_VERSION } from '@/lib/legal/version';

describe('TEST_MODE_LINE', () => {
  it('is the sentence the brief fixes', () => {
    expect(TEST_MODE_LINE).toBe('Payments run in the PayPal sandbox, so no real money moves.');
  });
});

describe('TERMS_VERSION', () => {
  it('is the date the terms were last updated', () => {
    expect(TERMS_VERSION).toBe('2026-11-08');
  });
});

describe('getConfig().supportEmail', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('is SUPPORT_EMAIL when set', () => {
    vi.stubEnv('SUPPORT_EMAIL', ' help@shelfie.example ');
    expect(getConfig().supportEmail).toBe('help@shelfie.example');
  });

  it('is null when unset or blank', () => {
    vi.stubEnv('SUPPORT_EMAIL', '');
    expect(getConfig().supportEmail).toBeNull();
    vi.stubEnv('SUPPORT_EMAIL', '   ');
    expect(getConfig().supportEmail).toBeNull();
  });
});
