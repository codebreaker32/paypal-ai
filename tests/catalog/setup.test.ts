import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type Database from 'better-sqlite3';
import { createTestDb } from '@/lib/db';
import * as shops from '@/lib/db/repos/shops';
import * as items from '@/lib/db/repos/items';
import * as extractions from '@/lib/db/repos/extractions';
import type { MenuExtraction } from '@/lib/ai/schemas';
import { recordedReading } from '@/lib/ai/samples';
import {
  PLACEHOLDER_NAME,
  READING_STALE_MS,
  createShopFromPhotos,
  createShopFromSample,
  loadSetupView,
  runReading,
  sampleOf,
  setShopPhotos,
  type ReadingDeps,
} from '@/lib/catalog/setup';
import { UploadError } from '@/lib/uploads';

const marigold = recordedReading('marigold-bakehouse');
const notAMenu: MenuExtraction = JSON.parse(
  fs.readFileSync(path.resolve(import.meta.dirname, '../ai/fixtures/not-a-menu.json'), 'utf8'),
);

describe('shop setup', () => {
  let db: Database.Database;
  let dir: string;
  let photo: Buffer;
  let calls: number;
  let t: number;

  const deps = (over: Partial<ReadingDeps> = {}): ReadingDeps => ({
    db,
    hasAiKey: true,
    extract: async () => {
      calls++;
      return marigold;
    },
    now: () => t,
    recordedDelayMs: 0,
    ...over,
  });

  beforeEach(async () => {
    db = createTestDb();
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shelfie-setup-'));
    process.env.UPLOADS_DIR = dir;
    photo = await sharp({ create: { width: 60, height: 80, channels: 3, background: '#ddd' } }).jpeg().toBuffer();
    calls = 0;
    t = Date.now();
  });
  afterEach(() => {
    delete process.env.UPLOADS_DIR;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  describe('creating a shop', () => {
    it('from photos: a draft with a throwaway slug, the placeholder name and the saved pages', async () => {
      const { shop, ownerToken } = await createShopFromPhotos(db, [photo, photo]);
      expect(shops.verifyOwnerToken(db, shop.id, ownerToken)).toBe(true);
      expect(shop.status).toBe('draft');
      expect(shop.slug).toMatch(/^draft-[a-z0-9]{8}$/);
      expect(shop.name).toBe(PLACEHOLDER_NAME);
      expect(shop.menuPhotoPaths).toEqual([`${shop.id}/page-1.jpg`, `${shop.id}/page-2.jpg`]);
      expect(fs.existsSync(path.join(dir, shop.id, 'page-2.jpg'))).toBe(true);
      expect(sampleOf(shop)).toBeNull();
    });

    it('from a sample: the sample name and a copy of its photo that remembers the sample', async () => {
      const { shop } = await createShopFromSample(db, 'marigold-bakehouse');
      expect(shop.name).toBe('Marigold Bakehouse');
      expect(shop.slug).toMatch(/^draft-/);
      expect(shop.menuPhotoPaths).toEqual([`${shop.id}/sample-marigold-bakehouse.jpg`]);
      expect(sampleOf(shop)).toBe('marigold-bakehouse');
    });
  });

  describe('retaking photos', () => {
    it('replaces every page, or adds pages up to four', async () => {
      const { shop } = await createShopFromSample(db, 'marigold-bakehouse');
      const retaken = await setShopPhotos(db, shop, [photo], 'replace');
      expect(retaken.menuPhotoPaths).toHaveLength(1);
      expect(retaken.menuPhotoPaths[0]).toMatch(new RegExp(`^${shop.id}/page-1-[a-z0-9]+\\.jpg$`));
      expect(sampleOf(retaken)).toBeNull();
      const more = await setShopPhotos(db, retaken, [photo, photo], 'add');
      expect(more.menuPhotoPaths).toHaveLength(3);
      expect(more.menuPhotoPaths[0]).toBe(retaken.menuPhotoPaths[0]);
      await expect(setShopPhotos(db, more, [photo, photo], 'add')).rejects.toMatchObject({ code: 'TOO_MANY_PHOTOS' });
      await expect(setShopPhotos(db, more, [Buffer.from('nope')], 'replace')).rejects.toBeInstanceOf(UploadError);
      expect(shops.byId(db, shop.id)!.menuPhotoPaths).toHaveLength(3);
    });

    // The retake screen refreshes after a failed reading (review 2 S5): the page must then show the
    // "try again" step with the pages the server kept, not the old retake screen and its old count.
    it('after an added page whose reading fails, the page shows "try again" with every saved page', async () => {
      const { shop } = await createShopFromPhotos(db, [photo, photo, photo]);
      await runReading(deps({ extract: async () => notAMenu }), shop.id);
      expect(loadSetupView(db, shops.byId(db, shop.id)!, t)).toMatchObject({ step: 'unreadable', photoCount: 3 });
      const added = await setShopPhotos(db, shops.byId(db, shop.id)!, [photo], 'add');
      const r = await runReading(deps({ extract: async () => { throw new Error('overloaded'); } }), added.id);
      expect(r.status).toBe('failed');
      expect(loadSetupView(db, shops.byId(db, shop.id)!, t)).toMatchObject({ step: 'failed', photoCount: 4 });
    });
  });

  describe('reading the menu', () => {
    it('drafts the items, records the run and fills shop details from the photo', async () => {
      const { shop } = await createShopFromPhotos(db, [photo]);
      const out = await runReading(deps(), shop.id);
      expect(out.status).toBe('done');
      expect(calls).toBe(1);
      expect(items.listWithVariants(db, shop.id)).toHaveLength(10);
      const ext = extractions.latest(db, shop.id)!;
      expect(ext.status).toBe('done');
      expect(ext.model).toBe('claude-sonnet-5-5');
      expect(ext.skipped.length).toBeGreaterThan(0);
      const after = shops.byId(db, shop.id)!;
      expect(after.name).toBe('Marigold Bakehouse');
      expect(after.pickupNotes).toContain('14 Alder St');
      expect(after.kind).toBe('food');
    });

    it('never hands a draft\'s throwaway address to the page', async () => {
      const { shop } = await createShopFromPhotos(db, [photo]);
      await runReading(deps(), shop.id);
      const view = loadSetupView(db, shops.byId(db, shop.id)!, t);
      expect(view).toMatchObject({ step: 'review' });
      expect(JSON.stringify(view)).not.toContain(shop.slug);
    });

    it("keeps details the seller already wrote", async () => {
      const { shop } = await createShopFromPhotos(db, [photo]);
      shops.update(db, shop.id, { name: 'Rosa Bakes', pickupNotes: 'Back door, ring twice' });
      await runReading(deps(), shop.id);
      const after = shops.byId(db, shop.id)!;
      expect(after.name).toBe('Rosa Bakes');
      expect(after.pickupNotes).toBe('Back door, ring twice');
    });

    it('records an unreadable photo without drafting items', async () => {
      const { shop } = await createShopFromPhotos(db, [photo]);
      const out = await runReading(deps({ extract: async () => notAMenu }), shop.id);
      expect(out).toMatchObject({ status: 'unreadable', reason: 'not_a_menu' });
      expect(items.listWithVariants(db, shop.id)).toHaveLength(0);
      expect(extractions.latest(db, shop.id)!.status).toBe('done');
      expect(loadSetupView(db, shops.byId(db, shop.id)!, t)).toMatchObject({ step: 'unreadable', reason: 'not_a_menu' });
    });

    it('records a failed run with a friendly message', async () => {
      const { shop } = await createShopFromPhotos(db, [photo]);
      const out = await runReading(deps({ extract: async () => { throw new Error('Request timed out.'); } }), shop.id);
      expect(out.status).toBe('failed');
      expect(extractions.latest(db, shop.id)!.status).toBe('failed');
      const view = loadSetupView(db, shops.byId(db, shop.id)!, t);
      expect(view.step).toBe('failed');
      expect(view.step === 'failed' && view.message).toMatch(/took too long/i);
    });

    it('does not start a second run while one is going', async () => {
      const { shop } = await createShopFromPhotos(db, [photo]);
      let release!: () => void;
      const slow = deps({ extract: () => new Promise((r) => { calls++; release = () => r(marigold); }) });
      const first = runReading(slow, shop.id);
      // Wait until the first run has reached Claude (a fixed 10 ms wait flaked when the whole suite loaded the CPU).
      await vi.waitFor(() => expect(calls).toBe(1));
      expect(await runReading(slow, shop.id)).toEqual({ status: 'running' });
      expect(loadSetupView(db, shops.byId(db, shop.id)!, t)).toMatchObject({ step: 'reading', running: true });
      release();
      expect((await first).status).toBe('done');
      expect(calls).toBe(1);
    });

    it('still counts a three-minute-old run as running: a reading can run for up to READING_DEADLINE_MS (3 min)', async () => {
      expect(READING_STALE_MS).toBe(4 * 60_000);
      const { shop } = await createShopFromPhotos(db, [photo]);
      extractions.start(db, shop.id, 'claude-sonnet-5-5');
      t += 3 * 60_000;
      expect(loadSetupView(db, shops.byId(db, shop.id)!, t)).toMatchObject({ step: 'reading', running: true });
      expect(await runReading(deps(), shop.id)).toEqual({ status: 'running' });
      expect(calls).toBe(0);
    });

    it('treats a run older than four minutes as failed and lets a new one start', async () => {
      const { shop } = await createShopFromPhotos(db, [photo]);
      extractions.start(db, shop.id, 'claude-sonnet-5-5');
      t += READING_STALE_MS + 1000;
      expect(loadSetupView(db, shops.byId(db, shop.id)!, t).step).toBe('failed');
      const out = await runReading(deps(), shop.id);
      expect(out.status).toBe('done');
      expect(calls).toBe(1);
    });

    it('uses the recorded reading for a sample when there is no Anthropic key', async () => {
      const { shop } = await createShopFromSample(db, 'marigold-bakehouse');
      const out = await runReading(deps({ hasAiKey: false }), shop.id);
      expect(out.status).toBe('done');
      expect(calls).toBe(0);
      expect(extractions.latest(db, shop.id)!.model).toBe('recorded:claude-sonnet-5-5');
      const view = loadSetupView(db, shops.byId(db, shop.id)!, t);
      expect(view.step === 'review' && view.recorded).toBe(true);
    });

    it('a reading stored before items had a category (runs 1–2) still opens the review, not the failed step', async () => {
      const { shop } = await createShopFromSample(db, 'marigold-bakehouse');
      await runReading(deps({ hasAiKey: false }), shop.id);
      const ext = extractions.latest(db, shop.id)!;
      const raw = JSON.parse(JSON.stringify(ext.raw)) as { items: Record<string, unknown>[] };
      for (const item of raw.items) delete item.category;
      db.prepare('UPDATE extractions SET raw_json = ? WHERE id = ?').run(JSON.stringify(raw), ext.id);
      expect(JSON.stringify(extractions.latest(db, shop.id)!.raw)).not.toContain('"category"');
      const view = loadSetupView(db, shops.byId(db, shop.id)!, t);
      expect(view.step).toBe('review');
    });

    it('reads a sample live when there is a key', async () => {
      const { shop } = await createShopFromSample(db, 'ravi-bike-repair');
      await runReading(deps(), shop.id);
      expect(calls).toBe(1);
    });

    it('uses the recorded reading for a sample when recorded samples are switched on, even with a key', async () => {
      const { shop } = await createShopFromSample(db, 'marigold-bakehouse');
      const out = await runReading(deps({ recordedSamples: true }), shop.id);
      expect(out.status).toBe('done');
      expect(calls).toBe(0);
      expect(extractions.latest(db, shop.id)!.model).toBe('recorded:claude-sonnet-5-5');
    });

    it('still reads your own photo live when recorded samples are switched on', async () => {
      const { shop } = await createShopFromPhotos(db, [photo]);
      await runReading(deps({ recordedSamples: true }), shop.id);
      expect(calls).toBe(1);
    });

    it('explains that a key is needed for your own photo when there is none', async () => {
      const { shop } = await createShopFromPhotos(db, [photo]);
      const out = await runReading(deps({ hasAiKey: false }), shop.id);
      expect(out.status).toBe('failed');
      expect(out.status === 'failed' && out.message).toMatch(/ANTHROPIC_API_KEY/);
      expect(calls).toBe(0);
    });

    it('does nothing to a shop that is already live', async () => {
      const { shop } = await createShopFromSample(db, 'marigold-bakehouse');
      shops.publish(db, shop.id);
      const out = await runReading(deps(), shop.id);
      expect(out.status).toBe('failed');
      expect(calls).toBe(0);
    });
  });

  describe('the setup view', () => {
    it('asks the page to start reading when nothing has run yet', async () => {
      const { shop } = await createShopFromPhotos(db, [photo]);
      expect(loadSetupView(db, shop, t)).toMatchObject({ step: 'reading', running: false, photoCount: 1 });
    });

    it('gives the review its items, skipped lines and notes', async () => {
      const { shop } = await createShopFromSample(db, 'marigold-bakehouse');
      await runReading(deps(), shop.id);
      const view = loadSetupView(db, shops.byId(db, shop.id)!, t);
      if (view.step !== 'review') throw new Error(`expected review, got ${view.step}`);
      expect(view.items).toHaveLength(10);
      expect(view.items.filter((i) => i.issues.length > 0)).toHaveLength(4);
      expect(view.skipped.map((s) => s.text)).toContain('Breads');
      expect(view.warnings.length).toBeGreaterThan(0);
      expect(view.nonUsd).toBe(false);
      expect(view.recorded).toBe(false);
    });

    it('shows only plain notes, even for a reading stored before they were filtered', async () => {
      const { shop } = await createShopFromSample(db, 'marigold-bakehouse');
      await runReading(deps(), shop.id);
      const old = extractions.latest(db, shop.id)!;
      const warnings = ['Prices were matched by row position; please verify.', 'Glare on the right side of the page.'];
      extractions.finish(db, old.id, {
        raw: { ...marigold, warnings }, imageQuality: 'usable', warnings, skipped: old.skipped, durationMs: 1,
      });
      const view = loadSetupView(db, shops.byId(db, shop.id)!, t);
      if (view.step !== 'review') throw new Error(`expected review, got ${view.step}`);
      expect(view.warnings).toEqual([
        'Glare on the right side of the page.',
        'Check the names and prices against your photo before you publish.',
      ]);
    });

    it('shows plain card text for open issues, even for items stored before the text was plain', async () => {
      const { shop } = await createShopFromSample(db, 'marigold-bakehouse');
      await runReading(deps(), shop.id);
      const stored = items.listWithVariants(db, shop.id);
      const bun = stored.find((i) => i.name === 'Cardamom bun')!;
      const focaccia = stored.find((i) => /focaccia/i.test(i.name))!;
      const old = 'Deal "2 for $7": $3.50 each?. Multi-buy deal; unit price is 350 cents. Matched by row position.';
      items.update(db, bun.id, { issueDetail: old });
      // A card the seller already answered keeps what it said (it isn't shown any more).
      items.update(db, focaccia.id, { issues: [], issueDetail: old });
      const view = loadSetupView(db, shops.byId(db, shop.id)!, t);
      if (view.step !== 'review') throw new Error(`expected review, got ${view.step}`);
      expect(view.items.find((i) => i.id === bun.id)!.issueDetail).toBe('Printed as “2 for $7”. We set $3.50 each. Is that right?');
      expect(view.items.find((i) => i.id === focaccia.id)!.issueDetail).toBe(old);
    });

    it('keeps an open card’s stored text when today’s reading of the item has none', async () => {
      const { shop } = await createShopFromSample(db, 'marigold-bakehouse');
      await runReading(deps(), shop.id);
      // Flagged under an older normaliser; read today, the croissant has no question.
      const croissant = items.listWithVariants(db, shop.id).find((i) => i.issues.length === 0 && i.status === 'draft')!;
      items.update(db, croissant.id, { issues: ['CHECK'], issueDetail: 'Hard to read in the photo. Are the name and price right?' });
      const view = loadSetupView(db, shops.byId(db, shop.id)!, t);
      if (view.step !== 'review') throw new Error(`expected review, got ${view.step}`);
      expect(view.items.find((i) => i.id === croissant.id)).toMatchObject({
        issues: ['CHECK'],
        issueDetail: 'Hard to read in the photo. Are the name and price right?',
      });
    });

    it('shows the live step once the shop is published', async () => {
      const { shop } = await createShopFromSample(db, 'marigold-bakehouse');
      await runReading(deps(), shop.id);
      shops.publish(db, shop.id);
      expect(loadSetupView(db, shops.byId(db, shop.id)!, t).step).toBe('live');
    });
  });
});
