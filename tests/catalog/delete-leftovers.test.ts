// What a delete promises ("photos ... are deleted"): no upload may outlive its row, whichever way the row went.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type Database from 'better-sqlite3';
import { getImageEtag } from 'next/dist/server/image-optimizer/extract-etag';
import { recordedReading } from '@/lib/ai/samples';
import { removeFiles } from '@/lib/catalog/delete-shop';
import { EditError } from '@/lib/catalog/edits';
import { clearItemPhoto, setItemPhoto, setShopImage } from '@/lib/catalog/photos';
import { createShopFromPhotos, runReading, setShopPhotos } from '@/lib/catalog/setup';
import { createTestDb } from '@/lib/db';
import * as items from '@/lib/db/repos/items';
import * as shops from '@/lib/db/repos/shops';

let db: Database.Database;
let uploads: string;
let cwd: string;
let photo: Buffer;

const itemFiles = () => fs.readdirSync(path.join(uploads, 'items'));
const fileOf = (url: string) => path.join(uploads, 'items', url.slice('/i/'.length));

function draftShop() {
  return shops.create(db, { name: 'Leftovers' }).shop;
}

/** A resized copy of `bytes` in the optimizer cache, in the file layout tests/images/optimizer-cache.test.ts pins. */
function optimizedCopy(bytes: Buffer, key: string): string {
  const dir = path.join(cwd, '.next', 'cache', 'images', key);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `31536000.9999999999999.etag.${getImageEtag(bytes)}.webp`), 'resized');
  return dir;
}

beforeEach(async () => {
  db = createTestDb();
  uploads = fs.mkdtempSync(path.join(os.tmpdir(), 'shelfie-leftovers-'));
  cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'shelfie-leftovers-cwd-'));
  vi.stubEnv('UPLOADS_DIR', uploads);
  vi.spyOn(process, 'cwd').mockReturnValue(cwd);
  photo = await sharp({ create: { width: 40, height: 40, channels: 3, background: '#c21a4b' } }).jpeg().toBuffer();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  db.close();
  fs.rmSync(uploads, { recursive: true, force: true });
  fs.rmSync(cwd, { recursive: true, force: true });
});

describe('an upload that lands after the shop has gone', () => {
  it('a cover keeps no file and answers 404', async () => {
    const shop = draftShop();
    fs.mkdirSync(path.join(uploads, 'items'), { recursive: true });
    shops.deleteAndRetireSlug(db, shop);
    await expect(setShopImage(db, shop.id, 'cover', photo)).rejects.toMatchObject({ status: 404 });
    await expect(setShopImage(db, shop.id, 'logo', photo)).rejects.toBeInstanceOf(EditError);
    expect(itemFiles()).toEqual([]);
  });

  it('a retake leaves no folder behind', async () => {
    const shop = draftShop();
    shops.deleteAndRetireSlug(db, shop);
    await expect(setShopPhotos(db, shop, [photo], 'replace')).rejects.toMatchObject({ status: 404 });
    expect(fs.existsSync(path.join(uploads, shop.id))).toBe(false);
  });

  it('a retake on a shop that is still there is saved', async () => {
    const shop = draftShop();
    const saved = await setShopPhotos(db, shop, [photo], 'replace');
    expect(saved.menuPhotoPaths).toHaveLength(1);
    expect(fs.readdirSync(path.join(uploads, shop.id))).toHaveLength(1);
  });
});

describe('a photo that is replaced, cleared or read over', () => {
  const reading = { hasAiKey: true, extract: async () => recordedReading('marigold-bakehouse'), now: () => 1, recordedDelayMs: 0 };

  it('a second reading deletes the photos on the drafts it replaces', async () => {
    const { shop } = await createShopFromPhotos(db, [photo]);
    await runReading({ db, ...reading }, shop.id);
    const [first] = items.listWithVariants(db, shop.id);
    const url = await setItemPhoto(db, shop.id, first.id, photo);
    expect(itemFiles()).toHaveLength(1);

    await runReading({ db, ...reading, now: () => 10_000_000 }, shop.id);

    expect(fs.existsSync(fileOf(url))).toBe(false);
    expect(itemFiles()).toEqual([]);
  });

  it('a second reading keeps the photo of a published item', async () => {
    const { shop } = await createShopFromPhotos(db, [photo]);
    await runReading({ db, ...reading }, shop.id);
    const [first] = items.listWithVariants(db, shop.id);
    const url = await setItemPhoto(db, shop.id, first.id, photo);
    items.setPayPalProductId(db, first.id, 'PROD-1');

    await runReading({ db, ...reading, now: () => 10_000_000 }, shop.id);

    expect(fs.existsSync(fileOf(url))).toBe(true);
  });

  it('replacing and clearing a photo take its resized copies with them', async () => {
    const { shop } = await createShopFromPhotos(db, [photo]);
    await runReading({ db, ...reading }, shop.id);
    const [first] = items.listWithVariants(db, shop.id);

    const url = await setItemPhoto(db, shop.id, first.id, photo);
    const copy = optimizedCopy(fs.readFileSync(fileOf(url)), 'a');
    const next = await setItemPhoto(db, shop.id, first.id, photo);
    expect(fs.existsSync(copy)).toBe(false);

    const copy2 = optimizedCopy(fs.readFileSync(fileOf(next)), 'b');
    await clearItemPhoto(db, shop.id, first.id);
    expect(fs.existsSync(copy2)).toBe(false);
  });

  it('removeFiles takes the resized copies of what it removes', async () => {
    fs.mkdirSync(path.join(uploads, 'items'), { recursive: true });
    const file = path.join(uploads, 'items', 'img_abcdefghijklmnopqrst.webp');
    fs.writeFileSync(file, 'photo');
    const copy = optimizedCopy(Buffer.from('photo'), 'c');
    const keep = optimizedCopy(Buffer.from('another photo'), 'd');

    await removeFiles([file]);

    expect(fs.existsSync(file)).toBe(false);
    expect(fs.existsSync(copy)).toBe(false);
    expect(fs.existsSync(keep)).toBe(true);
  });
});
