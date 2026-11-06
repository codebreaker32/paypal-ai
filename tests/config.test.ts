import { readFileSync } from 'node:fs';
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

  it('defaults to http://localhost:3000 when neither is set and PORT is unset', () => {
    vi.stubEnv('APP_URL', '');
    vi.stubEnv('RENDER_EXTERNAL_URL', '');
    vi.stubEnv('PORT', '');
    expect(getConfig().appUrl).toBe('http://localhost:3000');
  });

  it('follows the port the server bound (Next dev moves to 3001 when 3000 is taken and sets PORT)', () => {
    vi.stubEnv('APP_URL', '');
    vi.stubEnv('RENDER_EXTERNAL_URL', '');
    vi.stubEnv('PORT', '3001');
    expect(getConfig().appUrl).toBe('http://localhost:3001');
  });

  it('keeps APP_URL over PORT when APP_URL is set', () => {
    vi.stubEnv('APP_URL', 'http://localhost:3000');
    vi.stubEnv('PORT', '3001');
    expect(getConfig().appUrl).toBe('http://localhost:3000');
  });

  it('.env.example leaves APP_URL commented out, so a copied .env does not pin the port', () => {
    expect(readFileSync('.env.example', 'utf8')).not.toMatch(/^APP_URL=/m);
  });
});
