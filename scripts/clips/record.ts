// npm run clips [-- --only 03,06] [--base-url http://localhost:3251] [--display :97] [--port 3251] [--build]
//
// Records the raw screen clips for the demo video, one MP4 per shot of docs/DEMO.md, into video/clips/ (1920x1080,
// constant 30 fps, H.264). No narration, music or editing: a person cuts the video from these. video/clips/README.md
// lists the clips and what each shows.
//
// Without --base-url it builds the app if needed and runs its own production server on port 3251 with its own database
// (data/clips/), seeds the demo shop (paid to PAYPAL_SANDBOX_SELLER_EMAIL) and logs in as its owner. The sandbox
// logins and owner links never reach the screen (scripts/clips/redact.browser.js) or this script's output; the PayPal
// login itself is never recorded (06 stops before it, 06b starts after it).
//
// --only takes clip ids or their prefixes (03, 03b, 06, 08-dashboard-brief). A shot that needs an earlier one still runs it
// unrecorded (03 drives 02's steps), 06, 06b and 08 are recorded together (08 opens on the dashboard the seller left open
// while the buyer paid, so its toast and glow play on camera), and 09 uses the order 06 paid. 08 alone opens a fresh
// dashboard on that order (no toast: it is paid already). 03b is a live Claude call too: it first clears the photos of the
// two croissants it finds (unrecorded), so they fill in on camera.
//
// The UI moves (sections rise in, totals count up, statuses crossfade: up to about 400 ms), so a shot waits for what it
// shows to come to rest (`settled`) and for its photos and drawings to load (`picturesReady`) before holding on it.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parse } from 'dotenv';
import type { BrowserContext, Frame, Locator, Page } from '@playwright/test';
import { cancelUnpaid, readState, resetDemoShop, startApp, writeState, WORK, type App } from './app';
import { leaks, redactorScript } from './redact';
import { FPS, H, W, goApp, openStage, openTerminal, sleep, startCapture, startDisplay, type Display, type Stage, type Terminal } from './stage';

/** CLIPS_OUT=<dir> records somewhere else (a trial run that keeps the clips in video/clips). */
const OUT = path.resolve(process.env.CLIPS_OUT || 'video/clips');
const PHOTO = path.resolve('public/samples/marigold-bakehouse.jpg');
/** 01's paper menu (a licensed photo, docs/ASSETS.md); the Marigold sample stands in until it is added. */
const PAPER_MENU = path.resolve('video/project/assets/paper-menu.jpg');
/**
 * The stranger who signs up in 02a. Made up (example.com) and unique per run, and never legible on screen: the field is
 * drawn as dots while it is typed and the redactor shows the address as the app's masked form (r•••@example.com).
 */
const CLIP_EMAIL = `rosa.bakes.${Date.now().toString(36)}@example.com`;
const CLIP_SHOP_NAME = 'Marigold Bakehouse';
/** The display case for 03b (a Pexels photo, docs/ASSETS.md), and the demo shop's items Claude finds in it. */
const COUNTER_PHOTO = path.resolve('public/samples/counter-case.jpg');
const COUNTER_ITEMS = ['Butter croissant', 'Almond croissant'];
const DEMO_SLUG = 'marigold-bakehouse';
const CONSOLE_ASK = 'Two almond croissants and a sourdough, shipped to me. I have a nut allergy.';

// ---- arguments and secrets ----------------------------------------------------------------------------------------

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
}
const ONLY = arg('--only')?.split(',').map((s) => s.trim()).filter(Boolean) ?? null;
const BASE_URL = arg('--base-url');
const DISPLAY = arg('--display') ?? ':97';
const BUILD = process.argv.includes('--build');
const PORT = Number(arg('--port') ?? 3251);

/** .env as values (never printed); the process env wins, as with the app. */
const fileEnv = fs.existsSync('.env') ? parse(fs.readFileSync('.env')) : {};
const env = (k: string): string | undefined => process.env[k] || fileEnv[k] || undefined;
const SELLER = env('PAYPAL_SANDBOX_SELLER_EMAIL') ?? null;
const BUYER = { email: env('PAYPAL_SANDBOX_BUYER_EMAIL') ?? null, password: env('PAYPAL_SANDBOX_BUYER_PASSWORD') ?? null };
const LOGINS = [SELLER, BUYER.email].filter((l): l is string => Boolean(l));

const say = (line: string) => {
  if (leaks(line, LOGINS)) throw new Error('refusing to print a line holding a sandbox login or owner link');
  console.log(line);
};

// ---- recording ----------------------------------------------------------------------------------------------------

const wanted = (id: string) => (!ONLY ? !EXTRA.has(id) : ONLY.some((o) => id.startsWith(o)));
const results: { id: string; seconds: number; frames: number; dup: number; drop: number; note?: string }[] = [];

/** Records `id` while `body` runs (or just runs it, when --only leaves `id` out). */
async function clip(display: Display, id: string, body: () => Promise<void>, opts: { lead?: number; tail?: number } = {}): Promise<void> {
  if (!wanted(id)) {
    await body();
    return;
  }
  // Recorded under a temporary name and moved into place only if the shot worked, so a failed take keeps the last good one.
  const file = path.join(OUT, `${id}.mp4`);
  const partial = path.join(OUT, `.partial-${id}.mp4`);
  const cap = startCapture(display, partial);
  const t0 = Date.now();
  await sleep(opts.lead ?? 700);
  let ok = false;
  try {
    await body();
    await sleep(opts.tail ?? 1200);
    ok = true;
  } finally {
    const seconds = (Date.now() - t0) / 1000;
    const c = await cap.stop();
    if (ok) {
      fs.renameSync(partial, file);
      results.push({ id, seconds, ...c });
      const behind = c.dup > c.frames * 0.02 ? '  ← x11grab fell behind: re-record this clip' : '';
      say(`  ✔ ${id}.mp4  ${seconds.toFixed(1)} s, ${c.frames} frames (dup ${c.dup}, drop ${c.drop})${behind}`);
    } else {
      fs.rmSync(partial, { force: true });
      say(`  ✘ ${id}: not kept (the shot failed after ${seconds.toFixed(1)} s)`);
    }
  }
}

/** Screen time for the viewer (reading, looking). Never a wait for the app: that is `settled` or a locator's wait. */
const hold = sleep;

/**
 * Waits until `loc` is at rest: visible, its box and its opacity (with its ancestors') unchanged for about 100 ms, the
 * same for the Motion entrances inside it (stagger items, reveals, console entries: Motion drives those from script,
 * not as Web Animations), and no finite CSS or Web animation running inside it. Covers the UI's entrances (rise-ins,
 * count-ups, crossfades, up to about 400 ms) and a smooth scroll still moving it. Spinners and shimmer don't count.
 */
async function settled(loc: Locator, timeoutMs = 6000): Promise<void> {
  await loc.waitFor({ state: 'visible', timeout: 30_000 });
  // Browser code: no named inner functions (tsx's esbuild wraps those in a `__name` helper the page doesn't have).
  await loc.evaluate(async (el, ms) => {
    const end = performance.now() + ms;
    const entrances = '[data-slot="stagger-item"], [data-slot="reveal"], [data-entrance]';
    let last = '';
    for (let still = 0; performance.now() < end; ) {
      await new Promise((r) => requestAnimationFrame(r));
      let opacity = 1;
      for (let n: Element | null = el; n; n = n.parentElement) opacity *= Number(getComputedStyle(n).opacity);
      const parts: string[] = [];
      for (const e of [el, ...[...el.querySelectorAll(entrances)].slice(0, 40)]) {
        const r = e.getBoundingClientRect();
        const o = e === el ? opacity : Number(getComputedStyle(e).opacity);
        parts.push(`${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)},${Math.round(r.height)},${o.toFixed(2)}`);
      }
      // A total counting up shows the running figure in an overlay that is empty once it lands.
      for (const c of el.querySelectorAll('[data-slot="count-up"] > [aria-hidden="true"]')) parts.push(c.textContent ?? '');
      if (el.matches('[data-slot="count-up"]')) parts.push(el.querySelector('[aria-hidden="true"]')?.textContent ?? '');
      const now = parts.join(' ');
      const moving = el
        .getAnimations({ subtree: true })
        .some((a) => a.playState === 'running' && Number.isFinite(Number(a.effect?.getComputedTiming().endTime)));
      still = now === last && !moving ? still + 1 : 0;
      if (still >= 6) return;
      last = now;
    }
  }, timeoutMs);
}

/** Scrolls `loc` into view the way a person would (smoothly), waits for it to come to rest, then holds `pause` ms. */
async function bring(loc: Locator, block: 'center' | 'start' | 'end' | 'nearest' = 'center', pause = 500): Promise<void> {
  await loc.waitFor({ state: 'visible', timeout: 30_000 });
  await loc.evaluate((el, b) => el.scrollIntoView({ behavior: 'smooth', block: b }), block);
  await settled(loc);
  await hold(pause);
}

/**
 * Waits for the pictures inside `scope` to be drawn: every photo on screen loaded, and the drawings' sprite
 * (`/illustrations.svg`, which items with no photo point at) fetched. Best effort: a slow one is not a failed shot.
 */
async function picturesReady(where: Page | Frame, scope = 'body', timeoutMs = 15_000): Promise<void> {
  await where
    .waitForFunction(
      (s) => {
        // Browser code: no named inner functions (see settled).
        const root = document.querySelector(s);
        if (!root) return true;
        for (const i of root.querySelectorAll('img')) {
          if (!i.complete && !(i.loading === 'lazy' && i.getBoundingClientRect().top >= innerHeight)) return false;
        }
        return (
          !root.querySelector('[data-illustration]') ||
          performance.getEntriesByType('resource').some((e) => e.name.includes('/illustrations.svg') && (e as PerformanceResourceTiming).responseEnd > 0)
        );
      },
      scope,
      { timeout: timeoutMs },
    )
    .catch(() => say(`  note: pictures in ${scope} still loading after ${timeoutMs / 1000} s`));
}

/** Hovers (the button's hover state is the viewer's cue), pauses, clicks. */
async function press(loc: Locator, pause = 500): Promise<void> {
  await loc.waitFor({ state: 'visible', timeout: 30_000 });
  await loc.hover().catch(() => {});
  await sleep(pause);
  await loc.click();
}

async function fontsReady(where: Page | Frame): Promise<void> {
  await where.evaluate(() => document.fonts.ready.then(() => undefined)).catch(() => {});
}

// ---- 01: the handwritten menu ---------------------------------------------------------------------------------------

/** The paper menu on a blurred copy of itself, zooming in slowly over 28 s, the length of the video's opening line (rendered by ffmpeg from the image, not grabbed). */
function shot01(): void {
  const id = '01-paper-menu';
  if (!wanted(id)) return;
  const photo = fs.existsSync(PAPER_MENU) ? PAPER_MENU : PHOTO;
  if (photo !== PAPER_MENU) say(`  note: ${path.relative(process.cwd(), PAPER_MENU)} is missing; 01 uses the Marigold sample instead`);
  const file = path.join(OUT, `${id}.mp4`);
  const seconds = 28;
  const frames = seconds * FPS;
  // A 3840x2160 still (blurred cover + the sharp photo, fitted), then zoompan from 1.0 to 1.12 into 1920x1080.
  const filter = [
    `[0:v]split[a][b]`,
    `[a]scale=3840:2160:force_original_aspect_ratio=increase,crop=3840:2160,gblur=sigma=40,eq=brightness=-0.06[bg]`,
    `[b]scale=-2:2000[fg]`,
    `[bg][fg]overlay=(W-w)/2:(H-h)/2,format=yuv420p[still]`,
    `[still]zoompan=z='1+0.12*on/${frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${W}x${H}:fps=${FPS}[v]`,
  ].join(';');
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-loop', '1', '-i', photo, '-filter_complex', filter, '-map', '[v]', '-frames:v', String(frames),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-movflags', '+faststart', file], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('ffmpeg could not render 01');
  results.push({ id, seconds, frames, dup: 0, drop: 0, note: `rendered from ${path.basename(photo)}` });
  say(`  ✔ ${id}.mp4  ${seconds} s, ${frames} frames (rendered by ffmpeg from the photo)`);
}

// ---- 02, 03: snap → reading → review → publish (phone) --------------------------------------------------------------

/**
 * Before the page's own scripts in every frame of 02a's browser: the recovery key's groups drawn as dots (the key itself
 * is only in a screen-reader span, which is never painted). `__clipsMaskKey()` adds the style again if hydration
 * dropped it; the recorder checks it is in force before the key screen is held.
 */
const MASK_RECOVERY_KEY = `(() => {
  const css = '[data-testid="recovery-key"] + div > span { font-size: 0 !important; letter-spacing: 0 !important; }' +
    '[data-testid="recovery-key"] + div > span::before { content: "••••"; font-size: 1.25rem; }';
  const add = () => {
    if (document.getElementById('clips-mask-key')) return;
    const st = document.createElement('style');
    st.id = 'clips-mask-key';
    st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
  };
  window.__clipsMaskKey = add;
  if (document.documentElement) add();
  document.addEventListener('DOMContentLoaded', add);
})();`;

async function sceneSetup(display: Display, app: App): Promise<void> {
  if (!SELLER) throw new Error('03 needs PAYPAL_SANDBOX_SELLER_EMAIL in .env: the new shop must be paid to the sandbox seller');
  const stage = await openStage(display, 'phone', {
    origin: app.origin,
    profileDir: path.join(WORK, 'profile-phone'),
    initScripts: [redactorScript([...LOGINS, CLIP_EMAIL]), MASK_RECOVERY_KEY],
  });
  try {
    const f = stage.app;
    await goApp(stage, `${app.origin}/signup`);
    const emailField = f.locator('#signup-email');
    await emailField.waitFor();
    await fontsReady(f);
    await sleep(800);

    // 02a: a stranger signs up (the email drawn as dots, the password as a password field) and saves no key on camera.
    await clip(display, '02a-signup', async () => {
      await hold(1500);
      await emailField.evaluate((el) => (el as HTMLElement).style.setProperty('-webkit-text-security', 'disc'));
      await emailField.click();
      await emailField.pressSequentially(CLIP_EMAIL, { delay: 45 });
      await hold(500);
      const password = f.locator('#new-password');
      await password.click();
      await password.pressSequentially(`marigold-${crypto.randomUUID().slice(0, 12)}`, { delay: 45 });
      await hold(900);
      await f.evaluate(() => (window as unknown as { __clipsMaskKey?: () => void }).__clipsMaskKey?.());
      await press(f.getByRole('button', { name: 'Create account', exact: true }), 600);
      const keyHeading = f.getByRole('heading', { level: 1, name: 'Save your recovery key' });
      await keyHeading.waitFor({ timeout: 30_000 });
      await f.evaluate(() => (window as unknown as { __clipsMaskKey?: () => void }).__clipsMaskKey?.());
      const masked = await f
        .locator('[data-testid="recovery-key"] + div > span')
        .first()
        .evaluate((el) => getComputedStyle(el).fontSize === '0px');
      if (!masked) throw new Error('the recovery key is not masked, so 02a is not kept');
      await hold(2200);
      // Not shown: the key counts as saved (as Download, Copy or Print would), so no "Save your recovery key" banner follows.
      await f.evaluate(() => fetch('/api/account/recovery-key', { method: 'PATCH' }).then(() => undefined));
      await press(f.getByRole('button', { name: 'Continue', exact: true }), 500);
      await f.getByRole('heading', { level: 1, name: 'Add your shop' }).waitFor({ timeout: 30_000 });
      await f.getByRole('button', { name: /Snap your price list/ }).waitFor();
      await fontsReady(f);
      await settled(f.getByRole('heading', { level: 1, name: 'Add your shop' }));
      await hold(2000);
    });
    await f.getByRole('button', { name: /Snap your price list/ }).waitFor();
    await sleep(300);

    await clip(display, '02-snap-reading', async () => {
      await hold(600); // 02a ends on this screen already
      const chooser = stage.page.waitForEvent('filechooser');
      await press(f.getByRole('button', { name: /Snap your price list/ }));
      await (await chooser).setFiles(PHOTO);
      // The picked photo's thumbnail and the button that became "Read my menu".
      await picturesReady(f, 'ul[aria-label="Photos to read"]');
      await hold(1500);
      await press(f.getByRole('button', { name: /Read my menu/ }));
      const reading = f.getByRole('heading', { level: 1, name: 'Reading your menu…' });
      await reading.waitFor({ timeout: 60_000 });
      await picturesReady(f); // the menu photo under its scan line
      await f.getByRole('heading', { level: 1, name: 'Check your menu' }).waitFor({ timeout: 180_000 });
      await fontsReady(f);
      // The review rises in (its header, then the first question card with the item's drawing).
      await settled(f.locator('section[aria-labelledby="needs-title"] article').first());
      await picturesReady(f);
      await hold(3000);
    });
    const shopId = new URL(f.url()).pathname.split('/')[2];
    writeState({ setupShopId: shopId });

    await clip(display, '03-review-publish', async () => {
      await hold(1000);
      // The plain questions: one tap each.
      const needs = f.locator('section[aria-labelledby="needs-title"] article');
      for (let left = await needs.count(), guard = 0; left > 0 && guard < 12; left = await needs.count(), guard++) {
        const card = needs.first();
        await bring(card, 'center', 400);
        await hold(1300); // time to read the question
        let done = false;
        for (const name of ['Looks right', 'Ask in person', 'Keep both']) {
          const b = card.getByRole('button', { name, exact: true });
          if (await b.count()) {
            await press(b, 400);
            done = true;
            break;
          }
        }
        if (!done) {
          for (const input of await card.getByRole('textbox').all()) await input.pressSequentially('5', { delay: 120 });
          await press(card.getByRole('button', { name: 'Save price' }));
        }
        await hold(600);
      }
      // The shop's name, as the stranger calls it (Claude usually read it off the photo already).
      const shopName = f.getByLabel('Shop name');
      if ((await shopName.count()) && (await shopName.inputValue()) !== CLIP_SHOP_NAME) {
        await bring(shopName, 'center', 400);
        await shopName.fill('');
        await shopName.pressSequentially(CLIP_SHOP_NAME, { delay: 60 });
        await hold(800);
      }
      // "Your PayPal email": the sandbox seller's, typed into a field drawn as dots (the login never shows).
      const email = f.getByLabel('Your PayPal email');
      await bring(email, 'center', 600);
      await email.evaluate((el) => (el as HTMLElement).style.setProperty('-webkit-text-security', 'disc'));
      await email.click();
      await email.pressSequentially(SELLER, { delay: 55 });
      await f.getByText('Saved', { exact: true }).first().waitFor({ timeout: 20_000 });
      await hold(1500);
      const publish = f.getByRole('button', { name: /^Publish \d+ items? to PayPal$/ });
      await bring(publish, 'center', 400);
      await press(publish, 700);
      const live = f.getByRole('heading', { level: 1, name: 'Your shop is live' });
      await live.waitFor({ timeout: 180_000 });
      await fontsReady(f);
      // The shop's picture and its name beat in beside "Live".
      await settled(f.locator('header').filter({ has: live }));
      await picturesReady(f);
      await hold(2500);
      // "Your agent door" with the new shop's door link, then "Your shop link" under it.
      const door = f.getByRole('heading', { name: 'Your agent door' });
      if (await door.count()) {
        await bring(door, 'start', 800);
        await hold(2500);
      }
    });
  } finally {
    await stage.close();
  }
}

// ---- 04: the counter card (laptop) ----------------------------------------------------------------------------------

function desktopStage(display: Display, app: App, name: string, opts: { owner?: boolean; extra?: string[] } = {}): Promise<Stage> {
  return openStage(display, 'desktop', {
    origin: app.origin,
    profileDir: path.join(WORK, `profile-${name}`),
    deviceScaleFactor: 4 / 3,
    storageState: opts.owner ? app.ownerStateFile : undefined,
    initScripts: [redactorScript(LOGINS), ...(opts.owner ? [HIDE_GUEST_LOGIN] : []), ...(opts.extra ?? [])],
  });
}

async function sceneCard(display: Display, app: App): Promise<void> {
  const stage = await desktopStage(display, app, 'card', { owner: true });
  try {
    const p = stage.page;
    await p.goto(`${app.origin}/shops/${app.demoShopId}`);
    const share = p.getByRole('navigation', { name: 'Shop sections' }).getByRole('link', { name: 'Share' });
    await share.waitFor();
    await fontsReady(p);
    await picturesReady(p); // the shop's picture in the header
    await clip(display, '04-counter-card', async () => {
      await hold(1500);
      await press(share);
      const print = p.getByRole('link', { name: 'Print counter card' });
      await bring(print, 'center', 800);
      await hold(1200);
      await press(print, 600);
      await p.waitForURL(/\/card$/);
      await p.getByText(/Order ahead with any AI assistant/).first().waitFor();
      await fontsReady(p);
      await picturesReady(p); // the cover photo and the QR code
      await hold(5000);
    });
  } finally {
    await stage.close();
  }
}

// ---- 01b: the home page (laptop) ---------------------------------------------------------------------------------------

/**
 * The home page, logged out: the hero's chain plays (paper menu, the reading, an AI order, PayPal), then the chat opens
 * in the corner (opened with its launcher once the chain has played: left to itself it opens 4 s in, over the chain's
 * last steps) with its greeting and starter chips. The page is loaded once unrecorded so its fonts and pictures are
 * cached, then the clip loads it fresh, so the chain plays on camera.
 */
async function sceneHome(display: Display, app: App): Promise<void> {
  const stage = await desktopStage(display, app, 'home');
  try {
    const p = stage.page;
    await p.goto(`${app.origin}/?chat=0`);
    await p.locator('[data-chain-beat]').first().waitFor({ state: 'attached' });
    await fontsReady(p);
    await picturesReady(p, 'header');
    await sleep(1500);
    await p.goto('about:blank');
    await clip(display, '01b-home', async () => {
      // `?chat=0`: the chat would open itself 4 s in, over the chain's last steps; it is opened once the chain has played.
      await p.goto(`${app.origin}/?chat=0`);
      await fontsReady(p);
      const beats = p.locator('[data-chain-beat]');
      await beats.first().waitFor({ state: 'attached' });
      await p
        .waitForFunction(() => [...document.querySelectorAll('[data-chain-beat]')].every((e) => getComputedStyle(e).opacity === '1'), null, { timeout: 15_000 })
        .catch(() => say('  note: the hero chain had not finished after 15 s'));
      await hold(3000); // the whole chain, at rest (some beats are the phone layout's, never drawn here)
      await press(p.getByRole('button', { name: 'Chat with the Shelfie assistant' }), 600);
      const panel = p.locator('[data-home-chat-panel]');
      await panel.waitFor({ state: 'visible', timeout: 15_000 });
      await settled(panel);
      await hold(4500); // the greeting and the starter chips
    }, { lead: 200, tail: 800 }).catch(async (e) => {
      await p.screenshot({ path: path.join(os.tmpdir(), 'shelfie-clips-01b-failed.png') }).catch(() => {});
      throw e;
    });
  } finally {
    await stage.close();
  }
}

// ---- 04: the agent door (laptop) -----------------------------------------------------------------------------------

/** The demo shop's dashboard → Share: "Your agent door" and its address, held. */
async function sceneDoor(display: Display, app: App): Promise<void> {
  const stage = await desktopStage(display, app, 'door', { owner: true });
  try {
    const p = stage.page;
    await p.goto(`${app.origin}/shops/${app.demoShopId}`);
    const share = p.getByRole('navigation', { name: 'Shop sections' }).getByRole('link', { name: 'Share' });
    await share.waitFor();
    await fontsReady(p);
    await picturesReady(p); // the shop's picture in the header
    await clip(display, '04-agent-door', async () => {
      await hold(1500);
      await press(share);
      const door = p.getByText('Your agent door', { exact: true }).first();
      await door.waitFor();
      await bring(door, 'center', 600);
      await hold(8000);
    });
  } finally {
    await stage.close();
  }
}

// ---- 05b: the cart (laptop) -----------------------------------------------------------------------------------------

/** Items on the demo shop page added with their + (single-option items), then the order panel: total, Approve on PayPal. Never pays. */
const CART_ITEMS = ['Butter croissant', 'Almond croissant', 'Cardamom bun'];

async function sceneCart(display: Display, app: App): Promise<void> {
  const stage = await desktopStage(display, app, 'cart');
  try {
    const p = stage.page;
    await p.goto(`${app.origin}/s/${DEMO_SLUG}`);
    await p.getByRole('heading', { level: 1, name: 'Marigold Bakehouse' }).waitFor();
    await fontsReady(p);
    await picturesReady(p);
    const addButtons = p.getByRole('button', { name: /^Add .+ to your order$/ });
    await addButtons.first().waitFor();
    await clip(display, '05b-cart', async () => {
      await hold(1500);
      const named = [];
      for (const name of CART_ITEMS) {
        const b = p.getByRole('button', { name: `Add ${name} to your order`, exact: true });
        if (await b.count()) named.push(b.first());
      }
      // Whatever the menu holds when the names above are gone: its first single-option items.
      const picks = named.length >= 2 ? named : (await addButtons.all()).slice(0, 3);
      // One scroll to the row, then the + on each (they sit side by side in Pastries).
      await bring(picks[0], 'center', 600);
      for (const b of picks) {
        await press(b, 450);
        await hold(700);
      }
      const panel = p.locator('[data-cart-panel]');
      if (!(await panel.isVisible())) {
        await press(p.getByRole('button', { name: /^View order/ }).filter({ visible: true }).first(), 600);
      }
      await settled(panel);
      await picturesReady(p, '[data-cart-panel]');
      const approve = panel.getByRole('button', { name: /on PayPal$/ });
      await approve.waitFor();
      await approve.hover().catch(() => {});
      await hold(5000);
    });
  } finally {
    await stage.close();
  }
}

// ---- 03b: snap your counter (laptop) -------------------------------------------------------------------------------

async function sceneCounter(display: Display, app: App): Promise<void> {
  if (!env('ANTHROPIC_API_KEY')) throw new Error('03b needs ANTHROPIC_API_KEY in .env: Claude finds the items in the photo live');
  const stage = await desktopStage(display, app, 'counter', { owner: true });
  try {
    const p = stage.page;
    // Not recorded: the croissants Claude will find lose their photos (as the owner, through the app's own route), so the
    // clip shows their rows fill in.
    const menu = await doorItems(app);
    for (const name of COUNTER_ITEMS) {
      const item = menu.find((i) => i.name === name);
      if (!item) throw new Error(`no ${name} on the demo shop`);
      const res = await stage.context.request.delete(`${app.origin}/api/shops/${app.demoShopId}/items/${item.id}/photo`);
      if (!res.ok()) throw new Error(`removing the ${name} photo answered ${res.status()} (owner cookie?)`);
    }
    await p.goto(`${app.origin}/shops/${app.demoShopId}`);
    const menuTab = p.getByRole('navigation', { name: 'Shop sections' }).getByRole('link', { name: 'Menu' });
    await menuTab.waitFor();
    await fontsReady(p);
    await picturesReady(p); // the shop's picture in the header
    const row = (name: string) => p.locator(`li[data-item="${name}"]`);
    /** A row's photo: an <img> named for the item (a row with no photo shows its drawing, which is decorative). */
    const rowPhoto = (name: string) => row(name).locator('img').and(p.getByAltText(name, { exact: true }));

    await clip(display, '03b-snap-counter', async () => {
      await hold(1500);
      await press(menuTab);
      const snap = p.locator('label').filter({ has: p.locator('input[aria-label="Snap your counter"]') });
      await snap.waitFor();
      await picturesReady(p, '[data-section-panel]'); // the rows' photos, and the croissants' drawings
      await hold(1200);
      // The two croissant rows, with their drawings (no photo).
      await bring(row(COUNTER_ITEMS[0]), 'center', 600);
      await hold(1800);
      await bring(snap, 'center', 400);
      const chooser = p.waitForEvent('filechooser');
      await press(snap, 700);
      await (await chooser).setFiles(COUNTER_PHOTO);
      const sheet = p.getByRole('dialog', { name: 'Snap your counter' });
      await sheet.getByText('Finding your items…').waitFor({ timeout: 20_000 });
      const found = sheet.getByRole('list', { name: 'Photos found' });
      const failed = sheet.getByRole('alert');
      await found.or(failed).first().waitFor({ timeout: 120_000 });
      if (await failed.isVisible()) throw new Error(`snap your counter failed: ${await failed.innerText()}`);
      // Claude's crops, one per item it found, rise in one after another.
      await picturesReady(p, 'dialog[open]');
      await settled(found);
      await hold(2500);
      // Use on the croissants' proposals only (they have no photo now); any other item Claude finds is left as it is.
      for (const name of COUNTER_ITEMS) {
        const b = sheet.getByRole('button', { name: `Use: ${name}`, exact: true });
        if (!(await b.count())) continue;
        await press(b, 600);
        await sheet.locator(`[data-proposal="${name}"]`).getByText('Added').waitFor({ timeout: 30_000 });
        await hold(1000);
      }
      await hold(1500);
      await press(sheet.getByRole('button', { name: 'Done' }), 500);
      await sheet.waitFor({ state: 'hidden' });
      // The rows' thumbnails, filled in.
      await bring(row(COUNTER_ITEMS[0]), 'center', 400);
      await picturesReady(p, '[data-section-panel]');
      await hold(4000);
    });
    const kept = [];
    for (const n of COUNTER_ITEMS) if (await rowPhoto(n).count()) kept.push(n);
    say(`  snap your counter: photos now on ${kept.join(', ') || 'neither croissant'}`);
  } finally {
    await stage.close();
    // Not recorded: the demo shop gets its bundled photos back, whether the take worked or not. The crops are seller
    // uploads (/i/), which the seed never replaces, so without this they (or no photo) would stay on the shop.
    console.log('  resetting the demo shop after 03b (npm run seed -- --reset)…');
    await resetDemoShop(app, LOGINS);
  }
}

// ---- 05, 07: terminal shots -------------------------------------------------------------------------------------------

interface TermStep {
  pause?: number;
  type?: string;
  msPerChar?: number;
  run?: boolean;
}

async function terminalClip(display: Display, id: string, cwd: string, steps: TermStep[], keep: string[], timeoutMs: number): Promise<void> {
  fs.rmSync(cwd, { recursive: true, force: true });
  fs.mkdirSync(cwd, { recursive: true });
  const bin = path.join(os.tmpdir(), 'shelfie-clips-bin');
  fs.mkdirSync(bin, { recursive: true });
  fs.writeFileSync(path.join(bin, 'steps'), `#!/bin/sh\nexec "${process.execPath}" "${path.resolve('scripts/clips/claude-steps.mjs')}"\n`, { mode: 0o755 });
  const scriptFile = path.join(os.tmpdir(), `shelfie-clip-${id}.json`);
  const doneFile = path.join(os.tmpdir(), `shelfie-clip-${id}.done`);
  // The script file holds no secrets: ANTHROPIC_API_KEY, when kept, travels in the xterm's environment.
  fs.writeFileSync(scriptFile, JSON.stringify({ cwd, prompt: `${cwd} $ `, doneFile, env: { keep, path: [bin] }, steps }, null, 2));
  const termEnv: Record<string, string> = { PATH: process.env.PATH ?? '/usr/bin:/bin', HOME: os.homedir(), TERM: 'xterm-256color', LANG: 'C.UTF-8' };
  for (const k of keep) if (!termEnv[k] && env(k)) termEnv[k] = env(k)!;
  // The terminal closes after the capture has stopped, so the clip doesn't end on the bare (white) display.
  const open: { term?: Terminal } = {};
  try {
    await clip(display, id, async () => {
      open.term = openTerminal(display, scriptFile, termEnv);
      await open.term.done(timeoutMs);
      await hold(4000);
    }, { lead: 1200, tail: 0 });
  } finally {
    await open.term?.close();
    fs.rmSync(scriptFile, { force: true });
  }
}

async function sceneDiscovery(display: Display, app: App): Promise<void> {
  if (!env('ANTHROPIC_API_KEY')) throw new Error('05 needs ANTHROPIC_API_KEY in .env');
  // A demo shop with no orders: a made-up client_request_id that an earlier take used would replay that take's order.
  console.log('  resetting the demo shop (npm run seed -- --reset)…');
  await resetDemoShop(app, LOGINS);
  const shopUrl = `${app.origin}/s/${DEMO_SLUG}`;
  const command =
    `claude --bare -p "There's a bakery I like at ${shopUrl} . Please order two almond croissants for pickup, under the name Sam. ` +
    `Any total under \\$15 is fine, so you don't need to check back: place the order and give me the PayPal link." ` +
    `--strict-mcp-config --allowedTools "Bash(curl:*)" --output-format stream-json --verbose --no-session-persistence | steps`;
  await terminalClip(display, '05-claude-code-discovery', '/tmp/shelfie-door-test', [
    { pause: 1200 },
    { type: 'ls -A', msPerChar: 90 },
    { pause: 400, run: true },
    { pause: 900, type: command, msPerChar: 18 },
    { pause: 700, run: true },
  ], ['PATH', 'HOME', 'ANTHROPIC_API_KEY'], 240_000);
}

interface DoorItem {
  id: string;
  name: string;
  options: { id: string }[];
}

/** The demo shop's menu, from the door's own list_products (ids for the tamper curl and for 03b's photos). */
async function doorItems(app: App, query?: string): Promise<DoorItem[]> {
  const res = await fetch(`${app.origin}/s/${DEMO_SLUG}/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'list_products', arguments: query ? { query } : {} } }),
  });
  const text = await res.text();
  const json = text.trim().startsWith('{') ? JSON.parse(text) : JSON.parse(text.split('\n').find((l) => l.startsWith('data:'))!.slice(5));
  const data = json.result.structuredContent as { sections: { items: { id?: string; item_id?: string; name: string; options: { id?: string; option_id?: string }[] }[] }[] };
  return data.sections
    .flatMap((s) => s.items)
    .map((i) => ({ id: (i.item_id ?? i.id)!, name: i.name, options: i.options.map((o) => ({ id: (o.option_id ?? o.id)! })) }));
}

/** The demo shop's almond croissant (for the tamper curl's ids). */
async function almondIds(app: App): Promise<{ item: string; option: string }> {
  const item = (await doorItems(app, 'almond')).find((i) => /almond croissant/i.test(i.name));
  if (!item) throw new Error('no almond croissant on the demo shop');
  return { item: item.id, option: item.options[0].id };
}

async function sceneTamper(display: Display, app: App): Promise<void> {
  const ids = await almondIds(app);
  const body = JSON.stringify({
    jsonrpc: '2.0', id: 1, method: 'tools/call',
    params: { name: 'create_order', arguments: { items: [{ item_id: ids.item, option_id: ids.option, quantity: 2, price: 0.01 }], fulfillment: 'pickup', buyer_name: 'Sam' } },
  });
  const curl = `curl -s -X POST ${app.origin}/s/${DEMO_SLUG}/mcp \\\n  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \\\n  -d '${body}' \\\n  | jq '.result.content[0].text | fromjson'`;
  await terminalClip(display, '07-price-tamper', '/tmp/shelfie-price-test', [
    { pause: 1000 },
    { type: '# An agent asks the door for two almond croissants at $0.01 each', msPerChar: 30 },
    { pause: 500, run: true },
    { pause: 600, type: curl, msPerChar: 14 },
    { pause: 700, run: true },
  ], ['PATH', 'HOME'], 60_000);
}

// ---- 06, 06b: the buyer console orders, PayPal, the receipt (laptop) ---------------------------------------------------

async function waitTurn(region: Locator): Promise<void> {
  // The turn is over when the console offers "Start over" again and nothing is streaming; then its last entry (a reply,
  // or the order card, whose total counts up) has to finish rising in.
  await region.getByRole('button', { name: 'Start over' }).waitFor({ state: 'visible', timeout: 180_000 });
  await settled(region.getByRole('log', { name: 'Conversation' }).locator(':scope > [data-entrance]').last());
}

/** The rest of PayPal's buttons on its review page. */
const PAY_BUTTON = /^(Complete Purchase|Pay Now|Continue to Review Order|Agree & Pay|Pay|Pay \$[\d.,]+)$/;

/** Switches the redactor on in every frame (it starts off on paypal.com, so that PayPal's login works). */
async function redactNow(p: Page): Promise<void> {
  for (const fr of p.frames()) await fr.evaluate(() => (window as unknown as { __shelfieRedact?: () => void }).__shelfieRedact?.()).catch(() => {});
}

/**
 * Logs in on PayPal's page as the sandbox buyer, with no capture running, and returns PayPal's pay button on the review
 * page, once the redactor is on there and no login is visible.
 */
async function loginToPayPal(p: Page, display: Display): Promise<Locator> {
  const pay = p.locator('button:visible', { hasText: PAY_BUTTON }).first();
  try {
    const emailField = p.locator('#email');
    if (!(await emailField.isVisible().catch(() => false))) {
      const login = p.locator('a:visible, button:visible', { hasText: /^Log In$/ }).first();
      if (await login.count()) await login.click();
    }
    await emailField.waitFor({ state: 'visible', timeout: 60_000 });
    await emailField.fill(BUYER.email!);
    await sleep(500);
    // PayPal's two-step login: Next (its id has changed between page versions; Enter in the field always works).
    const next = p.locator('#btnNext:visible').or(p.getByRole('button', { name: 'Next', exact: true })).first();
    if (await next.isVisible().catch(() => false)) await next.click({ timeout: 10_000 }).catch(() => emailField.press('Enter'));
    // The page keeps hidden copies of its fields and buttons from the other step: only the drawn ones count.
    const passwordField = p.locator('#password:visible, input[type="password"]:visible').first();
    await passwordField.waitFor({ state: 'visible', timeout: 60_000 });
    // Typed after the step has come to rest: a value filled while the field slides in can be dropped ("Enter your password").
    await p.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await sleep(1500);
    await passwordField.click();
    await passwordField.pressSequentially(BUYER.password!, { delay: 40 });
    if (!(await passwordField.inputValue().catch(() => ''))) await passwordField.fill(BUYER.password!);
    const logIn = p.locator('#btnLogin:visible').or(p.getByRole('button', { name: 'Log In', exact: true })).first();
    await logIn.click({ timeout: 10_000 }).catch(() => passwordField.press('Enter'));
    await pay.waitFor({ state: 'visible', timeout: 90_000 });
    await p.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
    await sleep(1500);
    await redactNow(p);
    const shown = await Promise.all(p.frames().map((fr) => fr.locator('body').innerText({ timeout: 2_000 }).catch(() => '')));
    if (leaks(shown.join('\n'), LOGINS)) throw new Error("a sandbox login is visible on PayPal's review page, so 06b is not recorded");
    if (process.env.CLIPS_CHECK_LOGIN) {
      // A look at the whole display after the login (browser UI included), without recording 06b.
      spawnSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'x11grab', '-video_size', `${W}x${H}`, '-i', `${display.name}.0`, '-frames:v', '1', path.join(os.tmpdir(), 'shelfie-clips-after-login.png')]);
      throw new Error('CLIPS_CHECK_LOGIN: stopped after the login (see /tmp/shelfie-clips-after-login.png)');
    }
    return pay;
  } catch (e) {
    // Masked first, so the screenshot (kept in /tmp for a look) shows no login.
    await redactNow(p);
    await p.screenshot({ path: path.join(os.tmpdir(), 'shelfie-clips-login-failed.png') }).catch(() => {});
    const where = new URL(p.url());
    throw new Error(`PayPal login stopped on ${where.host}${where.pathname} (screenshot: /tmp/shelfie-clips-login-failed.png): ${e instanceof Error ? e.message.split('\n')[0] : e}`);
  }
}

async function sceneConsole(display: Display, app: App): Promise<void> {
  if (!BUYER.email || !BUYER.password) throw new Error('06 needs PAYPAL_SANDBOX_BUYER_EMAIL and PAYPAL_SANDBOX_BUYER_PASSWORD in .env');
  // When 05 ran in this take it reset the shop, so its one unpaid order is Claude Code's: keep it alive, so the
  // dashboard in 08 shows the agent's order waiting for payment rather than "Cancelled" (video round fix 1). A take
  // without 05 clears rehearsal orders first (one caller can hold 3 unpaid orders).
  if (!wanted('05-claude-code-discovery')) cancelUnpaid(app, LOGINS);
  const stage = await desktopStage(display, app, 'console');
  try {
    const p = stage.page;
    await p.goto(`${app.origin}/s/${DEMO_SLUG}`);
    await p.getByRole('heading', { level: 1, name: 'Marigold Bakehouse' }).waitFor();
    await fontsReady(p);
    await picturesReady(p); // the cover, the shop's picture, the menu's photos
    const region = p.getByRole('complementary', { name: 'Order with an assistant' });
    const input = region.getByRole('textbox', { name: 'Message to the assistant' });
    const approve = region.getByRole('link', { name: /^Approve \$[\d,.]+ on PayPal$/ });

    const sayToConsole = async (text: string, delay = 38) => {
      await input.click();
      await input.pressSequentially(text, { delay });
      await hold(500);
      await press(region.getByRole('button', { name: 'Send' }), 300);
      await waitTurn(region);
    };

    await clip(display, '06-console-order', async () => {
      await hold(1800);
      await press(p.getByRole('button', { name: 'Order with an assistant' }).filter({ visible: true }).first());
      await input.waitFor();
      await hold(1000);
      await sayToConsole(CONSOLE_ASK);
      await hold(3500); // the read-back, with the $8 shipping
      // The allergy goes on the order as a note, so the seller's AI brief can flag it (08).
      for (const reply of ['Yes, the almond croissants. Please place it, with a note about my nut allergy.', 'Yes, please place it.', 'Yes, place the order.']) {
        if (await approve.count()) break;
        await sayToConsole(reply, 90);
        await hold(1500);
      }
      await approve.waitFor({ timeout: 10_000 });
      await bring(approve, 'center', 400);
      await hold(2500);
      await press(approve, 700);
      await p.waitForURL(/sandbox\.paypal\.com/, { timeout: 60_000 });
      await p.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
      await hold(4000); // PayPal's page: the shop, the amount
    });

    // Not recorded: the seller's dashboard opens in a second window of this browser and goes behind the buyer's, like a
    // tab left open in the background while the buyer pays. 08 comes back to it.
    let dash: Page | null = null;
    if (wanted('08-dashboard-brief')) {
      dash = await backgroundDashboard(stage, app).catch((e) => {
        say(`  note: no dashboard left open for 08 (${e instanceof Error ? e.message.split('\n')[0] : e}); 08 opens a fresh one`);
        return null;
      });
      await p.bringToFront();
    }

    // Not recorded: the PayPal login (the sandbox buyer's email and password).
    const pay = await loginToPayPal(p, display);

    let orderRef = '';
    await clip(display, '06b-paypal-complete', async () => {
      await hold(3000); // PayPal's review: the total, ship-to, pay with
      await press(pay, 800);
      const deadline = Date.now() + 120_000;
      while (!p.url().startsWith(app.origin) && Date.now() < deadline) {
        await sleep(1000);
        if (p.url().startsWith(app.origin)) break;
        const more = p.locator('button:visible', { hasText: /^(Continue|Complete Purchase|Pay Now)$/ });
        if (await more.count().catch(() => 0)) await more.first().click({ timeout: 3_000 }).catch(() => {});
        const body = await p.locator('body').innerText({ timeout: 2_000 }).catch(() => '');
        if (/captcha|security challenge|are you a robot/i.test(body)) throw new Error('PayPal showed a security challenge');
      }
      await p.waitForURL(/\/o\/[^/?]+/, { timeout: 60_000 });
      orderRef = decodeURIComponent(new URL(p.url()).pathname.split('/')[2]);
      const paidTo = p.getByText(/own PayPal account/).first();
      await paidTo.waitFor({ timeout: 90_000 });
      await fontsReady(p);
      // "Paid.": the icon pops in, the title and its line rise after it (or crossfade from "Confirming").
      await settled(p.getByRole('heading', { level: 1 }));
      await hold(3500);
      await bring(paidTo, 'center', 600);
      await hold(3000);
      await press(p.getByRole('link', { name: 'Back to the assistant' }), 700);
      await p.waitForURL(/assistant=1/);
      const paid = region.getByRole('link', { name: /Paid · View receipt/ });
      await paid.waitFor({ timeout: 30_000 });
      await bring(paid, 'center', 800); // its status crossfades to Paid
      await hold(3500);
    });

    // For 08 and 09: the order, and the console's conversation (sessionStorage) so 09 can ask about it later.
    const key = `shelfie:console:${DEMO_SLUG}`;
    const value = await p.evaluate((k) => sessionStorage.getItem(k), key);
    const number = (await region.getByText(/^Order SHF-/).last().innerText().catch(() => '')).replace(/^Order /, '');
    const total = (await p.getByText(/^\$\d+\.\d{2}$/).last().innerText().catch(() => '')).trim();
    writeState({ order: { ref: orderRef, number, total }, console: value ? { key, value } : undefined });
    say(`  order ${number} (${orderRef}) paid`);

    if (dash) {
      // 08 from the dashboard left open; if that fails, sceneDashboard records 08 from a fresh one.
      await shot08FromBackground(display, app, stage, dash).catch((e) => {
        say(`  note: 08 from the open dashboard failed (${e instanceof Error ? e.message.split('\n')[0] : e}); trying a fresh dashboard`);
      });
    }
  } finally {
    await stage.close();
  }
}

// ---- 08, 09: the dashboard, its brief, tracking, and the buyer asking where it is (laptop) ------------------------------

interface ApiOrder {
  id: string;
  number: string;
  status: string;
  brief: unknown;
  paypalOrderId: string;
  captureId: string | null;
}

async function paidOrder(app: App, stage: Stage, needBrief: boolean): Promise<ApiOrder> {
  const s = readState();
  if (!s.order) throw new Error('no paid console order yet: record 06 first (npm run clips -- --only 06)');
  const end = Date.now() + 120_000;
  for (;;) {
    const res = await stage.context.request.get(`${app.origin}/api/shops/${app.demoShopId}/orders`);
    if (!res.ok()) throw new Error(`the orders API answered ${res.status()} (owner cookie?)`);
    const orders = ((await res.json()) as { orders: ApiOrder[] }).orders;
    const o = orders.find((x) => x.number === s.order!.number || x.id === s.order!.ref);
    if (!o) throw new Error(`order ${s.order.number} is not in the demo shop`);
    if (!needBrief || o.brief) return o;
    if (Date.now() > end) throw new Error(`order ${o.number} has no brief after 120 s`);
    await sleep(2000);
  }
}

/**
 * Makes one page behave as a background tab until `__clipsShowTab()` brings it back. Playwright reports every page as
 * visible, so without this the dashboard would poll while the buyer pays and its "New paid order" toast and the row's
 * glow would play off camera. The rest is the app's own code: it skips its poll while hidden and polls at once on
 * `visibilitychange`, as when a seller comes back to the tab.
 */
const BACKGROUND_TAB = `(() => {
  let hidden = true;
  try { hidden = sessionStorage.getItem('clips:tab-shown') !== '1'; } catch {}
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hidden ? 'hidden' : 'visible') });
  window.__clipsShowTab = () => {
    hidden = false;
    try { sessionStorage.setItem('clips:tab-shown', '1'); } catch {}
    document.dispatchEvent(new Event('visibilitychange'));
  };
})();`;

/** The demo shop's dashboard in a second window of the console's browser (logged in as the owner), as a background tab. */
/**
 * The seller's pages of the demo shop: it is owned by its owner cookie (the seed's, no account), so the app shell's
 * account slot reads "Log in" on the owner's own dashboard. Hidden in the clips (it stays in the layout, so nothing
 * moves): a seller with an account sees their account menu there instead.
 */
const HIDE_GUEST_LOGIN = `(() => {
  if (!location.pathname.startsWith('/shops/')) return;
  const add = () => {
    if (document.getElementById('clips-hide-login')) return;
    const st = document.createElement('style');
    st.id = 'clips-hide-login';
    st.textContent = 'a[href="/login"] { visibility: hidden !important; }';
    (document.head || document.documentElement).appendChild(st);
  };
  if (document.documentElement) add();
  document.addEventListener('DOMContentLoaded', add);
})();`;

async function backgroundDashboard(stage: Stage, app: App): Promise<Page> {
  const owner = JSON.parse(fs.readFileSync(app.ownerStateFile, 'utf8')) as { cookies: Parameters<BrowserContext['addCookies']>[0] };
  await stage.context.addCookies(owner.cookies);
  const dash = await stage.context.newPage();
  await dash.addInitScript({ content: BACKGROUND_TAB });
  await dash.addInitScript({ content: HIDE_GUEST_LOGIN });
  await dash.goto(`${app.origin}/shops/${app.demoShopId}`);
  await dash.getByRole('navigation', { name: 'Shop sections' }).getByRole('link', { name: 'Orders' }).waitFor();
  await fontsReady(dash);
  await picturesReady(dash);
  return dash;
}

/**
 * The rest of 08 once the order list is on screen: the order's row (thumbnail, items, its AI brief, total, Paid, Add
 * tracking), then its page: the AI brief (a note), Paid to (masked), the PayPal order and transaction ids, the timeline.
 */
async function orderTour(p: Page, order: ApiOrder, rowHold: number): Promise<void> {
  const orderRow = p.locator(`li[data-order="${order.number}"]`);
  await bring(orderRow, 'nearest', 400);
  await hold(rowHold);
  const link = orderRow.getByRole('link', { name: order.number, exact: true });
  await press(link, 700);
  await p.waitForURL(/\/orders\//);
  const paidTo = p.getByText('Paid to', { exact: true });
  await paidTo.waitFor();
  await fontsReady(p);
  await picturesReady(p);
  await settled(p.locator('section[aria-labelledby="brief-title"]'));
  await hold(3500); // the AI brief and its warning
  await bring(paidTo, 'center', 400);
  await hold(3500); // Paid to, the PayPal order and transaction ids
  const timeline = p.getByRole('heading', { name: 'What happened' }).first();
  if (await timeline.count()) {
    await bring(timeline, 'start', 400);
    await hold(3500);
  }
}

/**
 * 08, recorded in the console's browser right after 06b: the dashboard the seller left open before the buyer paid
 * (the order still under Waiting for payment) comes to the front; its poll sees the order paid, so the toast "New paid
 * order …" shows and the row rises into To prepare with a glow; then the order tour.
 */
async function shot08FromBackground(display: Display, app: App, stage: Stage, dash: Page): Promise<void> {
  const order = await paidOrder(app, stage, true); // the brief is written about 10 s after payment
  say(`  ${order.number}: PayPal order ${order.paypalOrderId}, transaction ${order.captureId ?? '—'}`);
  await dash.bringToFront();
  await picturesReady(dash);
  await clip(display, '08-dashboard-brief', async () => {
    await hold(2000); // the dashboard as the seller left it
    await dash.evaluate(() => (window as unknown as { __clipsShowTab: () => void }).__clipsShowTab());
    await dash.getByText(`New paid order ${order.number}`).waitFor({ timeout: 15_000 });
    await settled(dash.locator(`li[data-order="${order.number}"]`));
    await hold(3000); // the toast, and the row's glow fading (2.4 s)
    await orderTour(dash, order, 2500);
  });
}

/** 08 on its own (`--only 08`, or when 06's open dashboard failed): a fresh dashboard, the order already paid (no toast). */
async function sceneDashboard(display: Display, app: App): Promise<void> {
  if (results.some((r) => r.id === '08-dashboard-brief')) return; // recorded with 06, from the dashboard left open
  const stage = await desktopStage(display, app, 'dashboard', { owner: true });
  try {
    const p = stage.page;
    const order = await paidOrder(app, stage, true);
    say(`  ${order.number}: PayPal order ${order.paypalOrderId}, transaction ${order.captureId ?? '—'}`);
    await p.goto(`${app.origin}/shops/${app.demoShopId}`);
    await p.getByRole('navigation', { name: 'Shop sections' }).getByRole('link', { name: 'Orders' }).waitFor();
    await fontsReady(p);
    await picturesReady(p);
    await clip(display, '08-dashboard-brief', async () => {
      await hold(2500);
      // The filters, To prepare with its paid subtotal, and the order's row: thumbnail, items, total and its AI brief.
      await orderTour(p, order, 5000);
    });
  } finally {
    await stage.close();
  }
}

async function sceneTracking(display: Display, app: App): Promise<void> {
  const s = readState();
  // The console's conversation from 06, restored into this browser's sessionStorage for the shop page.
  const restore = s.console
    ? `try { if (location.pathname.startsWith('/s/') && !sessionStorage.getItem(${JSON.stringify(s.console.key)})) sessionStorage.setItem(${JSON.stringify(s.console.key)}, ${JSON.stringify(s.console.value)}); } catch {}`
    : '';
  const stage = await desktopStage(display, app, 'tracking', { owner: true, extra: restore ? [restore] : [] });
  try {
    const p = stage.page;
    const order = await paidOrder(app, stage, false);
    // A USPS-shaped number (22 digits, 9400 1118 prefix), unique per run (as e2e/capture.spec.ts).
    const tracking = `9400111${Date.now().toString().slice(-13)}${Math.floor(Math.random() * 90 + 10)}`;
    await p.goto(`${app.origin}/shops/${app.demoShopId}`);
    await p.getByRole('navigation', { name: 'Shop sections' }).getByRole('link', { name: 'Orders' }).waitFor();
    await fontsReady(p);
    await picturesReady(p);
    await clip(display, '09-tracking', async () => {
      await hold(1500);
      const add = p.locator(`li[data-order="${order.number}"]`).getByRole('link', { name: /Add tracking/ });
      await bring(add, 'center', 500);
      await hold(1200);
      await press(add, 600);
      const form = p.getByRole('form', { name: 'Add tracking' });
      await form.waitFor();
      await picturesReady(p);
      await bring(form, 'center', 500);
      await hold(1000);
      await form.getByLabel('Carrier').selectOption('USPS');
      await hold(700);
      await form.getByLabel('Tracking number').click();
      await form.getByLabel('Tracking number').pressSequentially(tracking, { delay: 45 });
      await hold(600);
      await press(form.getByRole('button', { name: /Save tracking|Send tracking to PayPal/ }));
      // "Saved…" shows for a moment (with the toast "Tracking saved"), then the page refreshes into the "Shipped" card
      // with the number and the PayPal note.
      await p.getByText(tracking).first().waitFor({ timeout: 60_000 });
      const shipped = p.getByRole('heading', { name: 'Shipped' }).first();
      const ok = await shipped.waitFor({ timeout: 20_000 }).then(() => true, () => false);
      await bring(ok ? shipped : p.getByText(tracking).first(), 'center', 400);
      await hold(4000);

      // The buyer's console: "Where's my order?"
      await p.goto(`${app.origin}/s/${DEMO_SLUG}?assistant=1`);
      const region = p.getByRole('complementary', { name: 'Order with an assistant' });
      const input = region.getByRole('textbox', { name: 'Message to the assistant' });
      await input.waitFor();
      await fontsReady(p);
      await picturesReady(p);
      await hold(2000);
      await input.click();
      await input.pressSequentially("Where's my order?", { delay: 60 });
      await hold(500);
      await press(region.getByRole('button', { name: 'Send' }), 300);
      await waitTurn(region);
      const answer = region.getByText(tracking).last();
      await answer.waitFor({ timeout: 10_000 }).catch(() => say('  note: the answer did not quote the tracking number'));
      if (await answer.count()) await bring(answer, 'center', 600);
      await hold(5000);
    });
    say(`  tracking USPS ${tracking} on ${order.number}`);
  } finally {
    await stage.close();
  }
}

// ---- 10: the architecture card ----------------------------------------------------------------------------------------

async function sceneArchitecture(display: Display, app: App): Promise<void> {
  const html = path.resolve('video/architecture.html');
  if (!fs.existsSync(html)) throw new Error('video/architecture.html is missing');
  const stage = await openStage(display, 'desktop', { origin: app.origin, profileDir: path.join(WORK, 'profile-arch') });
  try {
    await stage.page.goto(`file://${html}`);
    await fontsReady(stage.page);
    await stage.page.waitForLoadState('networkidle').catch(() => {});
    await sleep(1000);
    await clip(display, '10-architecture', async () => {
      await hold(15_000);
    }, { lead: 0, tail: 0 });
  } finally {
    await stage.close();
  }
}

// ---- main ----------------------------------------------------------------------------------------------------------------

/** `extra`: not in the cut (video/project/demo.json), so recorded only when --only names them. */
const SCENES: { ids: string[]; run: (d: Display, a: App) => Promise<void>; extra?: boolean }[] = [
  { ids: ['01b-home'], run: sceneHome },
  { ids: ['02a-signup', '02-snap-reading', '03-review-publish'], run: sceneSetup },
  { ids: ['03b-snap-counter'], run: sceneCounter, extra: true },
  { ids: ['04-agent-door'], run: sceneDoor },
  { ids: ['04-counter-card'], run: sceneCard, extra: true },
  { ids: ['05-claude-code-discovery'], run: sceneDiscovery },
  { ids: ['05b-cart'], run: sceneCart },
  { ids: ['06-console-order', '06b-paypal-complete'], run: sceneConsole },
  { ids: ['07-price-tamper'], run: sceneTamper },
  { ids: ['08-dashboard-brief'], run: sceneDashboard },
  { ids: ['09-tracking'], run: sceneTracking, extra: true },
  { ids: ['10-architecture'], run: sceneArchitecture, extra: true },
];
const EXTRA = new Set(SCENES.filter((s) => s.extra).flatMap((s) => s.ids));

async function main(): Promise<void> {
  fs.mkdirSync(OUT, { recursive: true });
  // 06 and 06b are one take (the PayPal login sits between them), and 08 opens on the dashboard left open during it.
  if (ONLY && ONLY.some((o) => '06b-paypal-complete'.startsWith(o) || '06-console-order'.startsWith(o))) {
    ONLY.push('06-console-order', '06b-paypal-complete', '08-dashboard-brief');
  }
  shot01();
  const scenes = SCENES.filter((s) => s.ids.some(wanted));
  if (!scenes.length) return;
  const display = await startDisplay(DISPLAY);
  let app: App | null = null;
  const failures: string[] = [];
  try {
    app = await startApp({ baseUrl: BASE_URL, port: PORT, build: BUILD, logins: LOGINS });
    for (const scene of scenes) {
      // 08 is usually recorded already, with 06 (from the dashboard left open).
      const todo = scene.ids.filter((id) => wanted(id) && !results.some((r) => r.id === id));
      if (!todo.length) continue;
      say(`Recording ${todo.join(', ')}…`);
      try {
        await scene.run(display, app);
      } catch (e) {
        const msg = e instanceof Error ? e.message.split('\n')[0] : String(e);
        failures.push(`${scene.ids.join(', ')}: ${leaks(msg, LOGINS) ? '(message hidden: it held a login)' : msg}`);
        console.error(`  ✘ ${failures.at(-1)}`);
      }
    }
  } finally {
    await app?.stop();
    await display.stop();
  }
  say('');
  for (const r of results) say(`${r.id}.mp4\t${r.seconds.toFixed(1)} s\t${r.frames} frames\tdup ${r.dup}`);
  if (failures.length) {
    console.error(`\n${failures.length} scene(s) failed:\n${failures.map((f) => `  ${f}`).join('\n')}`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
