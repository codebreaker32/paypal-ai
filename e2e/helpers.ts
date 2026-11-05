import fs from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';

export const PHONE = { width: 390, height: 844 };
export const DESKTOP = { width: 1440, height: 900 };

const SAMPLES = path.resolve(__dirname, '..', 'public', 'samples');

/** A real JPG from public/samples, as a Playwright file payload. */
export function samplePhoto(file: string, name = file) {
  return { name, mimeType: 'image/jpeg', buffer: fs.readFileSync(path.join(SAMPLES, file)) };
}

/**
 * Puts the page in its settled, final state for screenshots: reduced motion (entrance animations
 * complete at once, even when a full-page capture re-lays the page out), web fonts loaded, and the
 * Next dev indicator hidden.
 */
export async function settle(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState('networkidle');
  // Let entrance animations (some delayed) finish; spinners loop forever and are skipped.
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getTiming().iterations !== Infinity)
        .map((a) => a.finished),
    ),
  );
}

/** Holds every POST /api/shops open until release() is called. */
export async function holdShopsApi(page: Page) {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route('**/api/shops', async (route) => {
    await gate;
    await route.fulfill({ status: 503, json: { error: { code: 'UNAVAILABLE' } } });
  });
  return release;
}
