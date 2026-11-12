// No proxy or middleware stands in front of uploads. A proxy once cut a 14 MB upload to 10 MB, so this sends one
// through a real server: a truncated multipart body has no closing boundary and would fail to parse (400 NO_PHOTOS).
import { expect, test } from '@playwright/test';
import sharp from 'sharp';

const FOURTEEN_MB = 14 * 1024 * 1024;

test('a 14 MB menu photo reaches POST /api/shops whole', async ({ request }) => {
  const jpeg = await sharp({ create: { width: 300, height: 400, channels: 3, background: '#ddd' } }).jpeg().toBuffer();
  const buffer = Buffer.concat([jpeg, Buffer.alloc(FOURTEEN_MB - jpeg.length, 0x20)]); // bytes after the image's end are ignored
  const res = await request.post('/api/shops', { multipart: { photos: { name: 'menu.jpg', mimeType: 'image/jpeg', buffer } } });
  expect(res.status(), await res.text()).toBe(201);
  const { shopId } = (await res.json()) as { shopId: string };
  expect(shopId).toMatch(/^shp_/);
});
