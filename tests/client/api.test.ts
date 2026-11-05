import { describe, expect, it, vi } from 'vitest';
import { StartError, startErrorMessage, startFromPhotos, startFromSample } from '@/lib/client/api';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const jpg = (name: string) => new File([new Uint8Array(16)], name, { type: 'image/jpeg' });

async function expectStartError(p: Promise<unknown>, kind: StartError['kind']) {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(StartError);
  expect((err as StartError).kind).toBe(kind);
}

describe('startFromPhotos', () => {
  it('POSTs every photo as multipart "photos" to /api/shops and returns the shop id', async () => {
    const fetchMock = vi.fn(async () => json(201, { shopId: 'shp_abc' }));
    const files = [jpg('page-1.jpg'), jpg('page-2.jpg')];

    await expect(startFromPhotos(files, { fetch: fetchMock })).resolves.toEqual({ shopId: 'shp_abc' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/shops');
    expect(init.method).toBe('POST');
    const body = init.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.getAll('photos').map((f) => (f as File).name)).toEqual(['page-1.jpg', 'page-2.jpg']);
  });

  it('maps the server error codes to start error kinds', async () => {
    const cases: [number, unknown, StartError['kind']][] = [
      [400, { error: { code: 'BAD_IMAGE', message: 'x' } }, 'bad_file'],
      [400, { error: { code: 'TOO_MANY_PHOTOS', message: 'x' } }, 'too_many'],
      [413, { error: { code: 'PHOTO_TOO_LARGE', message: 'x' } }, 'too_large'],
      [413, {}, 'too_large'],
      [415, {}, 'bad_file'],
      [500, { error: { code: 'EXTRACTION_FAILED' } }, 'server'],
      [502, 'not json', 'server'],
    ];
    for (const [status, body, kind] of cases) {
      const fetchMock = vi.fn(async () => json(status, body));
      await expectStartError(startFromPhotos([jpg('a.jpg')], { fetch: fetchMock }), kind);
    }
  });

  it('treats a 2xx without a shop id as a server error', async () => {
    const fetchMock = vi.fn(async () => json(200, { ok: true }));
    await expectStartError(startFromPhotos([jpg('a.jpg')], { fetch: fetchMock }), 'server');
  });

  it('reports a network failure when fetch rejects', async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    await expectStartError(startFromPhotos([jpg('a.jpg')], { fetch: fetchMock }), 'network');
  });
});

describe('startFromSample', () => {
  it('POSTs JSON { sample } to /api/shops and returns the shop id', async () => {
    const fetchMock = vi.fn(async () => json(201, { shopId: 'shp_sample' }));

    await expect(startFromSample('tia-lupe-chalkboard', { fetch: fetchMock })).resolves.toEqual({
      shopId: 'shp_sample',
    });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/shops');
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('content-type')).toBe('application/json');
    expect(JSON.parse(String(init.body))).toEqual({ sample: 'tia-lupe-chalkboard' });
  });

  it('turns a failed response into a server error', async () => {
    const fetchMock = vi.fn(async () => json(500, { error: { code: 'INTERNAL' } }));
    await expectStartError(startFromSample('ravi-bike-repair', { fetch: fetchMock }), 'server');
  });
});

describe('startErrorMessage', () => {
  it('uses the plain-language copy from the spec', () => {
    expect(startErrorMessage('bad_file')).toBe("We couldn't open that photo. Try a JPG or PNG.");
    expect(startErrorMessage('too_many')).toMatch(/up to 4 photos/i);
    expect(startErrorMessage('too_large')).toMatch(/15 MB/);
    expect(startErrorMessage('network')).toMatch(/connection/i);
    expect(startErrorMessage('server')).toMatch(/try again/i);
  });
});
