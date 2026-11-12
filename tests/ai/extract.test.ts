import { describe, expect, it, vi } from 'vitest';
import AnthropicClient from '@anthropic-ai/sdk';
import type Anthropic from '@anthropic-ai/sdk';
import { READING_DEADLINE_MS, extractMenu } from '@/lib/ai/extract';
import { READING_STALE_MS } from '@/lib/catalog/setup';
import type { MenuExtraction } from '@/lib/ai/schemas';

const OK: MenuExtraction = {
  is_menu: true, image_quality: 'good', problems: [], retake_tip: null, warnings: [],
  shop: { name: 'X', about: null, pickup_notes: null }, kind: 'food', currency: null, items: [], skipped_lines: [],
};
const photo = (s: string) => ({ data: Buffer.from(s), mediaType: 'image/jpeg' as const });

function stub(...results: Array<MenuExtraction | Error>) {
  const parse = vi.fn(async () => {
    const r = results.shift()!;
    if (r instanceof Error) throw r;
    return { parsed_output: r };
  });
  return { client: { messages: { parse } } as unknown as Anthropic, parse };
}

type Block = { type: string; text?: string; source?: { data: string } };
type Call = [
  { model: string; temperature?: unknown; output_config: { format: unknown; effort: string }; messages: Array<{ content: unknown }> },
  { timeout: number },
];

describe('extractMenu', () => {
  it('sends model id, labelled images in page order, and an output format', async () => {
    const { client, parse } = stub(OK);
    await extractMenu([photo('one'), photo('two')], { client });
    const [params, opts] = parse.mock.calls[0] as unknown as Call;
    expect(params.model).toBe('claude-sonnet-5-5');
    expect(params.output_config.format).toBeTruthy();
    expect(params.output_config.effort).toBe('medium');
    expect(params.temperature).toBeUndefined();
    expect(opts.timeout).toBe(90_000);
    const blocks = params.messages[0].content as Block[];
    const seq = blocks.map((b) => (b.type === 'text' ? b.text : 'IMG'));
    expect(seq.slice(0, 4)).toEqual(['Page 1:', 'IMG', 'Page 2:', 'IMG']);
    expect(blocks[1].source?.data).toBe(Buffer.from('one').toString('base64'));
    expect(blocks[3].source?.data).toBe(Buffer.from('two').toString('base64'));
  });

  it('retries exactly once on a validation failure, including the error in the prompt', async () => {
    const { client, parse } = stub(new Error('Expected string at items[0].name'), OK);
    const out = await extractMenu([photo('a')], { client });
    expect(out).toEqual(OK);
    expect(parse).toHaveBeenCalledTimes(2);
    const [second] = parse.mock.calls[1] as unknown as Call;
    expect((second.messages[0].content as Block[]).at(-1)?.text).toContain('Expected string at items[0].name');
  });

  it('gives up after one retry', async () => {
    const { client, parse } = stub(new Error('bad 1'), new Error('bad 2'), OK);
    await expect(extractMenu([photo('a')], { client })).rejects.toThrow('bad 2');
    expect(parse).toHaveBeenCalledTimes(2);
  });

  it('does not retry API errors', async () => {
    const e = Object.assign(new Error('rate limited'), { status: 429 });
    const { client, parse } = stub(e, OK);
    await expect(extractMenu([photo('a')], { client })).rejects.toThrow('rate limited');
    expect(parse).toHaveBeenCalledTimes(1);
  });

  it('rejects 0 or more than 4 photos', async () => {
    const { client } = stub(OK);
    await expect(extractMenu([], { client })).rejects.toThrow();
    await expect(extractMenu(Array(5).fill(photo('a')), { client })).rejects.toThrow();
  });
});

describe('extractMenu time budget', () => {
  // The real SDK client with a fetch that never answers: every SDK retry and the re-prompt
  // together must give up before the setup page calls the reading dead (READING_STALE_MS).
  // Otherwise "Try again" starts a second paid reading while the first is still running.
  it('a hanging reading gives up, SDK retries included, well inside the stale window', async () => {
    vi.useFakeTimers();
    try {
      let attempts = 0;
      const hang = (_url: unknown, init?: RequestInit) => {
        attempts++;
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        });
      };
      const client = new AnthropicClient({ apiKey: 'test', fetch: hang as unknown as typeof fetch });
      const start = Date.now();
      let settledAt: number | null = null;
      const done = extractMenu([photo('x')], { client }).then(
        () => { throw new Error('expected a failure'); },
        (e: unknown) => { settledAt = Date.now(); return e; },
      );
      await vi.advanceTimersByTimeAsync(READING_STALE_MS + 5 * 60_000);
      expect(await done).toBeInstanceOf(Error);
      expect(settledAt).not.toBeNull();
      expect(settledAt! - start).toBeLessThanOrEqual(READING_DEADLINE_MS);
      expect(attempts).toBeGreaterThanOrEqual(2); // one SDK retry still covers a dropped connection
    } finally {
      vi.useRealTimers();
    }
  });
  it('the deadline leaves at least a minute before the reading counts as dead', () => {
    expect(READING_DEADLINE_MS + 60_000).toBeLessThanOrEqual(READING_STALE_MS);
  });
});
