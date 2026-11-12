// The assistant's message box and the item draft. The draft path is driven through the `[data-order-item]` delegate by an injected button, the same
// attribute the item sheet's "Ask the assistant" uses. No Claude or PayPal calls: the console's route is replaced.
//
// Run: E2E_PORT=3231 npx playwright test e2e/composer.spec.ts
import { expect, test, type Locator, type Page } from '@playwright/test';
import { getConfig } from '../src/lib/config';
import { getDb } from '../src/lib/db';
import * as shopsRepo from '../src/lib/db/repos/shops';
import { createFakePayPal } from '../src/lib/paypal/fake';
import { DEMO_SHOP, seedDemoShop } from '../scripts/seed-demo';
import { settle } from './helpers';

const SLUG = DEMO_SHOP.slug;
const TITLE = 'Order with an assistant';

test.beforeAll(async () => {
  const db = getDb();
  if (!shopsRepo.bySlug(db, SLUG)) await seedDemoShop({ db, paypal: createFakePayPal(), uploadsDir: getConfig().uploadsDir });
});

const textbox = (region: Locator) => region.getByRole('textbox', { name: 'Message to the assistant' });
const dock = (page: Page) => page.locator('[data-assistant-dock]');
const sheet = (page: Page) => page.getByRole('dialog');
const heightOf = async (el: Locator) => Math.round((await el.boundingBox())!.height);

/** Counts turns sent to the assistant and answers each with an empty finished turn. */
async function countTurns(page: Page): Promise<() => number> {
  let sent = 0;
  await page.route(`**/api/assistant/${SLUG}`, async (route) => {
    sent += 1;
    await route.fulfill({ status: 200, contentType: 'application/x-ndjson', body: `${JSON.stringify({ type: 'text', text: 'Sure.' })}\n${JSON.stringify({ type: 'done', sessionId: 'e2e' })}\n` });
  });
  return () => sent;
}

/** What the item sheet's "Ask the assistant" will be: a control carrying the item's name. */
async function addDraftButton(page: Page, name: string): Promise<Locator> {
  await page.evaluate((itemName) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = `Draft ${itemName}`;
    b.dataset.orderItem = itemName;
    b.style.cssText = `position:fixed;top:${100 + 60 * document.querySelectorAll('[data-order-item]').length}px;left:8px;z-index:99999;padding:12px;background:white`;
    document.body.append(b);
  }, name);
  return page.getByRole('button', { name: `Draft ${name}` });
}

for (const [label, viewport, region] of [
  ['390', { width: 390, height: 844 }, sheet],
  ['1440', { width: 1440, height: 900 }, dock],
] as const) {
  test.describe(`composer at ${label}`, () => {
    test.use({ viewport });

    async function openConsole(page: Page): Promise<Locator> {
      await page.goto(`/s/${SLUG}`);
      await settle(page);
      await page.getByRole('button', { name: new RegExp(TITLE) }).filter({ visible: true }).first().click();
      const box = textbox(region(page));
      await expect(box).toBeVisible();
      return box;
    }

    test('is a labelled one-row textarea with the send key, the limit and 16 px text', async ({ page }) => {
      const box = await openConsole(page);
      const facts = await box.evaluate((el: HTMLTextAreaElement) => ({ tag: el.tagName, rows: el.rows, hint: el.enterKeyHint, max: el.maxLength, size: getComputedStyle(el).fontSize }));
      expect(facts).toEqual({ tag: 'TEXTAREA', rows: 1, hint: 'send', max: 500, size: '16px' });
      await expect(region(page).getByRole('button', { name: 'Send' })).toBeVisible();
    });

    test('grows with its text up to four lines, then scrolls', async ({ page }) => {
      const box = await openConsole(page);
      expect(await heightOf(box)).toBe(48);
      await box.fill('one\ntwo');
      await expect.poll(() => heightOf(box)).toBe(72);
      await box.fill('one\ntwo\nthree\nfour');
      await expect.poll(() => heightOf(box)).toBe(120);
      expect(await box.evaluate((el) => getComputedStyle(el).overflowY)).toBe('hidden');
      await box.fill('one\ntwo\nthree\nfour\nfive\nsix');
      await expect.poll(() => heightOf(box)).toBe(120);
      expect(await box.evaluate((el) => getComputedStyle(el).overflowY)).toBe('auto');
      await box.fill('');
      await expect.poll(() => heightOf(box)).toBe(48);
    });

    test('Enter sends and empties the box', async ({ page }) => {
      const sent = await countTurns(page);
      const box = await openConsole(page);
      await box.fill('one\ntwo\nthree');
      await box.press('Enter');
      await expect.poll(sent).toBe(1);
      await expect(box).toHaveValue('');
      await expect.poll(() => heightOf(box)).toBe(48);
      await expect(region(page).getByText('three')).toBeVisible();
    });

    test('Enter in an empty box sends nothing and adds no line', async ({ page }) => {
      const sent = await countTurns(page);
      const box = await openConsole(page);
      await box.press('Enter');
      await expect(box).toHaveValue('');
      expect(sent()).toBe(0);
    });

    test('Shift+Enter is a new line', async ({ page }) => {
      const sent = await countTurns(page);
      const box = await openConsole(page);
      await box.fill('first');
      await box.press('Shift+Enter');
      await box.pressSequentially('second');
      await expect(box).toHaveValue('first\nsecond');
      expect(sent()).toBe(0);
    });

    test('an Enter confirming an input-method composition does not send', async ({ page }) => {
      const sent = await countTurns(page);
      const box = await openConsole(page);
      await box.fill('こんにちは');
      await box.evaluate((el) => el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true, cancelable: true })));
      await expect(box).toHaveValue('こんにちは');
      expect(sent()).toBe(0);
    });
  });
}

test.describe('item draft', () => {
  const FIRST = 'I’d like the Almond croissant';
  const BOTH = `${FIRST}, and the Seeded rye`;

  test.describe('1440', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test('opens the dock with the draft, the caret at its end, sends nothing; a second item appends', async ({ page }) => {
      const sent = await countTurns(page);
      await page.goto(`/s/${SLUG}`);
      await settle(page);
      const first = await addDraftButton(page, 'Almond croissant');
      const second = await addDraftButton(page, 'Seeded rye');
      await first.click();
      const box = textbox(dock(page));
      await expect(box).toHaveValue(FIRST);
      await expect(box).toBeFocused();
      expect(await box.evaluate((el: HTMLTextAreaElement) => el.selectionStart)).toBe(FIRST.length);

      await second.click();
      await expect(box).toHaveValue(BOTH);
      await expect(box).toBeFocused();
      await expect.poll(() => box.evaluate((el: HTMLTextAreaElement) => el.selectionStart)).toBe(BOTH.length);
      expect(sent()).toBe(0);
      await expect(dock(page)).toHaveCount(1);
    });

    test('a draft survives closing the dock', async ({ page }) => {
      await page.goto(`/s/${SLUG}`);
      await settle(page);
      await (await addDraftButton(page, 'Almond croissant')).click();
      await page.getByRole('button', { name: 'Close the assistant' }).click();
      await expect(dock(page)).toHaveCount(0);
      await page.getByRole('button', { name: new RegExp(TITLE) }).filter({ visible: true }).first().click();
      await expect(textbox(dock(page))).toHaveValue(FIRST);
    });
  });

  test.describe('390', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('opens the sheet with the draft, focus on the title only, and the box is fitted once the sheet has a size', async ({ page }) => {
      const sent = await countTurns(page);
      await page.goto(`/s/${SLUG}`);
      await settle(page);
      const long = 'Almond croissant with a much longer name that wraps onto a good few lines of the box when drafted';
      await (await addDraftButton(page, long)).click();
      const box = textbox(sheet(page));
      await expect(box).toHaveValue(`I’d like the ${long}`);
      await expect(sheet(page).getByRole('heading', { name: TITLE, level: 2 })).toBeFocused();
      await expect(box).not.toBeFocused();
      await expect.poll(() => heightOf(box)).toBeGreaterThan(48);
      expect(sent()).toBe(0);
    });
  });
});
