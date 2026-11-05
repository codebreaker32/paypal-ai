// Screenshots of the Start page for review and judging: docs/judge/screenshots/task5/.
// Run: npx playwright test e2e/start.screenshots.spec.ts
import { expect, test, type Page } from '@playwright/test';
import { DESKTOP, PHONE, holdShopsApi, samplePhoto, settle } from './helpers';

const OUT = 'docs/judge/screenshots/task5';

for (const [label, viewport] of [
  ['390', PHONE],
  ['1440', DESKTOP],
] as const) {
  test(`start page at ${label} px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await settle(page);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.screenshot({ path: `${OUT}/start-${label}.png`, fullPage: true, animations: 'disabled' });
    await page.screenshot({ path: `${OUT}/start-${label}-fold.png`, animations: 'disabled' });
  });
}

test.describe('start page states at 390 px', () => {
  test.use({ viewport: PHONE });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await settle(page);
  });

  const actions = (page: Page) => page.locator('section[aria-labelledby="start-title"]');

  /** Screenshot of the Start section with the page gutter around it, so nothing looks clipped. */
  const shoot = async (page: Page, name: string) => {
    const box = await actions(page).boundingBox();
    if (!box) throw new Error('Start section not found');
    const pad = 20;
    await page.screenshot({
      path: `${OUT}/${name}`,
      fullPage: true,
      animations: 'disabled',
      clip: { x: 0, y: Math.max(0, box.y - pad), width: PHONE.width, height: box.height + pad * 2 },
    });
  };

  test('photos ready', async ({ page }) => {
    await page.getByTestId('photo-input').setInputFiles([
      samplePhoto('marigold-bakehouse.jpg', 'page-1.jpg'),
      samplePhoto('tia-lupe-chalkboard.jpg', 'page-2.jpg'),
    ]);
    await expect(page.getByRole('button', { name: 'Read my menu' })).toBeVisible();
    await shoot(page, 'state-photos-ready-390.png');
  });

  test('uploading', async ({ page }) => {
    const release = await holdShopsApi(page);
    await page.getByTestId('photo-input').setInputFiles([samplePhoto('marigold-bakehouse.jpg')]);
    await page.getByRole('button', { name: 'Read my menu' }).click();
    await expect(page.getByRole('button', { name: /Uploading 1 photo/ })).toBeDisabled();
    await shoot(page, 'state-uploading-390.png');
    release();
  });

  test('bad file', async ({ page }) => {
    await page
      .getByTestId('photo-input')
      .setInputFiles([{ name: 'menu.heic', mimeType: 'image/heic', buffer: Buffer.from('not a jpg') }]);
    await expect(actions(page).getByRole('alert')).toHaveText("We couldn't open that photo. Try a JPG or PNG.");
    await shoot(page, 'state-bad-file-390.png');
  });

  test('too many photos', async ({ page }) => {
    const five = Array.from({ length: 5 }, (_, i) => samplePhoto('ravi-bike-repair.jpg', `page-${i + 1}.jpg`));
    await page.getByTestId('photo-input').setInputFiles(five);
    await expect(actions(page).getByRole('alert')).toContainText('up to 4 photos');
    await shoot(page, 'state-too-many-390.png');
  });

  test('opening a sample', async ({ page }) => {
    const release = await holdShopsApi(page);
    await page.getByRole('button', { name: /Tía Lupe/ }).click();
    await expect(page.getByText('Opening…')).toBeVisible();
    await shoot(page, 'state-sample-opening-390.png');
    release();
  });

  test('server error', async ({ page }) => {
    await page.route('**/api/shops', (route) =>
      route.fulfill({ status: 500, json: { error: { code: 'INTERNAL', message: 'boom' } } }),
    );
    await page.getByTestId('photo-input').setInputFiles([samplePhoto('marigold-bakehouse.jpg')]);
    await page.getByRole('button', { name: 'Read my menu' }).click();
    await expect(actions(page).getByRole('alert')).toContainText('Try again');
    await shoot(page, 'state-server-error-390.png');
  });
});
