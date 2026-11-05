// Measures the real seller path, photo to live shop, against a running app (never prints env values):
//   POST /api/shops (multipart photo) -> POST /extract (real Claude) -> resolve flagged items via
//   PATCH /items -> POST /publish (real PayPal sandbox catalog) -> shop live.
// Usage (app and script must share DATABASE_PATH; the script reads item ids from that SQLite file):
//   DATABASE_PATH=data/measure/m.db UPLOADS_DIR=data/measure/up npx next dev --port 3109
//   DATABASE_PATH=data/measure/m.db BASE_URL=http://localhost:3109 npx tsx scripts/measure-photo-to-live.ts [runs=2]
// Human review time is not included: flagged items are resolved instantly by rule.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const BASE = process.env.BASE_URL ?? 'http://localhost:3109';
const DB_PATH = process.env.DATABASE_PATH ?? 'data/shelfie.db';
const RUNS = Number(process.argv[2] ?? 2);
const SAMPLES = ['marigold-bakehouse.jpg', 'tia-lupe-chalkboard.jpg', 'ravi-bike-repair.jpg'];
const FILL_PRICE_CENTS = 500;

interface Row { id: string; name: string; issues_json: string }
interface Var { item_id: string; label: string | null; price_cents: number | null }
interface Result {
  sample: string; run: number; readMs: number; items: number; flagged: number; removed: number;
  publishMs: number; published: number; failed: number; totalMs: number; status: string;
}
interface Done { published: number; failed: unknown[]; shop: { status: string } }

async function call(p: string, init: RequestInit, cookie?: string): Promise<Response> {
  const headers = new Headers(init.headers);
  if (cookie) headers.set('cookie', cookie);
  return fetch(`${BASE}${p}`, { ...init, headers });
}

async function measure(sample: string, run: number): Promise<Result> {
  const t0 = performance.now();
  const bytes = readFileSync(path.join('public/samples', sample));
  const form = new FormData();
  form.append('photos', new File([bytes], sample, { type: 'image/jpeg' }));
  const created = await call('/api/shops', { method: 'POST', body: form });
  if (created.status !== 201) throw new Error(`create shop: ${created.status}`);
  const { shopId } = (await created.json()) as { shopId: string };
  const cookie = created.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');

  const r0 = performance.now();
  const ex = await call(`/api/shops/${shopId}/extract`, { method: 'POST' }, cookie);
  const exBody = (await ex.json()) as { catalog?: unknown };
  if (!ex.ok || !exBody.catalog) throw new Error(`reading: ${ex.status} ${JSON.stringify(exBody).slice(0, 200)}`);
  const readMs = performance.now() - r0;

  const db = new Database(DB_PATH, { readonly: true });
  const rows = db.prepare('select id, name, issues_json from items where shop_id = ? order by sort').all(shopId) as Row[];
  const vars = db
    .prepare('select item_id, label, price_cents from variants where item_id in (select id from items where shop_id = ?) order by sort')
    .all(shopId) as Var[];
  db.close();

  // Resolve like a seller: price what is missing, keep the first of any duplicate, remove repeats,
  // confirm anything flagged CHECK.
  const seen = new Set<string>();
  const updates: Record<string, unknown>[] = [];
  let flagged = 0;
  let removed = 0;
  for (const row of rows) {
    const issues = JSON.parse(row.issues_json || '[]') as string[];
    const key = row.name.toLowerCase();
    if (issues.length === 0) { seen.add(key); continue; }
    flagged++;
    if (issues.includes('DUPLICATE') && seen.has(key)) {
      updates.push({ itemId: row.id, status: 'removed' });
      removed++;
      continue;
    }
    seen.add(key);
    const u: Record<string, unknown> = { itemId: row.id, resolveIssues: true };
    const mine = vars.filter((v) => v.item_id === row.id);
    if (mine.length === 0 || mine.some((v) => v.price_cents == null)) {
      const base = mine.length ? mine : [{ item_id: row.id, label: null, price_cents: null }];
      u.variants = base.map((v) => ({ label: v.label, priceCents: v.price_cents ?? FILL_PRICE_CENTS }));
    }
    updates.push(u);
  }
  if (updates.length) {
    const res = await call(
      `/api/shops/${shopId}/items`,
      { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ updates }) },
      cookie,
    );
    if (!res.ok) throw new Error(`resolve: ${res.status} ${(await res.text()).slice(0, 200)}`);
  }

  const p0 = performance.now();
  const pub = await call(`/api/shops/${shopId}/publish`, { method: 'POST' }, cookie);
  if (!pub.ok) throw new Error(`publish: ${pub.status}`);
  let done: Done | null = null;
  for (const line of (await pub.text()).split('\n').filter(Boolean)) {
    const ev = JSON.parse(line) as { type: string };
    if (ev.type === 'done') done = ev as unknown as Done;
  }
  const publishMs = performance.now() - p0;
  if (!done) throw new Error('publish: no done event');
  return {
    sample, run, readMs, items: rows.length, flagged, removed, publishMs,
    published: done.published, failed: done.failed.length, totalMs: performance.now() - t0, status: done.shop.status,
  };
}

async function main(): Promise<void> {
  const out: Result[] = [];
  for (const sample of SAMPLES) {
    for (let run = 1; run <= RUNS; run++) {
      const r = await measure(sample, run);
      out.push(r);
      console.log(JSON.stringify({ ...r, readMs: Math.round(r.readMs), publishMs: Math.round(r.publishMs), totalMs: Math.round(r.totalMs) }));
    }
  }
  const s = (ms: number) => `${(ms / 1000).toFixed(1)} s`;
  console.log('\n| Photo | Run | Items read | Flagged | Reading | Published | Publish | Total | Status |\n|---|---|---|---|---|---|---|---|---|');
  for (const r of out) {
    console.log(`| ${r.sample} | ${r.run} | ${r.items} | ${r.flagged} | ${s(r.readMs)} | ${r.published}${r.failed ? ` (${r.failed} failed)` : ''} | ${s(r.publishMs)} | ${s(r.totalMs)} | ${r.status} |`);
  }
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
