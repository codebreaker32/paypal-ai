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
// --only takes clip ids or their prefixes (03, 06, 08-dashboard-brief). A shot that needs an earlier one still runs it
// unrecorded (03 drives 02's steps), 06 and 06b are recorded together, and 08/09 use the order 06 paid.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parse } from 'dotenv';
import type { Frame, Locator, Page } from '@playwright/test';
import { cancelUnpaid, readState, startApp, writeState, WORK, type App } from './app';
import { leaks, redactorScript } from './redact';
import { FPS, H, W, goApp, openStage, openTerminal, sleep, startCapture, startDisplay, type Display, type Stage } from './stage';

const OUT = path.resolve('video/clips');
const PHOTO = path.resolve('public/samples/marigold-bakehouse.jpg');
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

const wanted = (id: string) => !ONLY || ONLY.some((o) => id.startsWith(o));
const results: { id: string; seconds: number; frames: number; dup: number; drop: number; note?: string }[] = [];

/** Records `id` while `body` runs (or just runs it, when --only leaves `id` out). */
async function clip(display: Display, id: string, body: () => Promise<void>, opts: { lead?: number; tail?: number } = {}): Promise<void> {
  if (!wanted(id)) {
    await body();
    return;
  }
  const file = path.join(OUT, `${id}.mp4`);
  const cap = startCapture(display, file);
  const t0 = Date.now();
  await sleep(opts.lead ?? 700);
  try {
    await body();
    await sleep(opts.tail ?? 1200);
  } finally {
    const c = await cap.stop();
    const seconds = (Date.now() - t0) / 1000;
    results.push({ id, seconds, ...c });
    const behind = c.dup > c.frames * 0.02 ? '  ← x11grab fell behind: re-record this clip' : '';
    say(`  ✔ ${id}.mp4  ${seconds.toFixed(1)} s, ${c.frames} frames (dup ${c.dup}, drop ${c.drop})${behind}`);
  }
}

const hold = sleep;

/** Scrolls `loc` into view the way a person would (smoothly), then lets it settle. */
async function bring(loc: Locator, block: 'center' | 'start' | 'end' | 'nearest' = 'center', settle = 900): Promise<void> {
  await loc.waitFor({ state: 'visible', timeout: 30_000 });
  await loc.evaluate((el, b) => el.scrollIntoView({ behavior: 'smooth', block: b }), block);
  await sleep(settle);
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

/** The photo on a blurred copy of itself, zooming in slowly over 10 s (rendered by ffmpeg from the image, not grabbed). */
function shot01(): void {
  const id = '01-menu-photo';
  if (!wanted(id)) return;
  const file = path.join(OUT, `${id}.mp4`);
  const seconds = 10;
  const frames = seconds * FPS;
  // A 3840x2160 still (blurred cover + the sharp photo, fitted), then zoompan from 1.0 to 1.07 into 1920x1080.
  const filter = [
    `[0:v]split[a][b]`,
    `[a]scale=3840:2160:force_original_aspect_ratio=increase,crop=3840:2160,gblur=sigma=40,eq=brightness=-0.06[bg]`,
    `[b]scale=-2:2000[fg]`,
    `[bg][fg]overlay=(W-w)/2:(H-h)/2,format=yuv420p[still]`,
    `[still]zoompan=z='1+0.07*on/${frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${W}x${H}:fps=${FPS}[v]`,
  ].join(';');
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-loop', '1', '-i', PHOTO, '-filter_complex', filter, '-map', '[v]', '-frames:v', String(frames),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-movflags', '+faststart', file], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('ffmpeg could not render 01');
  results.push({ id, seconds, frames, dup: 0, drop: 0, note: 'rendered from the photo' });
  say(`  ✔ ${id}.mp4  ${seconds} s, ${frames} frames (rendered by ffmpeg from the photo)`);
}

// ---- 02, 03: snap → reading → review → publish (phone) --------------------------------------------------------------

async function sceneSetup(display: Display, app: App): Promise<void> {
  if (!SELLER) throw new Error('03 needs PAYPAL_SANDBOX_SELLER_EMAIL in .env: the new shop must be paid to the sandbox seller');
  const stage = await openStage(display, 'phone', { origin: app.origin, profileDir: path.join(WORK, 'profile-phone'), initScripts: [redactorScript(LOGINS)] });
  try {
    const f = stage.app;
    await goApp(stage, `${app.origin}/`);
    await f.getByRole('button', { name: /Snap your price list/ }).waitFor();
    await fontsReady(f);
    await sleep(800);

    await clip(display, '02-snap-reading', async () => {
      await hold(1500);
      const chooser = stage.page.waitForEvent('filechooser');
      await press(f.getByRole('button', { name: /Snap your price list/ }));
      await (await chooser).setFiles(PHOTO);
      await hold(1800);
      await press(f.getByRole('button', { name: /Read my menu/ }));
      await f.getByRole('heading', { level: 1, name: 'Reading your menu…' }).waitFor({ timeout: 60_000 });
      await f.getByRole('heading', { level: 1, name: 'Check your menu' }).waitFor({ timeout: 180_000 });
      await fontsReady(f);
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
        await bring(card, 'center', 1000);
        await hold(1800); // time to read the question
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
        await hold(900);
      }
      // "Your PayPal email": the sandbox seller's, typed into a field drawn as dots (the login never shows).
      const email = f.getByLabel('Your PayPal email');
      await bring(email, 'center', 1000);
      await email.evaluate((el) => (el as HTMLElement).style.setProperty('-webkit-text-security', 'disc'));
      await email.click();
      await email.pressSequentially(SELLER, { delay: 55 });
      await f.getByText('Saved', { exact: true }).first().waitFor({ timeout: 20_000 });
      await hold(1500);
      const publish = f.getByRole('button', { name: /^Publish \d+ items? to PayPal$/ });
      await bring(publish, 'center', 800);
      await press(publish, 700);
      await f.getByRole('heading', { level: 1, name: 'Your shop is live' }).waitFor({ timeout: 180_000 });
      await fontsReady(f);
      await hold(3500);
      const door = f.getByText(/\/s\/marigold-bakehouse-\d+\/mcp$/).first();
      if (await door.count()) {
        await bring(door, 'center', 1200);
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
    initScripts: [redactorScript(LOGINS), ...(opts.extra ?? [])],
  });
}

async function sceneCard(display: Display, app: App): Promise<void> {
  const stage = await desktopStage(display, app, 'card', { owner: true });
  try {
    const p = stage.page;
    await p.goto(`${app.origin}/shops/${app.demoShopId}`);
    const share = p.getByRole('tab', { name: 'Share' });
    await share.waitFor();
    await fontsReady(p);
    await sleep(800);
    await clip(display, '04-counter-card', async () => {
      await hold(1500);
      await press(share);
      const print = p.getByRole('link', { name: 'Print counter card' });
      await bring(print, 'center', 1200);
      await hold(1200);
      await press(print, 600);
      await p.waitForURL(/\/card$/);
      await p.getByText(/Order ahead with any AI assistant/).first().waitFor();
      await fontsReady(p);
      await p.waitForLoadState('networkidle').catch(() => {});
      await hold(5000);
    });
  } finally {
    await stage.close();
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
  await clip(display, id, async () => {
    const term = openTerminal(display, scriptFile, termEnv);
    try {
      await term.done(timeoutMs);
      await hold(4000);
    } finally {
      await term.close();
    }
  }, { lead: 1200, tail: 0 });
  fs.rmSync(scriptFile, { force: true });
}

async function sceneDiscovery(display: Display, app: App): Promise<void> {
  if (!env('ANTHROPIC_API_KEY')) throw new Error('05 needs ANTHROPIC_API_KEY in .env');
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

/** The demo shop's almond croissant, from the door's own list_products (for the tamper curl's ids). */
async function almondIds(app: App): Promise<{ item: string; option: string }> {
  const res = await fetch(`${app.origin}/s/${DEMO_SLUG}/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'list_products', arguments: { query: 'almond' } } }),
  });
  const text = await res.text();
  const json = text.trim().startsWith('{') ? JSON.parse(text) : JSON.parse(text.split('\n').find((l) => l.startsWith('data:'))!.slice(5));
  const data = json.result.structuredContent as { sections: { items: { id?: string; item_id?: string; name: string; options: { id?: string; option_id?: string }[] }[] }[] };
  const item = data.sections.flatMap((s) => s.items).find((i) => /almond croissant/i.test(i.name));
  if (!item) throw new Error('no almond croissant on the demo shop');
  return { item: (item.item_id ?? item.id)!, option: (item.options[0].option_id ?? item.options[0].id)! };
}

async function sceneTamper(display: Display, app: App): Promise<void> {
  const ids = await almondIds(app);
  const body = JSON.stringify({
    jsonrpc: '2.0', id: 1, method: 'tools/call',
    params: { name: 'create_order', arguments: { items: [{ item_id: ids.item, option_id: ids.option, quantity: 2, price: 0.01 }], fulfillment: 'pickup', buyer_name: 'Sam' } },
  });
  const curl = `curl -s -X POST ${app.origin}/s/${DEMO_SLUG}/mcp \\\n  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \\\n  -d '${body}' \\\n  | jq '.result.structuredContent'`;
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
  // The turn is over when the console offers "Start over" again and nothing is streaming.
  await region.getByRole('button', { name: 'Start over' }).waitFor({ state: 'visible', timeout: 180_000 });
  await sleep(400);
}

async function sceneConsole(display: Display, app: App): Promise<void> {
  if (!BUYER.email || !BUYER.password) throw new Error('06 needs PAYPAL_SANDBOX_BUYER_EMAIL and PAYPAL_SANDBOX_BUYER_PASSWORD in .env');
  cancelUnpaid(app, LOGINS);
  const stage = await desktopStage(display, app, 'console');
  try {
    const p = stage.page;
    await p.goto(`${app.origin}/s/${DEMO_SLUG}`);
    await p.getByRole('heading', { level: 1, name: 'Marigold Bakehouse' }).waitFor();
    await fontsReady(p);
    await sleep(800);
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
      for (const reply of ['yes', 'Yes, please place it.', 'Yes, place the order.']) {
        if (await approve.count()) break;
        await sayToConsole(reply, 90);
        await hold(1500);
      }
      await approve.waitFor({ timeout: 10_000 });
      await bring(approve, 'center', 800);
      await hold(2500);
      await press(approve, 700);
      await p.waitForURL(/sandbox\.paypal\.com/, { timeout: 60_000 });
      await p.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
      await hold(4000); // PayPal's page: the shop, the amount
    });

    // Not recorded: the PayPal login (the sandbox buyer's email and password).
    const emailField = p.locator('#email');
    if (!(await emailField.isVisible().catch(() => false))) {
      const login = p.locator('a:visible, button:visible', { hasText: /^Log In$/ }).first();
      if (await login.count()) await login.click();
    }
    await emailField.waitFor({ state: 'visible', timeout: 60_000 });
    await emailField.fill(BUYER.email);
    const next = p.locator('#btnNext');
    if (await next.isVisible().catch(() => false)) await next.click();
    await p.locator('#password').waitFor({ state: 'visible', timeout: 60_000 });
    await p.locator('#password').fill(BUYER.password);
    await p.locator('#btnLogin').click();
    const pay = p.locator('button:visible', { hasText: /^(Complete Purchase|Pay Now|Continue to Review Order|Agree & Pay|Pay \$[\d.,]+)$/ }).first();
    await pay.waitFor({ state: 'visible', timeout: 90_000 });
    await p.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
    await sleep(1500);

    let orderRef = '';
    await clip(display, '06b-paypal-complete', async () => {
      await hold(2500); // PayPal's review: Marigold Bakehouse, the items, the total
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
      await hold(3500);
      await bring(paidTo, 'center', 1200);
      await hold(3000);
      await press(p.getByRole('link', { name: 'Back to the assistant' }), 700);
      await p.waitForURL(/assistant=1/);
      const paid = region.getByRole('link', { name: /Paid · View receipt/ });
      await paid.waitFor({ timeout: 30_000 });
      await hold(800);
      await bring(paid, 'center', 1200);
      await hold(3500);
    });

    // For 08 and 09: the order, and the console's conversation (sessionStorage) so 09 can ask about it later.
    const key = `shelfie:console:${DEMO_SLUG}`;
    const value = await p.evaluate((k) => sessionStorage.getItem(k), key);
    const number = (await region.getByText(/^Order SHF-/).last().innerText().catch(() => '')).replace(/^Order /, '');
    const total = (await p.getByText(/^\$\d+\.\d{2}$/).last().innerText().catch(() => '')).trim();
    writeState({ order: { ref: orderRef, number, total }, console: value ? { key, value } : undefined });
    say(`  order ${number} (${orderRef}) paid`);
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

async function sceneDashboard(display: Display, app: App): Promise<void> {
  const stage = await desktopStage(display, app, 'dashboard', { owner: true });
  try {
    const p = stage.page;
    const order = await paidOrder(app, stage, true);
    say(`  ${order.number}: PayPal order ${order.paypalOrderId}, transaction ${order.captureId ?? '—'}`);
    await p.goto(`${app.origin}/shops/${app.demoShopId}`);
    await p.getByRole('tab', { name: 'Orders' }).waitFor();
    await fontsReady(p);
    await sleep(800);
    await clip(display, '08-dashboard-brief', async () => {
      await hold(2500);
      const link = p.getByRole('link', { name: order.number, exact: true }).first();
      await bring(link, 'start', 1200);
      await p.evaluate(() => window.scrollBy({ top: -120, behavior: 'smooth' }));
      await hold(5000); // the To prepare group, the slip and its AI brief
      await press(link, 700);
      await p.waitForURL(/\/orders\//);
      await p.getByText('Paid to', { exact: true }).waitFor();
      await fontsReady(p);
      await hold(3500);
      await bring(p.getByText('Paid to', { exact: true }), 'center', 1200);
      await hold(3500); // Paid to, the PayPal order and transaction ids
      const timeline = p.getByRole('heading', { name: /Timeline/i }).first();
      if (await timeline.count()) {
        await bring(timeline, 'start', 1200);
        await hold(3500);
      }
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
    await p.getByRole('tab', { name: 'Orders' }).waitFor();
    await fontsReady(p);
    await sleep(800);
    await clip(display, '09-tracking', async () => {
      await hold(1500);
      const card = p.locator('article, li').filter({ has: p.getByRole('link', { name: order.number, exact: true }) }).last();
      const add = card.getByRole('link', { name: /Add tracking/ });
      await bring(add, 'center', 1000);
      await hold(1200);
      await press(add, 600);
      const form = p.getByRole('form', { name: 'Add tracking' });
      await form.waitFor();
      await bring(form, 'center', 1000);
      await hold(1000);
      await form.getByLabel('Carrier').selectOption('USPS');
      await hold(700);
      await form.getByLabel('Tracking number').click();
      await form.getByLabel('Tracking number').pressSequentially(tracking, { delay: 45 });
      await hold(600);
      await press(form.getByRole('button', { name: /Save tracking|Send tracking to PayPal/ }));
      const saved = p.getByRole('status').filter({ hasText: /Saved|Sent to PayPal/ }).first();
      await saved.waitFor({ timeout: 60_000 });
      await bring(saved, 'center', 800);
      await hold(4000);

      // The buyer's console: "Where's my order?"
      await p.goto(`${app.origin}/s/${DEMO_SLUG}?assistant=1`);
      const region = p.getByRole('complementary', { name: 'Order with an assistant' });
      const input = region.getByRole('textbox', { name: 'Message to the assistant' });
      await input.waitFor();
      await fontsReady(p);
      await hold(2000);
      await input.click();
      await input.pressSequentially("Where's my order?", { delay: 60 });
      await hold(500);
      await press(region.getByRole('button', { name: 'Send' }), 300);
      await waitTurn(region);
      const answer = region.getByText(tracking).last();
      await answer.waitFor({ timeout: 10_000 }).catch(() => say('  note: the answer did not quote the tracking number'));
      if (await answer.count()) await bring(answer, 'center', 1000);
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

const SCENES: { ids: string[]; run: (d: Display, a: App) => Promise<void> }[] = [
  { ids: ['02-snap-reading', '03-review-publish'], run: sceneSetup },
  { ids: ['04-counter-card'], run: sceneCard },
  { ids: ['05-claude-code-discovery'], run: sceneDiscovery },
  { ids: ['06-console-order', '06b-paypal-complete'], run: sceneConsole },
  { ids: ['07-price-tamper'], run: sceneTamper },
  { ids: ['08-dashboard-brief'], run: sceneDashboard },
  { ids: ['09-tracking'], run: sceneTracking },
  { ids: ['10-architecture'], run: sceneArchitecture },
];

async function main(): Promise<void> {
  fs.mkdirSync(OUT, { recursive: true });
  // 06 and 06b are one take (the PayPal login sits between them).
  if (ONLY && ONLY.some((o) => '06b-paypal-complete'.startsWith(o) || '06-console-order'.startsWith(o))) ONLY.push('06-console-order', '06b-paypal-complete');
  shot01();
  const scenes = SCENES.filter((s) => s.ids.some(wanted));
  if (!scenes.length) return;
  const display = await startDisplay(DISPLAY);
  let app: App | null = null;
  const failures: string[] = [];
  try {
    app = await startApp({ baseUrl: BASE_URL, port: PORT, build: BUILD, logins: LOGINS });
    for (const scene of scenes) {
      say(`Recording ${scene.ids.filter(wanted).join(', ')}…`);
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
