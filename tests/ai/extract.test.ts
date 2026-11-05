import { describe, expect, it, vi } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { extractMenu } from '@/lib/ai/extract';
import type { MenuExtraction } from '@/lib/ai/schemas';

const OK: MenuExtraction = {
  is_menu: true, image_quality: 'good', problems: [], retake_tip: null, warnings: [],
  shop: { name: 'X', about: null, pickup_notes: null }, kind: 'food', items: [], skipped_lines: [],
};
const photo = (s: string) => ({ data: Buffer.from(s), mediaType: 'image/jpeg' as const });

function stub(...results: Array<MenuExtraction | Error>) {
  const parse = vi.fn(async (..._args: unknown[]) => {
    const r = results.shift()!;
    if (r instanceof Error) throw r;
    return { parsed_output: r };
  });
  return { client: { messages: { parse } } as unknown as Anthropic, parse };
}

type Call = [Record<string, any>, Record<string, any>];

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
    const blocks = params.messages[0].content as any[];
    const seq = blocks.map((b) => (b.type === 'text' ? b.text : 'IMG'));
    expect(seq.slice(0, 4)).toEqual(['Page 1:', 'IMG', 'Page 2:', 'IMG']);
    expect(blocks[1].source.data).toBe(Buffer.from('one').toString('base64'));
    expect(blocks[3].source.data).toBe(Buffer.from('two').toString('base64'));
  });

  it('retries exactly once on a validation failure, including the error in the prompt', async () => {
    const { client, parse } = stub(new Error('Expected string at items[0].name'), OK);
    const out = await extractMenu([photo('a')], { client });
    expect(out).toEqual(OK);
    expect(parse).toHaveBeenCalledTimes(2);
    const [second] = parse.mock.calls[1] as unknown as Call;
    expect(second.messages[0].content.at(-1).text).toContain('Expected string at items[0].name');
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
