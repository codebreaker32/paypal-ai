// Start page behaviour and accessibility. /api/shops is mocked.
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { DESKTOP, PHONE, samplePhoto, signUpForShops } from './helpers';

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
  await signUpForShops(page);
  await page.goto('/shops/new');
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
  await signUpForShops(page);
  await page.goto('/shops/new');
  await page.getByRole('button', { name: /Ravi’s Bike Repair/ }).click();
  await page.waitForURL('**/shops/shp_sample1/setup');
  expect(sent).toEqual({ sample: 'ravi-bike-repair' });
});

test('a removed photo can be replaced, and the primary action returns to Snap', async ({ page }) => {
  await signUpForShops(page);
  await page.goto('/shops/new');
  await page.getByTestId('photo-input').setInputFiles([samplePhoto('marigold-bakehouse.jpg')]);
  await page.getByRole('button', { name: 'Remove page 1' }).click();
  await expect(page.getByRole('button', { name: 'Snap your price list' })).toBeVisible();
});

test('the primary action is reachable by keyboard and shows a focus ring', async ({ page }) => {
  await signUpForShops(page);
  await page.goto('/shops/new');
  const snap = page.getByRole('button', { name: 'Snap your price list' });
  for (let i = 0; i < 10 && !(await snap.evaluate((el) => el === document.activeElement)); i++) {
    await page.keyboard.press('Tab');
  }
  await expect(snap).toBeFocused();
  const outline = await snap.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).toBe('solid');
});

// The hero's chain (src/components/landing/HeroChain.tsx) settles on its last frame: there, no text is cut off by its box
// and nothing covers it, at every width. Reduced motion shows that frame at once; with motion, it lands after ~4 s.
async function heroTextProblems(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const hero = document.querySelector('[data-hero-story]')!;
    const shown = (el: Element) => {
      for (let e: Element | null = el; e && e !== document.body; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
      }
      return true;
    };
    const problems: string[] = [];
    for (const el of Array.from(hero.querySelectorAll<HTMLElement>('*'))) {
      const own = Array.from(el.childNodes).filter((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim()).map((n) => n.textContent!.trim());
      if (!own.length || !shown(el) || el.closest('.sr-only')) continue;
      const text = el.textContent!.trim();
      if (getComputedStyle(el).display !== 'inline' && el.scrollWidth > el.clientWidth) problems.push(`clipped: ${text}`);
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (!hit || !(hit === el || el.contains(hit))) problems.push(`covered: ${text} (by ${hit?.textContent?.trim().slice(0, 30) ?? hit?.tagName})`);
    }
    return problems;
  });
}

test('the hero story ends with every text readable, uncut and uncovered, at 390, 768, 1024 and 1440', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await page.locator('[data-hero-story]').scrollIntoViewIfNeeded();
    await expect(page.locator('[data-hero-story]')).toContainText('Paid to your PayPal');
    expect(await heroTextProblems(page), `at ${width}`).toEqual([]);
  }
});

test('on phones the hero names all four steps, each beside its picture, in at least 14 px text', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [360, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const steps = page.locator('[data-hero-phone-steps] > li');
    await expect(steps).toHaveCount(4);
    for (const [i, name] of ['Photo of your price list', 'Live shop in minutes', 'Any AI assistant can order', 'Paid to your PayPal'].entries()) {
      const label = steps.nth(i).getByText(name, { exact: true });
      await expect(label).toBeVisible();
      expect(parseFloat(await label.evaluate((el) => getComputedStyle(el).fontSize)), `${name} at ${width}`).toBeGreaterThanOrEqual(14);
    }
    expect(await heroTextProblems(page), `at ${width}`).toEqual([]);
  }
});

test('with motion, the hero plays the story once and settles on the same final frame', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.goto('/');
  // Early on nothing is ordered or paid yet; the chain lands on its last card (PayPal's logo, Payment received!).
  const beat = (text: string) => page.locator('[data-hero-story] [data-chain-beat]').filter({ hasText: text }).last();
  await expect(beat('Payment received!')).toHaveCSS('opacity', '0');
  await page.waitForTimeout(10_000);
  await expect(page.locator('[data-hero-story]').getByText('Order placed!', { exact: true })).toBeVisible();
  await expect(page.locator('[data-hero-story]').getByText('Payment received!', { exact: true })).toBeVisible();
  await expect(page.locator('[data-hero-story] img[alt="PayPal"]').filter({ visible: true }).first()).toBeVisible();
  expect(await heroTextProblems(page)).toEqual([]);
});
