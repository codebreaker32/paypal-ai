// Reading a request body with a byte cap: the cap counts the stream, not just Content-Length.
import { describe, expect, it } from 'vitest';
import { BodyTooLargeError, readJsonLimited, readTextLimited } from '@/lib/http/read-body';

/** A chunked body (no Content-Length) of `chunks` × `size` bytes that counts how many chunks were pulled. */
function streamed(chunks: number, size: number, headers: Record<string, string> = {}) {
  let pulled = 0;
  const body = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        if (pulled === chunks) return controller.close();
        pulled++;
        controller.enqueue(new Uint8Array(size).fill(0x20));
      },
    },
    { highWaterMark: 0 },
  );
  const req = new Request('http://x', { method: 'POST', headers, body, duplex: 'half' } as RequestInit);
  return { req, pulled: () => pulled };
}

describe('readTextLimited', () => {
  it('refuses a declared Content-Length over the cap without reading the body', async () => {
    const { req, pulled } = streamed(4, 1024, { 'content-length': String(64 * 1024 + 1) });
    await expect(readTextLimited(req, 64 * 1024)).rejects.toBeInstanceOf(BodyTooLargeError);
    expect(pulled()).toBe(0);
  });
  it('stops a chunked body as soon as it passes the cap', async () => {
    const { req, pulled } = streamed(1000, 16 * 1024); // 16 MB, no Content-Length
    await expect(readTextLimited(req, 64 * 1024)).rejects.toBeInstanceOf(BodyTooLargeError);
    expect(pulled()).toBeLessThanOrEqual(6);
  });
  it('reads a body under the cap, multi-byte characters split across chunks included', async () => {
    const bytes = new TextEncoder().encode('{"text":"café ✓"}');
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        for (let i = 0; i < bytes.length; i += 3) c.enqueue(bytes.slice(i, i + 3));
        c.close();
      },
    });
    const req = new Request('http://x', { method: 'POST', body, duplex: 'half' } as RequestInit);
    expect(await readTextLimited(req, 1024)).toBe('{"text":"café ✓"}');
  });
  it('an empty body is an empty string', async () => {
    expect(await readTextLimited(new Request('http://x', { method: 'POST' }), 10)).toBe('');
  });
});

describe('readJsonLimited', () => {
  it('parses JSON under the cap', async () => {
    const req = new Request('http://x', { method: 'POST', body: JSON.stringify({ a: 1 }) });
    expect(await readJsonLimited(req, 1024)).toEqual({ a: 1 });
  });
  it('throws a SyntaxError (not BodyTooLargeError) for a body that is not JSON', async () => {
    const req = new Request('http://x', { method: 'POST', body: 'nope' });
    await expect(readJsonLimited(req, 1024)).rejects.toBeInstanceOf(SyntaxError);
  });
});
