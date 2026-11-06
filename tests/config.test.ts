import { afterEach, describe, expect, it, vi } from 'vitest';
import { getConfig } from '@/lib/config';

// tests/setup.ts loads .env, so every case pins both variables it depends on.
describe('getConfig().appUrl', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('uses APP_URL when it is set, without a trailing slash', () => {
    vi.stubEnv('APP_URL', 'https://shop.example.com/');
    vi.stubEnv('RENDER_EXTERNAL_URL', 'https://shelfie.onrender.com');
    expect(getConfig().appUrl).toBe('https://shop.example.com');
  });

  it('falls back to RENDER_EXTERNAL_URL (set by Render at runtime) when APP_URL is unset', () => {
    vi.stubEnv('APP_URL', '');
    vi.stubEnv('RENDER_EXTERNAL_URL', 'https://shelfie.onrender.com/');
    expect(getConfig().appUrl).toBe('https://shelfie.onrender.com');
  });

  it('defaults to http://localhost:3000 when neither is set', () => {
    vi.stubEnv('APP_URL', '');
    vi.stubEnv('RENDER_EXTERNAL_URL', '');
    expect(getConfig().appUrl).toBe('http://localhost:3000');
  });
});
