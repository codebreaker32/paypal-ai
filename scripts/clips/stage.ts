// Screen-clip stage for the demo video (video/clips/README.md).
//
// A virtual X display (Xvfb) at 1920x1080, a real headed Chromium driven by Playwright, and ffmpeg's x11grab
// recording the whole display at a constant 30 fps into H.264 MP4. Phone shots put a 390x844 browser window in
// the middle of a full-screen backdrop window, so every clip is 1920x1080 and edits together.
//
// Needs: Xvfb, ffmpeg (with libx264), xterm for terminal shots (`sudo apt-get install -y xvfb ffmpeg xterm`).
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium, type BrowserContext, type Frame, type Page } from '@playwright/test';

export const W = 1920;
export const H = 1080;
export const FPS = 30;
export const PHONE = { width: 390, height: 844 };
/** The terminal clips' xterm: 16x32 px cells at 19 pt on Xvfb, so 115x31 cells and 40 px of padding fill 1920x1080. */
export const TERMINAL = { fontSize: 19, padding: 40, cols: 115, rows: 31 };
/** The backdrop behind phone shots: the app's grey (--grey-100, docs/DESIGN.md), a shade darker than the white page. */
const BACKDROP = '#eceef1';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface Display {
  name: string;
  stop(): Promise<void>;
}

/** Starts Xvfb on `name` (e.g. ":97") at 1920x1080x24 and waits until it accepts clients. */
export async function startDisplay(name = ':97'): Promise<Display> {
  const lock = `/tmp/.X${name.slice(1)}-lock`;
  if (fs.existsSync(lock)) throw new Error(`display ${name} is in use (${lock}); pick another with --display`);
  // -wr: a white root window, so the few pixels a terminal's character grid leaves at the edges match its paper.
  const proc = spawn('Xvfb', [name, '-screen', '0', `${W}x${H}x24`, '-nolisten', 'tcp', '-ac', '-wr'], { stdio: 'ignore' });
  for (let i = 0; i < 50 && !fs.existsSync(lock); i++) await sleep(100);
  if (!fs.existsSync(lock)) throw new Error('Xvfb did not start');
  await sleep(300);
  return {
    name,
    async stop() {
      proc.kill('SIGTERM');
      await sleep(300);
    },
  };
}

export interface Capture {
  file: string;
  /** Stops recording; resolves with ffmpeg's frame counters (duplicated frames mean x11grab fell behind). */
  stop(): Promise<{ frames: number; dup: number; drop: number }>;
}

/**
 * Records the whole display to `file` (MP4, H.264, yuv420p, constant 30 fps) until stop(). The live capture encodes with
 * x264's fastest preset (so a busy machine doesn't make x11grab repeat frames) into a temporary MKV; stop() then
 * re-encodes it at leisure into the final MP4.
 */
export function startCapture(display: Display, file: string): Capture {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const raw = `${file}.raw.mkv`;
  const progress = `${file}.progress`;
  fs.rmSync(progress, { force: true });
  const ff: ChildProcess = spawn(
    'ffmpeg',
    ['-y', '-loglevel', 'error', '-progress', progress, '-thread_queue_size', '512', '-f', 'x11grab', '-draw_mouse', '0', '-framerate', String(FPS),
      '-video_size', `${W}x${H}`, '-i', `${display.name}.0`, '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '12', '-pix_fmt', 'yuv420p',
      '-r', String(FPS), raw],
    { stdio: ['pipe', 'ignore', 'inherit'] },
  );
  return {
    file,
    async stop() {
      const done = new Promise<void>((r) => ff.once('exit', () => r()));
      ff.stdin?.write('q');
      ff.stdin?.end();
      await Promise.race([done, sleep(10_000).then(() => ff.kill('SIGKILL'))]);
      const text = fs.existsSync(progress) ? fs.readFileSync(progress, 'utf8') : '';
      fs.rmSync(progress, { force: true });
      const last = (key: string) => Number([...text.matchAll(new RegExp(`^${key}=(\\d+)$`, 'gm'))].at(-1)?.[1] ?? 0);
      await new Promise<void>((resolve, reject) => {
        const enc = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
          '-r', String(FPS), '-movflags', '+faststart', file], { stdio: ['ignore', 'ignore', 'inherit'] });
        enc.once('exit', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg could not encode ${path.basename(file)}`))));
      });
      fs.rmSync(raw, { force: true });
      return { frames: last('frame'), dup: last('dup_frames'), drop: last('drop_frames') };
    },
  };
}

/**
 * Chromium started through `nice -n 10`: rendering heavy pages in software (PayPal's blurred "Thanks for using PayPal")
 * can starve ffmpeg, and x11grab then repeats frames. A lower-priority browser keeps the capture at a steady 30 fps.
 */
function niceChromium(): string {
  const wrapper = path.join(os.tmpdir(), 'shelfie-clips-bin', 'chromium-nice');
  fs.mkdirSync(path.dirname(wrapper), { recursive: true });
  fs.writeFileSync(wrapper, `#!/bin/sh\nexec nice -n 10 "${chromium.executablePath()}" "$@"\n`, { mode: 0o755 });
  return wrapper;
}

export interface Stage {
  context: BrowserContext;
  page: Page;
  /** Where the app runs for phone shots: an iframe on the app's own origin (so its cookies are first-party). */
  app: Page | Frame;
  close(): Promise<void>;
}

/**
 * Opens a headed Chromium filling the display in kiosk mode (a persistent context, so the first window honours
 * --kiosk and shows no browser chrome). `phone`: the page is a stage on the app's own origin, served by Playwright
 * (no app route), holding a 390x844 iframe scaled to fill the frame's height; drive the app through `stage.app`.
 * `deviceScaleFactor`: 4/3 lays a desktop page out at 1440x810 CSS px and fills the 1920x1080 display with it.
 */
export async function openStage(
  display: Display,
  kind: 'desktop' | 'phone',
  opts: {
    origin: string;
    profileDir: string;
    storageState?: string;
    deviceScaleFactor?: number;
    /** Scripts run in every page and frame before the page's own (the redactor, saved sessionStorage). */
    initScripts?: string[];
  },
): Promise<Stage> {
  fs.rmSync(opts.profileDir, { recursive: true, force: true });
  // No password manager: after the PayPal login, Chrome's "Save password?" bubble shows the login in full, and the
  // bubble is browser UI, out of the redactor's reach.
  fs.mkdirSync(path.join(opts.profileDir, 'Default'), { recursive: true });
  fs.writeFileSync(
    path.join(opts.profileDir, 'Default', 'Preferences'),
    JSON.stringify({
      credentials_enable_service: false,
      credentials_enable_autosignin: false,
      profile: { password_manager_enabled: false, password_manager_leak_detection: false },
      autofill: { enabled: false, profile_enabled: false, credit_card_enabled: false },
      translate: { enabled: false },
    }),
  );
  const dsf = opts.deviceScaleFactor ?? 1;
  const context = await chromium.launchPersistentContext(opts.profileDir, {
    headless: false,
    executablePath: niceChromium(),
    env: { ...process.env, DISPLAY: display.name },
    viewport: null,
    locale: 'en-US',
    timezoneId: 'America/Los_Angeles',
    // --window-size is in CSS px (DIPs): at a scale factor of 4/3, 1440x810 fills the 1920x1080 display exactly.
    args: ['--kiosk', '--window-position=0,0', `--window-size=${Math.round(W / dsf)},${Math.round(H / dsf)}`, '--no-first-run',
      '--no-default-browser-check', '--disable-infobars', '--hide-crash-restore-bubble', '--disable-features=PasswordManagerOnboarding,AutofillServerCommunication,Translate',
      '--password-store=basic', `--force-device-scale-factor=${dsf}`, '--hide-scrollbars'],
  });
  for (const content of opts.initScripts ?? []) await context.addInitScript({ content });
  if (opts.storageState) {
    const state = JSON.parse(fs.readFileSync(opts.storageState, 'utf8')) as { cookies: Parameters<BrowserContext['addCookies']>[0] };
    await context.addCookies(state.cookies);
  }
  const page = context.pages()[0] ?? (await context.newPage());
  let app: Page | Frame = page;
  if (kind === 'phone') {
    const stageUrl = `${opts.origin}/__clip_stage`;
    const scale = ((H - 40) / PHONE.height).toFixed(4);
    await page.route(stageUrl, (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html><body style="margin:0;background:${BACKDROP};width:100vw;height:100vh;overflow:hidden;display:grid;place-items:center">
<iframe id="phone" src="about:blank" style="width:${PHONE.width}px;height:${PHONE.height}px;border:0;border-radius:28px;background:#fff;transform:scale(${scale});box-shadow:0 18px 50px rgba(17,18,20,.16)"></iframe></body></html>`,
      }),
    );
    await page.goto(stageUrl);
    app = page.frame({ url: 'about:blank' })!;
  }
  return {
    context,
    page,
    app,
    async close() {
      await context.close();
    },
  };
}

/** Navigates the stage's app (the page itself, or the phone iframe) and waits for it to load. */
export async function goApp(stage: Stage, url: string): Promise<void> {
  if ('goto' in stage.app && stage.app === stage.page) {
    await stage.page.goto(url);
    return;
  }
  const frame = stage.app as Frame;
  await frame.goto(url);
}

/** Types like a person, one character at a time, into `selector` in the page or the phone frame. */
export async function typeSlowly(where: Page | Frame, selector: string, text: string, delayMs = 45) {
  await where.locator(selector).pressSequentially(text, { delay: delayMs });
}

export interface Terminal {
  /** Resolves when terminal.mjs has typed and run every step. */
  done(timeoutMs: number): Promise<void>;
  close(): Promise<void>;
}

/** The xterm's look: the app's white page and ink, ANSI colours from its status hues (src/app/globals.css). */
const XTERM_LOOK = [
  '-fa', 'DejaVu Sans Mono', '-fs', String(TERMINAL.fontSize), '-b', String(TERMINAL.padding), '-bw', '0', '+sb',
  '-bg', '#ffffff', '-fg', '#111214', '-cr', '#111214',
  '-xrm', 'XTerm*color1: #b42318', '-xrm', 'XTerm*color2: #1e7a45', '-xrm', 'XTerm*color3: #9a4a00',
  '-xrm', 'XTerm*color4: #2457a6', '-xrm', 'XTerm*color8: #5e636c', '-xrm', 'XTerm*color10: #1e7a45', '-xrm', 'XTerm*boldColors: false',
  '-xrm', 'XTerm*cursorBlink: false',
];

/**
 * Opens a full-screen xterm running scripts/clips/terminal.mjs on `scriptFile`. `env` is the xterm's whole environment
 * (plus DISPLAY): terminal.mjs passes on only the variables its script keeps.
 */
export function openTerminal(display: Display, scriptFile: string, env: Record<string, string>): Terminal {
  const doneFile = (JSON.parse(fs.readFileSync(scriptFile, 'utf8')) as { doneFile: string }).doneFile;
  fs.rmSync(doneFile, { force: true });
  const proc = spawn(
    'xterm',
    [...XTERM_LOOK, '-geometry', `${TERMINAL.cols}x${TERMINAL.rows}+0+0`, '-T', 'shelfie-clip', '-e', process.execPath,
      path.resolve('scripts/clips/terminal.mjs'), scriptFile],
    { env: { ...env, DISPLAY: display.name } as unknown as NodeJS.ProcessEnv, stdio: 'ignore' },
  );
  return {
    async done(timeoutMs) {
      const end = Date.now() + timeoutMs;
      while (!fs.existsSync(doneFile)) {
        if (Date.now() > end) throw new Error(`the terminal script did not finish within ${timeoutMs / 1000} s`);
        if (proc.exitCode !== null) throw new Error('the terminal closed before its script finished');
        await sleep(250);
      }
    },
    async close() {
      proc.kill('SIGTERM');
      await sleep(300);
    },
  };
}

export { sleep };
