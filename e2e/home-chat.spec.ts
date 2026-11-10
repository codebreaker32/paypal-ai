// The home page's chat: the Shelfie assistant taking orders for the example shop (src/components/landing/HomeChat.tsx).
// The console's stream is replayed from the recorded run (e2e/fixtures/console-turns.json): no Claude or PayPal calls.
// The harness (SHELFIE_TEST) starts with auto-open off; `?chat=1` turns it on here.
//
// Run: E2E_PORT=3231 npx playwright test e2e/home-chat.spec.ts
// Screenshots: HOME_CHAT_SHOTS=docs/preview E2E_PORT=3231 npx playwright test e2e/home-chat.spec.ts
import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { getConfig } from '../src/lib/config';
import { getDb } from '../src/lib/db';
import * as shopsRepo from '../src/lib/db/repos/shops';
import { createFakePayPal } from '../src/lib/paypal/fake';
import { DEMO_SHOP, seedDemoShop } from '../scripts/seed-demo';
import { DESKTOP, PHONE, a11y, settle } from './helpers';

const SLUG = DEMO_SHOP.slug;
const SHOTS = process.env.HOME_CHAT_SHOTS;
const FIXTURE = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'console-turns.json'), 'utf8')) as {
  turns: Record<string, unknown>[][];
};
const ndjson = (events: Record<string, unknown>[]) => events.map((e) => JSON.stringify(e)).join('\n') + '\n';

const LAUNCHER = 'Chat with the Shelfie assistant';
const GREETING = /Hi! I’m the Shelfie assistant\. Try me: I’m taking orders for Marigold Bakehouse, an example shop\./;

test.beforeAll(async () => {
  const db = getDb();
  if (!shopsRepo.bySlug(db, SLUG)) {
    await seedDemoShop({ db, paypal: createFakePayPal(), uploadsDir: getConfig().uploadsDir });
  }
  expect(shopsRepo.bySlug(db, SLUG)?.status).toBe('live');
});

/** The real console route answers as a newline-delimited JSON stream; this replays the recorded first turn. */
async function replayConsole(page: Page): Promise<unknown[]> {
  const bodies: unknown[] = [];
  await page.route(`**/api/assistant/**`, async (route) => {
    bodies.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: 'application/x-ndjson', body: ndjson(FIXTURE.turns[0]) });
  });
  return bodies;
}

const panel = (page: Page) => page.getByRole('dialog', { name: 'Shelfie assistant' });

/** Scrolled to the very bottom, a press at the centre of the footer's Sound switch lands on the switch, not the launcher. */
async function expectSoundClearOfLauncher(page: Page) {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(300);
  const sound = page.locator('footer').getByRole('button', { name: 'Sound', exact: true });
  await expect(sound).toBeVisible();
  const hit = await sound.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!at && (at === el || el.contains(at));
  });
  expect(hit).toBe(true);
}

/**
 * The desktop panel's proportions: clear of the hero headline, the greeting at the top of the log, the starters as
 * chips of at most two lines, the message box and Send on one row, and the panel on the launcher's right and bottom edges.
 */
async function expectBalancedPanel(page: Page) {
  await page.waitForTimeout(400);
  const m = await page.evaluate(() => {
    const rect = (el: Element | null | undefined) => el!.getBoundingClientRect();
    const panel = document.querySelector('[data-home-chat-panel]')!;
    const p = rect(panel);
    const h = rect(document.querySelector('h1'));
    const header = rect(panel.querySelector('[data-assistant-header]'));
    const greeting = rect(panel.querySelector('[data-assistant-log] p'));
    const launcher = rect(document.querySelector('.home-chat-launcher'));
    const box = rect(panel.querySelector('textarea'));
    const send = rect(panel.querySelector('button[type="submit"]'));
    const chips = [...panel.querySelectorAll('[data-starters] button')].map((b) => rect(b).height);
    return {
      overlap: !(p.right <= h.left || p.left >= h.right || p.bottom <= h.top || p.top >= h.bottom),
      greetingGap: greeting.top - header.bottom,
      rightEdges: [innerWidth - p.right, innerWidth - launcher.right],
      oneRow: Math.abs(box.bottom - send.bottom) < 1 && send.left > box.right,
      sendHeight: send.height,
      tallestChip: Math.max(...chips),
    };
  });
  expect(m.overlap).toBe(false);
  expect(m.greetingGap).toBeLessThanOrEqual(20);
  expect(m.rightEdges[0]).toBe(m.rightEdges[1]);
  expect(m.oneRow).toBe(true);
  expect(m.sendHeight).toBeGreaterThanOrEqual(44);
  expect(m.tallestChip).toBeLessThanOrEqual(60);
}

test.describe('at 1440 px', () => {
  test.use({ viewport: DESKTOP });

  test('the launcher opens and closes the chat; Esc returns focus to it; axe passes open and closed', async ({ page }) => {
    await page.goto('/?chat=0');
    await settle(page);
    const launcher = page.getByRole('button', { name: LAUNCHER, exact: true });
    await expect(launcher).toBeVisible();
    await expect(launcher.locator('[data-unread]')).toBeVisible();
    // Outside the page's sections: the landing page's four parts stay four.
    await expect(page.locator('main > section')).toHaveCount(4);
    await a11y(page);

    await launcher.click();
    const chat = panel(page);
    await expect(chat).toBeVisible();
    await expect(chat.getByText('Marigold Bakehouse · example shop', { exact: true })).toBeVisible();
    await expect(chat.getByText(GREETING)).toBeVisible();
    const starters = chat.getByRole('list', { name: 'Try asking' }).getByRole('button');
    expect(await starters.count()).toBeGreaterThanOrEqual(2);
    await expect(chat.getByRole('textbox', { name: 'Message to the assistant' })).toBeFocused();
    await expect(launcher.locator('[data-unread]')).toHaveCount(0);
    const box = await chat.boundingBox();
    expect(Math.round(box!.width)).toBe(400);
    expect(Math.round(box!.height)).toBe(520);
    await expectBalancedPanel(page);
    await a11y(page);

    await page.keyboard.press('Escape');
    await expect(chat).toHaveCount(0);
    await expect(launcher).toBeFocused();
    await expectSoundClearOfLauncher(page);
    await page.evaluate(() => window.scrollTo(0, 0));

    // The close button too.
    await launcher.click();
    await panel(page).getByRole('button', { name: 'Close the chat' }).click();
    await expect(panel(page)).toHaveCount(0);
    await expect(launcher).toBeFocused();
  });

  test('opens by itself about 4 s in without taking focus, once per session', async ({ page }) => {
    await page.goto('/?chat=1');
    await settle(page);
    await expect(panel(page)).toHaveCount(0);
    await expect(panel(page)).toBeVisible({ timeout: 8000 });
    await expect(panel(page).getByText(GREETING)).toBeVisible();
    expect(await page.evaluate(() => document.activeElement === document.body || document.activeElement === null)).toBe(true);
    await a11y(page);
    if (SHOTS) {
      await page.mouse.move(0, 0);
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${SHOTS}/chat-1440.png` });
    }

    // Closed by the visitor: it stays closed on the next page view in this session.
    await page.keyboard.press('Escape');
    await expect(panel(page)).toHaveCount(0);
    await page.reload();
    await settle(page);
    await page.waitForTimeout(5000);
    await expect(panel(page)).toHaveCount(0);
  });

  test('on a short laptop screen it stays closed, and opened by hand it stays clear of the header', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 657 });
    await page.goto('/?chat=1');
    await settle(page);
    await page.waitForTimeout(5000);
    await expect(panel(page)).toHaveCount(0);
    const cta = page.locator('header').getByRole('link', { name: 'Add your shop' });
    await expect(cta).toBeVisible();
    const ctaClear = () =>
      cta.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return !!at && (at === el || el.contains(at));
      });
    expect(await ctaClear()).toBe(true);

    await page.getByRole('button', { name: LAUNCHER, exact: true }).click();
    await expect(panel(page)).toBeVisible();
    await page.waitForTimeout(400);
    const header = await page.locator('header').first().boundingBox();
    const box = await panel(page).boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(header!.y + header!.height);
    expect(await ctaClear()).toBe(true);
    await expectBalancedPanel(page);
  });

  for (const [width, height] of [[1024, 768], [1280, 800], [1920, 1080]] as const) {
    test(`at ${width} x ${height} the panel keeps its proportions and stays clear of the headline`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto('/?chat=0');
      await settle(page);
      await page.getByRole('button', { name: LAUNCHER, exact: true }).click();
      await expect(panel(page)).toBeVisible();
      const box = await panel(page).boundingBox();
      expect(Math.round(box!.width)).toBe(400);
      expect(Math.round(box!.height)).toBe(520);
      await expectBalancedPanel(page);
      if (SHOTS && width !== 1024) {
        await page.locator('textarea').blur();
        await page.mouse.move(0, 0);
        await page.screenshot({ path: `${SHOTS}/chat-${width}.png` });
      }
    });
  }

  test('a starter goes to the assistant and its streamed answer shows', async ({ page }) => {
    const bodies = await replayConsole(page);
    await page.goto('/?chat=0');
    await settle(page);
    await page.getByRole('button', { name: LAUNCHER, exact: true }).click();
    const chat = panel(page);
    const starter = chat.getByRole('list', { name: 'Try asking' }).getByRole('button').first();
    const prompt = (await starter.innerText()).trim();
    await starter.click();
    const log = chat.getByRole('log', { name: 'Conversation' });
    await expect(log.getByText(prompt)).toBeVisible();
    await expect(log.getByText('Should I place it? Reply yes to confirm.')).toBeVisible();
    expect(bodies).toEqual([{ text: prompt }]);
    await a11y(page);
  });
});

test.describe('at 390 px', () => {
  test.use({ viewport: PHONE });

  test('a greeting bubble, not the sheet, appears by itself; it taps through to the bottom sheet', async ({ page }) => {
    await page.goto('/?chat=1');
    await settle(page);
    const bubble = page.getByRole('button', { name: 'Hi! Want to try ordering?' });
    await expect(bubble).toBeVisible({ timeout: 8000 });
    await expect(panel(page)).toHaveCount(0);
    await a11y(page);

    await bubble.click();
    const sheet = panel(page);
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText(GREETING)).toBeVisible();
    await expect(bubble).toHaveCount(0);
    // A bottom sheet: it meets the bottom of the screen, full width.
    await page.waitForTimeout(600);
    const box = await sheet.boundingBox();
    expect(Math.round(box!.width)).toBe(PHONE.width);
    expect(Math.round(box!.y + box!.height)).toBe(PHONE.height);
    await a11y(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/chat-390.png` });

    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await expect(page.getByRole('button', { name: LAUNCHER, exact: true })).toBeFocused();
    await expectSoundClearOfLauncher(page);

    // Once per session.
    await page.reload();
    await settle(page);
    await page.waitForTimeout(5000);
    await expect(bubble).toHaveCount(0);
  });
});
