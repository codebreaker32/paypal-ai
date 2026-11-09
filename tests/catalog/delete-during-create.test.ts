// An account delete can commit while a new shop's photos are being written. Writing recreates the folder the delete
// removed, and no row points at it afterwards, so the code that wrote the photos has to clean up (SR19).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type Database from 'better-sqlite3';
import { SAMPLE_IDS } from '@/lib/ai/samples';
import { deleteAccountRows, removeFiles } from '@/lib/catalog/delete-shop';
import { createShopFromPhotos, createShopFromSample, setShopPhotos } from '@/lib/catalog/setup';
import { createTestDb } from '@/lib/db';
import * as accounts from '@/lib/db/repos/accounts';
import * as shops from '@/lib/db/repos/shops';

type Write = (shopId: string, name: string, jpeg: Buffer) => Promise<string>;

const hook = vi.hoisted(() => ({ write: null as null | ((real: Write, id: string, name: string, jpeg: Buffer) => Promise<string>) }));

vi.mock('@/lib/uploads', async (original) => {
  const actual = await original<typeof import('@/lib/uploads')>();
  return {
    ...actual,
    writeUpload: (id: string, name: string, jpeg: Buffer) =>
      hook.write ? hook.write(actual.writeUpload, id, name, jpeg) : actual.writeUpload(id, name, jpeg),
  };
});

let db: Database.Database;
let uploads: string;
let photo: Buffer;
let accountId: string;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const leftOnDisk = () => fs.readdirSync(uploads, { recursive: true }).map(String);

async function deleteAccount(): Promise<void> {
  const out = db.transaction(() => deleteAccountRows(db, accountId))();
  if ('blocked' in out) throw new Error('blocked');
  await removeFiles(out.paths);
}

/** The delete lands just after this write finishes, the moment that recreates the folder. */
function deleteDuringWrite(): void {
  let deleted = false;
  hook.write = async (real, id, name, jpeg) => {
    const saved = await real(id, name, jpeg);
    if (!deleted) {
      deleted = true;
      await deleteAccount();
      await real(id, name, jpeg); // the write the delete raced: it lands after the folder went
    }
    return saved;
  };
}

beforeEach(async () => {
  db = createTestDb();
  uploads = fs.mkdtempSync(path.join(os.tmpdir(), 'shelfie-create-delete-'));
  vi.stubEnv('UPLOADS_DIR', uploads);
  photo = await sharp({ create: { width: 40, height: 40, channels: 3, background: '#c21a4b' } }).jpeg().toBuffer();
  accountId = accounts.create(db, { email: 'a@example.com', passwordHash: 'x', recoveryHash: 'r', termsVersion: 'v1' }).id;
});

afterEach(() => {
  hook.write = null;
  vi.unstubAllEnvs();
  db.close();
  fs.rmSync(uploads, { recursive: true, force: true });
});

describe('an account deleted while a new shop is being created', () => {
  it('leaves no menu photo behind and answers 404', async () => {
    deleteDuringWrite();
    await expect(createShopFromPhotos(db, [photo], accountId)).rejects.toMatchObject({ status: 404 });
    expect(leftOnDisk()).toEqual([]);
  });

  it('leaves no sample photo behind either', async () => {
    deleteDuringWrite();
    await expect(createShopFromSample(db, SAMPLE_IDS[0], accountId)).rejects.toMatchObject({ status: 404 });
    expect(leftOnDisk()).toEqual([]);
  });

  it('waits for every page, so one that fails cannot leave another still writing', async () => {
    hook.write = async (real, id, name, jpeg) => {
      if (name === 'page-1.jpg') {
        await deleteAccount();
        throw Object.assign(new Error('gone'), { code: 'ENOENT' });
      }
      await wait(30);
      return real(id, name, jpeg);
    };
    await expect(createShopFromPhotos(db, [photo, photo], accountId)).rejects.toMatchObject({ status: 404 });
    await wait(60);
    expect(leftOnDisk()).toEqual([]);
  });

  it('still reports a failed write when the shop is there', async () => {
    hook.write = async () => {
      throw new Error('disk full');
    };
    await expect(createShopFromPhotos(db, [photo], accountId)).rejects.toThrow('disk full');
    expect(shops.listByAccount(db, accountId)).toHaveLength(1);
  });

  it('creates the shop as usual when nothing is deleted', async () => {
    const { shop } = await createShopFromPhotos(db, [photo, photo], accountId);
    expect(shop.menuPhotoPaths).toEqual([`${shop.id}/page-1.jpg`, `${shop.id}/page-2.jpg`]);
    expect(fs.readdirSync(path.join(uploads, shop.id))).toHaveLength(2);
  });
});

describe('an account deleted during a retake', () => {
  it('waits for every page before cleaning up', async () => {
    const { shop } = await createShopFromPhotos(db, [photo], accountId);
    hook.write = async (real, id, name, jpeg) => {
      if (name.startsWith('page-1-')) {
        await deleteAccount();
        throw Object.assign(new Error('gone'), { code: 'ENOENT' });
      }
      await wait(30);
      return real(id, name, jpeg);
    };
    await expect(setShopPhotos(db, shop, [photo, photo], 'replace')).rejects.toMatchObject({ status: 404 });
    await wait(60);
    expect(leftOnDisk()).toEqual([]);
  });
});
