// Run-16 final design review: captures the public and account screens that e2e/screenshots.spec.ts does not
// (home with its chat, browse, a seeded shop page with cart and assistant docked, auth, help, legal, 404).
// Against a production server on a throwaway DB seeded with `npm run seed -- --reset`:
//   BASE_URL=http://localhost:3160 OUT=docs/reviews/final/shots npx tsx docs/reviews/final/capture-public.ts
// The home chat's mid-order shot is a real Claude turn (needs ANTHROPIC_API_KEY on the server).
import fs from 'node:fs';
import path from 'node:path';
import { chromium, type Page } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://localhost:3160';
const OUT = path.resolve(process.env.OUT ?? 'docs/reviews/final/shots');
const ONLY = process.env.ONLY;
fs.mkdirSync(OUT, { recursive: true });
const SIZES = { '390': { width: 390, height: 844 }, '1440': { width: 1440, height: 900 } } as const;
const log: string[] = [];

async function settle(page: Page) {
  await page.waitForLoadState('load');
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(700);
}

async function shot(page: Page, name: string, fullPage = false) {
  await settle(page);
  // Mask any email address on screen (none of them are secrets here, but the review set never shows one).
  await page.evaluate(() => {
    const re = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/g;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) if (re.test(n.nodeValue ?? '')) n.nodeValue = (n.nodeValue ?? '').replace(re, '•••@•••');
    for (const i of Array.from(document.querySelectorAll('input'))) if (re.test(i.value)) i.value = i.value.replace(re, '•••@•••');
  });
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage });
  log.push(name);
}

type Run = (page: Page, phone: boolean) => Promise<void>;
const SCREENS: [string, Run][] = [
  ['home', async (page) => {
    await page.goto(`${BASE}/?chat=0`);
    await shot(page, 'home', true);
    await shot(page, 'home-hero');
    // Each band of the landing page in its own viewport frame.
    const sections = page.locator('main > section, main > div > section');
    const n = await sections.count();
    for (let i = 0; i < n; i++) {
      const s = sections.nth(i);
      const id = ((await s.getAttribute('aria-labelledby')) ?? (await s.getAttribute('id')) ?? `s${i}`).replace(/[^a-z0-9-]/gi, '');
      await s.scrollIntoViewIfNeeded();
      await page.evaluate((y) => window.scrollBy(0, y), -60);
      await shot(page, `home-section-${i + 1}-${id}`);
    }
    await page.locator('footer').last().scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await shot(page, 'home-footer');
  }],
  ['home-chat', async (page) => {
    await page.goto(`${BASE}/?chat=0`);
    await settle(page);
    await page.getByRole('button', { name: 'Chat with the Shelfie assistant' }).click();
    await page.waitForTimeout(1200);
    await shot(page, 'home-chat-open');
    const box = page.locator('textarea').filter({ visible: true }).first();
    await box.fill('Two almond croissants and a cardamom bun for pickup, please. Go ahead and place the order.');
    await box.press('Enter');
    // A real Claude turn: wait for menu cards or the order summary.
    await page.locator('[data-order-summary], ul[aria-label="Items from the menu"]').first().waitFor({ timeout: 120_000 }).catch(() => {});
    await page.waitForTimeout(4000);
    await shot(page, 'home-chat-mid-order');
    await page.locator('[data-order-summary]').first().waitFor({ timeout: 90_000 }).catch(() => {});
    await page.waitForTimeout(2500);
    await shot(page, 'home-chat-order-placed');
  }],
  ['browse', async (page) => {
    await page.goto(`${BASE}/browse`);
    await shot(page, 'browse', true);
    await shot(page, 'browse-first-screen');
  }],
  ['shop', async (page, phone) => {
    await page.goto(`${BASE}/s/marigold-bakehouse`);
    await shot(page, 'shop-seeded', true);
    await shot(page, 'shop-seeded-first-screen');
    // Item sheet from the first tile.
    await page.locator('main a[href*="item="], main button[aria-haspopup="dialog"]').first().click().catch(async () => {
      await page.locator('main [data-tile] , main li a').first().click();
    });
    await page.waitForTimeout(1200);
    await shot(page, 'shop-item-sheet');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);
    // Add two things to the order.
    const adds = page.getByRole('button', { name: /^Add .* to your order$/ });
    await adds.nth(0).click();
    await page.waitForTimeout(500);
    await shot(page, 'shop-add-toast');
    await adds.nth(1).click().catch(() => {});
    await page.waitForTimeout(900);
    if (phone) {
      await page.getByRole('button', { name: /View order|Your order/ }).filter({ visible: true }).first().click().catch(() => {});
      await page.waitForTimeout(1000);
      await shot(page, 'shop-cart-sheet');
      await page.getByRole('tab', { name: 'Assistant' }).filter({ visible: true }).first().click().catch(() => {});
      await page.waitForTimeout(1000);
      await shot(page, 'shop-assistant-sheet');
    } else {
      await page.getByRole('tab', { name: /^Your order/ }).filter({ visible: true }).first().click().catch(async () => {
        await page.getByRole('button', { name: /View order/ }).first().click();
      });
      await page.waitForTimeout(1000);
      await shot(page, 'shop-dock-order');
      await page.getByRole('tab', { name: 'Assistant' }).filter({ visible: true }).first().click().catch(async () => {
        await page.getByRole('button', { name: 'Order with an assistant' }).filter({ visible: true }).first().click();
      });
      await page.waitForTimeout(1000);
      await shot(page, 'shop-dock-assistant');
    }
  }],
  ['other-shop', async (page) => {
    await page.goto(`${BASE}/s/ravis-bike-repair`);
    await shot(page, 'shop-ravis-first-screen');
  }],
  ['auth', async (page) => {
    for (const p of ['login', 'signup', 'recover']) {
      await page.goto(`${BASE}/${p}`);
      await shot(page, p, true);
    }
    await page.goto(`${BASE}/login`);
    await settle(page);
    await page.getByRole('button', { name: /^Log in$/ }).click().catch(() => {});
    await page.waitForTimeout(800);
    await shot(page, 'login-empty-submit');
  }],
  ['shops-new', async (page) => {
    const email = `review-${Math.floor(Math.random() * 1e9)}@example.com`;
    const res = await page.request.post(`${BASE}/api/auth/signup`, { data: { email, password: 'a long sentence only the reviewer says' } });
    if (res.status() !== 201) throw new Error(`signup ${res.status()}`);
    await page.goto(`${BASE}/shops/new`);
    await shot(page, 'shops-new', true);
    await page.goto(`${BASE}/shops`);
    await shot(page, 'shops-list', true);
    await page.goto(`${BASE}/account`);
    await shot(page, 'account', true);
  }],
  ['static', async (page) => {
    for (const [p, name] of [['help', 'help'], ['terms', 'terms'], ['privacy', 'privacy'], ['this-page-does-not-exist', '404'], ['s/no-such-shop', '404-shop']]) {
      await page.goto(`${BASE}/${p}`);
      await shot(page, name, true);
    }
  }],
];

(async () => {
  const browser = await chromium.launch();
  for (const [label, size] of Object.entries(SIZES)) {
    for (const [key, run] of SCREENS) {
      if (ONLY && !key.startsWith(ONLY)) continue;
      const context = await browser.newContext({ viewport: size, deviceScaleFactor: 1 });
      const page = await context.newPage();
      const orig = page.screenshot.bind(page);
      page.screenshot = ((opts: Parameters<Page['screenshot']>[0]) => orig({ ...opts, path: opts?.path?.replace(/\.png$/, `-${label}.png`) })) as Page['screenshot'];
      try {
        await run(page, label === '390');
        console.log(`ok ${key} ${label}`);
      } catch (e) {
        console.log(`FAIL ${key} ${label}: ${(e as Error).message.split('\n')[0]}`);
        await page.screenshot({ path: path.join(OUT, `zz-fail-${key}.png`) }).catch(() => {});
      }
      await context.close();
    }
  }
  await browser.close();
  console.log(`${log.length} shots`);
})();
