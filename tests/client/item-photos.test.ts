import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/client/http';
import { dataUrlToBlob, proposeFromCounter, removeCover, removeItemPhoto, uploadCover, uploadItemPhoto } from '@/lib/client/item-photos';

function stubFetch(status: number, body: unknown) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('item photo client', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uploads an item photo as multipart field "photo" and returns its URL', async () => {
    const f = stubFetch(200, { photoUrl: '/i/img_abcdefghijklmnopqrst.webp' });
    const file = new File([new Uint8Array([1, 2, 3])], 'bun.jpg', { type: 'image/jpeg' });
    expect(await uploadItemPhoto('shp_1', 'itm_2', file)).toBe('/i/img_abcdefghijklmnopqrst.webp');
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/shops/shp_1/items/itm_2/photo');
    expect(init.method).toBe('POST');
    expect((init.body as FormData).get('photo')).toBeInstanceOf(File);
  });

  it('removes an item photo, and uploads or removes the cover', async () => {
    const f = stubFetch(200, { photoUrl: null });
    await removeItemPhoto('shp_1', 'itm_2');
    expect(f.mock.calls[0]).toEqual(['/api/shops/shp_1/items/itm_2/photo', expect.objectContaining({ method: 'DELETE' })]);
    stubFetch(200, { coverUrl: '/i/img_qrstuvwxyz234567abcd.webp' });
    expect(await uploadCover('shp_1', new Blob([new Uint8Array([1])]))).toBe('/i/img_qrstuvwxyz234567abcd.webp');
    const g = stubFetch(200, { coverUrl: null });
    await removeCover('shp_1');
    expect(g.mock.calls[0]).toEqual(['/api/shops/shp_1/cover', expect.objectContaining({ method: 'DELETE' })]);
  });

  it("throws the server's plain message for a refused photo", async () => {
    stubFetch(415, { error: { code: 'BAD_IMAGE', message: 'We couldn’t open that photo. Try a JPG or PNG.' } });
    const err = await uploadItemPhoto('shp_1', 'itm_2', new Blob(['x'])).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 415, code: 'BAD_IMAGE', message: 'We couldn’t open that photo. Try a JPG or PNG.' });
  });

  it('sends a display-case photo to the counter route and returns its proposals', async () => {
    const proposals = [{ itemId: 'itm_2', name: 'Bun', confidence: 'high', image: 'data:image/webp;base64,AAEC' }];
    const f = stubFetch(200, { proposals });
    expect(await proposeFromCounter('shp_1', new File([new Uint8Array([1])], 'case.jpg'))).toEqual(proposals);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/shops/shp_1/counter');
    expect((init.body as FormData).get('photo')).toBeInstanceOf(File);
  });

  it('turns a proposal’s data URL back into a WebP blob for upload', async () => {
    const blob = dataUrlToBlob('data:image/webp;base64,AAEC');
    expect(blob.type).toBe('image/webp');
    expect([...new Uint8Array(await blob.arrayBuffer())]).toEqual([0, 1, 2]);
  });
});
