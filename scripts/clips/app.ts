// The app the clips record: a production server on a private port with its own database (data/clips/), the seeded demo
// shop, and the demo shop's owner cookie. Nothing here prints a secret: the seed's owner link is read and never shown.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { request } from '@playwright/test';
import { sleep } from './stage';

export const WORK = path.resolve('data/clips');
/** Saved between runs (gitignored with data/): the owner cookie, the demo shop's id, the last paid console order. */
const STATE_FILE = path.join(WORK, 'state.json');
const OWNER_FILE = path.join(WORK, 'owner-state.json');

export interface ClipState {
  origin?: string;
  demoShopId?: string;
  /** The order the console placed and paid in 06 (its ref, number), and the console's saved conversation. */
  order?: { ref: string; number: string; total: string };
  console?: { key: string; value: string };
  /** The shop the setup clips (02, 03) made. */
  setupShopId?: string;
}

export function readState(): ClipState {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) as ClipState;
  } catch {
    return {};
  }
}

export function writeState(patch: Partial<ClipState>): ClipState {
  const next = { ...readState(), ...patch };
  fs.mkdirSync(WORK, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(next, null, 2));
  return next;
}

export interface App {
  origin: string;
  /** Env for `npm run seed` against this app's database. */
  seedEnv: NodeJS.ProcessEnv;
  ownerStateFile: string;
  demoShopId: string;
  stop(): Promise<void>;
}

const portBusy = (port: number) =>
  (spawnSync('bash', ['-c', `ss -ltn 2>/dev/null | grep -q ':${port} '`]).status ?? 1) === 0;

async function waitHealthy(origin: string, ms: number, proc?: ChildProcess): Promise<void> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (proc && proc.exitCode !== null) throw new Error(`the app exited (${proc.exitCode}); see ${path.join(WORK, 'server.log')}`);
    try {
      if ((await fetch(`${origin}/api/health`)).ok) return;
    } catch {
      // not up yet
    }
    await sleep(500);
  }
  throw new Error(`no answer from ${origin}/api/health after ${ms / 1000} s`);
}

/** Runs the seed (scripts/seed-demo.ts) against the app's database; returns its stdout. Prints only safe lines. */
function seed(env: NodeJS.ProcessEnv, args: string[], logins: string[]): string {
  const r = spawnSync(path.resolve('node_modules/.bin/tsx'), ['scripts/seed-demo.ts', ...args], { env, encoding: 'utf8', timeout: 600_000 });
  const out = `${r.stdout ?? ''}\n${r.stderr ?? ''}`;
  for (const line of out.split('\n')) {
    const safe = !/\/claim\//.test(line) && !logins.some((l) => line.toLowerCase().includes(l.toLowerCase()));
    if (line.trim() && safe && !/^\s+PayPal product /.test(line)) console.log(`  seed: ${line}`);
  }
  if (r.status !== 0) throw new Error(`npm run seed ${args.join(' ')} failed (exit ${r.status})`);
  return out;
}

/** Logs in through the owner link (a fresh browser-like request context), saves its cookies; returns the shop id. */
async function claim(origin: string, ownerLink: string): Promise<string> {
  const ctx = await request.newContext();
  const res = await ctx.get(new URL(new URL(ownerLink).pathname, origin).toString(), { maxRedirects: 0 });
  const location = res.headers()['location'] ?? '';
  const shopId = location.match(/\/shops\/(shp_[a-z0-9]+)/)?.[1];
  if (res.status() !== 303 || !shopId) throw new Error(`the owner link did not log in (HTTP ${res.status()})`);
  await ctx.storageState({ path: OWNER_FILE });
  await ctx.dispose();
  return shopId;
}

async function ownerWorks(origin: string, shopId: string): Promise<boolean> {
  if (!fs.existsSync(OWNER_FILE)) return false;
  const ctx = await request.newContext({ storageState: OWNER_FILE });
  const ok = (await ctx.get(`${origin}/api/shops/${shopId}/orders`)).ok();
  await ctx.dispose();
  return ok;
}

/**
 * Starts (or attaches to) the app, seeds the demo shop and logs in as its owner. Own server: port 3251, DATABASE_PATH
 * data/clips/clips.db, built first if `.next` has no build (or `build` is set). With `baseUrl`, the caller's server: the
 * seed then uses the caller's DATABASE_PATH, and the owner link comes from CLIPS_OWNER_LINK or the last run's cookie.
 */
export async function startApp(opts: { baseUrl?: string; port: number; build: boolean; logins: string[] }): Promise<App> {
  fs.mkdirSync(WORK, { recursive: true });
  let origin: string;
  let server: ChildProcess | null = null;
  let seedEnv: NodeJS.ProcessEnv;
  if (opts.baseUrl) {
    origin = new URL(opts.baseUrl).origin;
    await waitHealthy(origin, 10_000);
    seedEnv = { ...process.env, APP_URL: origin };
  } else {
    origin = `http://localhost:${opts.port}`;
    if (portBusy(opts.port)) throw new Error(`port ${opts.port} is busy; stop that server or pass --base-url`);
    const appEnv = {
      DATABASE_PATH: path.join('data/clips', 'clips.db'),
      UPLOADS_DIR: path.join('data/clips', 'uploads'),
      APP_URL: origin,
    };
    seedEnv = { ...process.env, ...appEnv };
    if (opts.build || !fs.existsSync('.next/BUILD_ID')) {
      console.log('Building the app (npm run build)…');
      const b = spawnSync('npm', ['run', 'build'], { env: { ...process.env, DATABASE_PATH: 'data/clips/build.db' }, stdio: ['ignore', 'ignore', 'inherit'] });
      if (b.status !== 0) throw new Error('npm run build failed');
    }
    const log = fs.openSync(path.join(WORK, 'server.log'), 'w');
    server = spawn(path.resolve('node_modules/.bin/next'), ['start', '--port', String(opts.port)], {
      env: { ...process.env, ...appEnv, PORT: String(opts.port) },
      stdio: ['ignore', log, log],
    });
    await waitHealthy(origin, 60_000, server);
    console.log(`App running at ${origin} (log: data/clips/server.log)`);
  }

  const stop = async () => {
    if (!server || server.exitCode !== null) return;
    server.kill('SIGTERM');
    for (let i = 0; i < 20 && server.exitCode === null; i++) await sleep(250);
    if (server.exitCode === null) server.kill('SIGKILL');
  };

  try {
    // Seed (idempotent); the owner link is printed only when the shop is created.
    const link = (out: string) => out.match(/https?:\/\/\S+\/claim\/[A-Za-z0-9_-]+/)?.[0] ?? null;
    let ownerLink = link(seed(seedEnv, [], opts.logins)) ?? (opts.baseUrl ? process.env.CLIPS_OWNER_LINK ?? null : null);
    const state = readState();
    let demoShopId: string | null = null;
    if (ownerLink) demoShopId = await claim(origin, ownerLink);
    else if (state.origin === origin && state.demoShopId && (await ownerWorks(origin, state.demoShopId))) demoShopId = state.demoShopId;
    else if (!opts.baseUrl) {
      // The shop exists but this run has no way in: recreate it, which prints a new owner link.
      console.log('No owner cookie for the demo shop: re-seeding it (npm run seed -- --reset)…');
      ownerLink = link(seed(seedEnv, ['--reset'], opts.logins));
      if (!ownerLink) throw new Error('the seed printed no owner link');
      demoShopId = await claim(origin, ownerLink);
    } else {
      throw new Error('cannot log in to the demo shop: set CLIPS_OWNER_LINK to its owner link (it is never printed)');
    }
    if (state.origin !== origin || state.demoShopId !== demoShopId) writeState({ origin, demoShopId, order: undefined, console: undefined });
    return { origin, seedEnv, ownerStateFile: OWNER_FILE, demoShopId, stop };
  } catch (e) {
    await stop();
    throw e;
  }
}

/** `npm run seed -- --cancel-unpaid`: one caller can hold 3 unpaid orders, so clear rehearsal orders before ordering. */
export function cancelUnpaid(app: App, logins: string[]): void {
  seed(app.seedEnv, ['--cancel-unpaid'], logins);
}
