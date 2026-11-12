// Screen recordings of the motion: the start page's story, the shop page (scroll, a
// section jump, a console order) and the dashboard (a waiting order turns paid while the seller watches), each at
// 1440 and 390 px. Not a test of behaviour: it only records. Skipped unless SHELFIE_RECORDINGS names an output folder.
//
// Run: SHELFIE_RECORDINGS=artifacts/recordings E2E_PORT=3190 npx playwright test e2e/recordings.spec.ts
// The console's stream is the recorded run in e2e/fixtures/console-turns.json (no Claude or PayPal calls); the
// dashboard's shop and orders are labelled fixtures (e2e/task8-fixtures.ts) written straight into the e2e database.
import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { getConfig } from '../src/lib/config';
import { getDb } from '../src/lib/db';
import * as eventsRepo from '../src/lib/db/repos/events';
import * as ordersRepo from '../src/lib/db/repos/orders';
import * as shopsRepo from '../src/lib/db/repos/shops';
import { createFakePayPal } from '../src/lib/paypal/fake';
import { DEMO_SHOP, seedDemoShop } from '../scripts/seed-demo';
import { DESKTOP, PHONE } from './helpers';
import { createFixtureShop, seedAllStates, signInAsOwner, type FixtureShop } from './task8-fixtures';

const OUT = process.env.SHELFIE_RECORDINGS;
test.skip(!OUT, 'set SHELFIE_RECORDINGS=<folder> to record');
test.describe.configure({ mode: 'serial' });
test.setTimeout(120_000);

const FIXTURE = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'console-turns.json'), 'utf8')) as {
  prompts: string[];
  turns: Record<string, unknown>[][];
};
const SIZES = [
  { label: '1440', viewport: DESKTOP, phone: false },
  { label: '390', viewport: PHONE, phone: true },
] as const;

/** One recorded page in its own context; the video is saved as <OUT>/<name>.webm when the context closes. */
async function record(
  browser: Browser,
  name: string,
  viewport: { width: number; height: number },
  run: (page: Page) => Promise<void>,
  setup?: (context: BrowserContext) => Promise<void>,
) {
  const dir = path.resolve(OUT!, '.raw');
  fs.mkdirSync(dir, { recursive: true });
  const context = await browser.newContext({ viewport, recordVideo: { dir, size: viewport } });
  if (setup) await setup(context);
  const page = await context.newPage();
  try {
    await run(page);
  } finally {
    const video = page.video();
    await context.close();
    if (video) await video.saveAs(path.resolve(OUT!, `${name}.webm`));
  }
}

/** Scrolls like a person: small wheel steps with pauses. */
async function wheel(page: Page, total: number, step = 240, pause = 260) {
  for (let done = 0; Math.abs(done) < Math.abs(total); done += Math.sign(total) * step) {
    await page.mouse.wheel(0, Math.sign(total) * step);
    await page.waitForTimeout(pause);
  }
}

const ndjson = (events: Record<string, unknown>[]) => events.map((e) => JSON.stringify(e)).join('\n') + '\n';

test.beforeAll(async () => {
  const db = getDb();
  if (!shopsRepo.bySlug(db, DEMO_SHOP.slug)) await seedDemoShop({ db, paypal: createFakePayPal(), uploadsDir: getConfig().uploadsDir });
});

test.afterAll(() => {
  fs.rmSync(path.resolve(OUT!, '.raw'), { recursive: true, force: true });
});

for (const size of SIZES) {
  test(`start page ${size.label}`, async ({ browser }) => {
    await record(browser, `start-${size.label}`, size.viewport, async (page) => {
      await page.goto('/');
      await page.waitForTimeout(12_000); // one full loop of the hero story
      await wheel(page, size.phone ? 1400 : 600);
      await page.waitForTimeout(4_000);
      await wheel(page, -(size.phone ? 1400 : 600));
      await page.waitForTimeout(1_500);
    });
  });

  test(`shop page ${size.label}`, async ({ browser }) => {
    await record(browser, `shop-${size.label}`, size.viewport, async (page) => {
      let turn = 0;
      await page.route(`**/api/assistant/${DEMO_SHOP.slug}`, async (route) => {
        const events = FIXTURE.turns[Math.min(turn++, FIXTURE.turns.length - 1)];
        await new Promise((r) => setTimeout(r, 900)); // the thinking state, briefly
        await route.fulfill({ status: 200, contentType: 'application/x-ndjson', body: ndjson(events) });
      });
      await page.goto(`/s/${DEMO_SHOP.slug}`);
      await page.waitForTimeout(1_500);
      if (!size.phone) {
        const cards = page.locator('[data-menu-item]');
        for (let i = 0; i < 3; i++) {
          const box = await cards.nth(i).boundingBox();
          if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 12 });
          await page.waitForTimeout(500);
        }
      }
      await wheel(page, 900);
      await page.waitForTimeout(800);
      // A section jump from the sticky tabs: the heading must land clear of the sticky header and the phone bar.
      const tabs = page.getByRole('navigation', { name: /menu sections|sections/i }).getByRole('link');
      const n = await tabs.count();
      if (n > 2) {
        await tabs.nth(2).click();
        await page.waitForTimeout(1_600);
        await tabs.nth(n - 1).click();
        await page.waitForTimeout(1_600);
      }
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
      await page.waitForTimeout(1_200);
      await page.getByRole('button', { name: 'Order with an assistant' }).filter({ visible: true }).first().click();
      const input = page.getByRole('textbox', { name: 'Message to the assistant' }).filter({ visible: true });
      await expect(input).toBeVisible();
      await input.pressSequentially(FIXTURE.prompts[0], { delay: 18 });
      await page.getByRole('button', { name: 'Send' }).filter({ visible: true }).click();
      await page.waitForTimeout(3_500);
      await input.pressSequentially(FIXTURE.prompts[1], { delay: 18 });
      await page.getByRole('button', { name: 'Send' }).filter({ visible: true }).click();
      await expect(page.getByRole('link', { name: /Approve \$27\.00 on PayPal/ }).filter({ visible: true })).toBeVisible({ timeout: 15_000 });
      await page.waitForTimeout(3_500);
    });
  });

  // The assistant attaches to a viewport edge, and opening and closing it never moves the page's place.
  test(`assistant open and close ${size.label}`, async ({ browser }) => {
    await record(browser, `assistant-${size.label}`, size.viewport, async (page) => {
      await page.goto(`/s/${DEMO_SHOP.slug}`);
      await page.waitForTimeout(1_500);
      const open = () => page.getByRole('button', { name: 'Order with an assistant' }).filter({ visible: true }).first();
      const close = () => page.getByRole('button', { name: 'Close the assistant' }).filter({ visible: true });
      for (const scroll of [0, 900, 1_800]) {
        await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), scroll);
        await page.waitForTimeout(700);
        await open().click();
        await expect(close()).toBeVisible();
        await page.waitForTimeout(1_600);
        await close().click();
        await page.waitForTimeout(1_000);
      }
    });
  });

  // Every control answers a press. Slow, deliberate presses so each frame of the response is visible.
  test(`pressing controls ${size.label}`, async ({ browser, baseURL }) => {
    const f: FixtureShop = createFixtureShop('Juniper Press Co');
    seedAllStates(f);
    const hold = async (page: Page, target: ReturnType<Page['locator']>) => {
      await target.scrollIntoViewIfNeeded();
      const box = (await target.boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 8 });
      await page.waitForTimeout(350);
      await page.mouse.down();
      await page.waitForTimeout(400);
      await page.mouse.up();
      await page.waitForTimeout(700);
    };
    try {
      await record(
        browser,
        `press-${size.label}`,
        size.viewport,
        async (page) => {
          await page.goto(`/s/${DEMO_SHOP.slug}`);
          await page.waitForTimeout(1_500);
          await hold(page, page.getByRole('button', { name: /^Add .* to your order$/ }).first());
          await hold(page, page.getByRole('button', { name: /^Add .* to your order$/ }).first());
          await page.goto(`/shops/${f.shop.id}`);
          await page.waitForTimeout(1_500);
          const nav = page.getByRole('navigation', { name: 'Shop sections' }).filter({ visible: true });
          await hold(page, nav.getByRole('link', { name: 'Menu' }));
          await hold(page, nav.getByRole('link', { name: 'Share' }));
          await hold(page, nav.getByRole('link', { name: 'Orders' }));
          await hold(page, page.getByRole('switch', { name: /Pause agent orders/ }).filter({ visible: true }));
          await hold(page, page.getByRole('switch', { name: /Pause agent orders/ }).filter({ visible: true }));
        },
        async (context) => signInAsOwner(context, f, baseURL!),
      );
    } finally {
      getDb().prepare('DELETE FROM shops WHERE id = ?').run(f.shop.id);
    }
  });

  test(`dashboard ${size.label}`, async ({ browser, baseURL }) => {
    const f: FixtureShop = createFixtureShop('Juniper Loaf Co');
    const states = seedAllStates(f);
    try {
      await record(
        browser,
        `dashboard-${size.label}`,
        size.viewport,
        async (page) => {
          await page.goto(`/shops/${f.shop.id}`);
          await page.waitForTimeout(3_000);
          // The waiting order is paid on PayPal while the seller watches; the dashboard's poll (5 s) finds it.
          const db = getDb();
          ordersRepo.casStatus(db, states.waiting.id, 'awaiting_approval', 'paid');
          ordersRepo.update(db, states.waiting.id, { paidAt: new Date().toISOString(), captureId: 'E2ERECORDCAP0001', payerName: 'Lee Ames', payerEmail: 'lee.ames@example.com' });
          eventsRepo.add(db, states.waiting.id, 'paypal_approved', 'return_url');
          eventsRepo.add(db, states.waiting.id, 'capture_completed', 'return_url', { captureId: 'E2ERECORDCAP0001' });
          await page.waitForTimeout(9_000);
          await wheel(page, size.phone ? 700 : 300);
          await page.waitForTimeout(1_500);
          await wheel(page, -(size.phone ? 700 : 300));
          await page.getByText(states.nutOrder.number).first().click();
          await page.waitForTimeout(4_000);
        },
        async (context) => signInAsOwner(context, f, baseURL!),
      );
    } finally {
      getDb().prepare('DELETE FROM shops WHERE id = ?').run(f.shop.id);
    }
  });
}
