import fs from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';

export const PHONE = { width: 390, height: 844 };
export const DESKTOP = { width: 1440, height: 900 };

const SAMPLES = path.resolve(__dirname, '..', 'public', 'samples');

/** A real JPG from public/samples, as a Playwright file payload. */
export function samplePhoto(file: string, name = file) {
  return { name, mimeType: 'image/jpeg', buffer: fs.readFileSync(path.join(SAMPLES, file)) };
}

/**
 * Puts the page in its settled, final state for screenshots: reduced motion (entrance animations
 * complete at once, even when a full-page capture re-lays the page out), web fonts loaded, and the
 * Next dev indicator hidden.
 */
export async function settle(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
  await page.evaluate(() => document.fonts.ready);
  // networkidle is a hint, not a gate: on a CPU-starved machine the browser can take minutes to report it even when
  // every request finished in under a second (round-6 trace). What a screenshot needs is the load event, the fonts
  // (above) and every image decoded (below).
  await page.waitForLoadState('load');
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  // A loading="lazy" photo below the fold never loads until it is scrolled to, so it would hold this wait forever:
  // make every pending image eager first (a full-page capture shows them all anyway), and cap the wait at 15 s.
  await page.evaluate(() =>
    Promise.race([
      Promise.all(
        Array.from(document.images)
          .filter((img) => !img.complete)
          .map(
            (img) =>
              new Promise((done) => {
                img.addEventListener('load', done, { once: true });
                img.addEventListener('error', done, { once: true });
                img.loading = 'eager';
              }),
          ),
      ),
      new Promise((done) => setTimeout(done, 15_000)),
    ]),
  );
  // Let entrance animations (some delayed) finish; spinners loop forever and are skipped.
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getTiming().iterations !== Infinity)
        .map((a) => a.finished),
    ),
  );
}

/**
 * Answers the page's POSTs to `pathname` inside the page itself: a 200 NDJSON stream that sends `events` and then stays
 * open, so a streaming screen (publish progress, the console thinking) holds its in-progress state for a screenshot.
 * Mocked in the page's fetch rather than with page.route because a held route keeps a request in flight, and
 * screenshots wait for the network to go idle. Nothing reaches the server.
 */
export async function streamThenHold(page: Page, pathname: string, events: unknown[]) {
  await page.addInitScript(
    ({ pathname, body }) => {
      const original = window.fetch.bind(window);
      window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
        const req = input instanceof Request ? input : null;
        const url = new URL(req ? req.url : String(input), window.location.href);
        const method = (init?.method ?? req?.method ?? 'GET').toUpperCase();
        if (url.pathname !== pathname || method !== 'POST') return original(input, init);
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            if (body) controller.enqueue(new TextEncoder().encode(body));
          },
        });
        return Promise.resolve(new Response(stream, { status: 200, headers: { 'content-type': 'application/x-ndjson' } }));
      };
    },
    { pathname, body: events.map((e) => `${JSON.stringify(e)}\n`).join('') },
  );
}

/**
 * Holds the client router's navigation request for `pathname` unanswered inside the page, so the route's loading.tsx
 * stays on screen for a screenshot. In production a <Link> in view prefetches its route up to the loading boundary
 * (those requests carry Next-Router-Prefetch and pass through); clicking it shows that skeleton at once, then fetches
 * the page itself (an RSC request, no prefetch header), which never answers here. In the page's fetch, not page.route,
 * for the reason given at streamThenHold. Nothing reaches the server. Returns how many requests it has held.
 */
export async function holdNavigation(page: Page, pathname: string) {
  await page.addInitScript((pathname) => {
    const w = window as unknown as { __heldNavigations: number };
    w.__heldNavigations = 0;
    const original = window.fetch.bind(window);
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const req = input instanceof Request ? input : null;
      const url = new URL(req ? req.url : String(input), window.location.href);
      const headers = new Headers(init?.headers ?? req?.headers);
      if (url.pathname !== pathname || headers.get('rsc') !== '1' || headers.has('next-router-prefetch')) return original(input, init);
      w.__heldNavigations++;
      return new Promise<Response>(() => {});
    };
  }, pathname);
  return () => page.evaluate(() => (window as unknown as { __heldNavigations: number }).__heldNavigations);
}

/** Holds every POST /api/shops open until release() is called. */
export async function holdShopsApi(page: Page) {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route('**/api/shops', async (route) => {
    await gate;
    await route.fulfill({ status: 503, json: { error: { code: 'UNAVAILABLE' } } });
  });
  return release;
}
