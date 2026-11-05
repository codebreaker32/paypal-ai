// Start page behaviour and accessibility. /api/shops is mocked; the real route arrives in Task 6.
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { DESKTOP, PHONE, samplePhoto } from './helpers';

for (const [label, viewport] of [
  ['phone', PHONE],
  ['desktop', DESKTOP],
] as const) {
  test(`no axe violations and no horizontal scroll (${label})`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test('every interactive control is at least 44 px tall at phone width', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto('/');
  const small = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('main a, main button'))
      .filter((el) => el.offsetParent !== null)
      .map((el) => ({ text: el.innerText.trim() || el.getAttribute('aria-label') || el.tagName, h: el.getBoundingClientRect().height }))
      .filter((c) => c.h < 44),
  );
  expect(small).toEqual([]);
});

test('photos upload as multipart and open the setup page', async ({ page }) => {
  let photoCount = 0;
  await page.route('**/api/shops', async (route) => {
    const body = route.request().postDataBuffer()?.toString('latin1') ?? '';
    photoCount = (body.match(/name="photos"/g) ?? []).length;
    await route.fulfill({ status: 201, json: { shopId: 'shp_test123' } });
  });
  await page.goto('/');
  await page.getByTestId('photo-input').setInputFiles([samplePhoto('marigold-bakehouse.jpg')]);
  await page.getByTestId('photo-input').setInputFiles([samplePhoto('ravi-bike-repair.jpg')]);
  await expect(page.getByRole('list', { name: 'Photos to read' }).getByRole('img')).toHaveCount(2);
  await page.getByRole('button', { name: 'Read my menu' }).click();
  await page.waitForURL('**/shops/shp_test123/setup');
  expect(photoCount).toBe(2);
});

test('a sample menu posts its id and opens the setup page', async ({ page }) => {
  let sent: unknown;
  await page.route('**/api/shops', async (route) => {
    sent = route.request().postDataJSON();
    await route.fulfill({ status: 201, json: { shopId: 'shp_sample1' } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: /Ravi’s Bike Repair/ }).click();
  await page.waitForURL('**/shops/shp_sample1/setup');
  expect(sent).toEqual({ sample: 'ravi-bike-repair' });
});

test('a removed photo can be replaced, and the primary action returns to Snap', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('photo-input').setInputFiles([samplePhoto('marigold-bakehouse.jpg')]);
  await page.getByRole('button', { name: 'Remove page 1' }).click();
  await expect(page.getByRole('button', { name: 'Snap your price list' })).toBeVisible();
});

test('the primary action is reachable by keyboard and shows a focus ring', async ({ page }) => {
  await page.goto('/');
  const snap = page.getByRole('button', { name: 'Snap your price list' });
  for (let i = 0; i < 10 && !(await snap.evaluate((el) => el === document.activeElement)); i++) {
    await page.keyboard.press('Tab');
  }
  await expect(snap).toBeFocused();
  const outline = await snap.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).toBe('solid');
});
