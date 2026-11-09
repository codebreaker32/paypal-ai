import fs from 'node:fs';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

export const PHONE = { width: 390, height: 844 };
export const DESKTOP = { width: 1440, height: 900 };

const SAMPLES = path.resolve(__dirname, '..', 'public', 'samples');

/** A new account for this page's browser: /shops/new, where the photo input and the samples live, needs one. */
export async function signUpForShops(page: Page, tag = 'start') {
  const email = `e2e-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  const res = await page.request.post('/api/auth/signup', { data: { email, password: 'a long sentence only this test says' } });
  if (res.status() !== 201) throw new Error(`sign-up failed with ${res.status()}`);
}

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
  // Loaded is not painted: a full-page capture can show an off-screen photo as blank until it is decoded.
  await page.evaluate(() =>
    Promise.race([
      Promise.all(Array.from(document.images).map((img) => img.decode().catch(() => undefined))),
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

/** The seller shell's four section links (the sidebar at desktop, the tab bar on phones: only one is visible). */
export const appNav = (page: Page) => page.getByRole('navigation', { name: 'Shop sections' });

/** axe (WCAG 2.1 A and AA) has nothing to report, and the page has no sideways scroll. */
export async function a11y(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`)).toEqual([]);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

/** Standalone controls under 44 px tall in `scope`. A link inside a sentence is exempt; a stretched link's target is its row. */
export async function smallTargets(page: Page, scope = 'main') {
  return page.evaluate(
    (sel) =>
      Array.from(document.querySelectorAll<HTMLElement>(`${sel} a, ${sel} button, ${sel} summary, ${sel} [role="tab"]`))
        .filter((el) => el.offsetParent !== null && !el.closest('p, dd, li > span'))
        .map((el) => {
          const target = el.hasAttribute('data-stretched-link') ? (el.closest('li') ?? el) : el;
          return { text: el.innerText.trim().slice(0, 40) || el.getAttribute('aria-label') || el.tagName, h: Math.round(target.getBoundingClientRect().height) };
        })
        .filter((c) => c.h < 44),
    scope,
  );
}
