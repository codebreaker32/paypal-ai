// "Snap your counter": Claude finds menu items in a photo of the display case; we keep only what is safe to crop.
import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';
import { matchCounterPhoto, type CounterItem } from '@/lib/ai/counter';

const ITEMS: CounterItem[] = [
  { id: 'itm_1', name: 'Butter croissant', section: 'Pastries', description: null },
  { id: 'itm_2', name: 'Almond croissant', section: 'Pastries', description: 'with frangipane' },
  { id: 'itm_3', name: 'Cardamom bun', section: 'Pastries', description: null },
];
const PHOTO = { data: Buffer.from('jpeg'), mediaType: 'image/jpeg' as const, width: 1600, height: 1000 };

function stub(output: unknown) {
  const parse = vi.fn().mockResolvedValue({ parsed_output: output });
  return { client: { messages: { parse } } as unknown as Anthropic, parse };
}
const m = (item_id: string, box: [number, number, number, number], confidence = 'high') => ({
  item_id, box: { x0: box[0], y0: box[1], x1: box[2], y1: box[3] }, confidence, why: 'seen',
});

describe('matchCounterPhoto', () => {
  it('sends the photo, its pixel size and the menu items by id', async () => {
    const { client, parse } = stub({ matches: [] });
    await matchCounterPhoto(PHOTO, ITEMS, { client });
    const req = parse.mock.calls[0][0];
    expect(req.model).toBe('claude-sonnet-5-5');
    expect(req).not.toHaveProperty('temperature');
    expect(req).not.toHaveProperty('tool_choice');
    const content = req.messages[0].content;
    expect(content[0]).toMatchObject({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg' } });
    const text = content.find((c: { type: string }) => c.type === 'text').text as string;
    expect(text).toContain('1600x1000');
    expect(text).toContain('itm_2');
    expect(text).toContain('Almond croissant');
  });

  it('keeps found items with their box clamped to the photo', async () => {
    const { client } = stub({ matches: [m('itm_1', [100, 200, 500, 500]), m('itm_2', [1400, 800, 1700, 1100], 'medium')] });
    const out = await matchCounterPhoto(PHOTO, ITEMS, { client });
    expect(out).toEqual([
      { itemId: 'itm_1', box: { x0: 100, y0: 200, x1: 500, y1: 500 }, confidence: 'high' },
      { itemId: 'itm_2', box: { x0: 1400, y0: 800, x1: 1600, y1: 1000 }, confidence: 'medium' },
    ]);
  });

  it('drops ids that are not on the menu, low-confidence guesses and boxes too small to make a photo', async () => {
    const { client } = stub({
      matches: [
        m('itm_9', [0, 0, 400, 400]),
        m('itm_1', [0, 0, 400, 400], 'low'),
        m('itm_2', [10, 10, 40, 40]),
        m('itm_3', [600, 300, 600, 700]),
      ],
    });
    expect(await matchCounterPhoto(PHOTO, ITEMS, { client })).toEqual([]);
  });

  it('keeps one box per item, the most confident (the first on a tie)', async () => {
    const { client } = stub({ matches: [m('itm_1', [0, 0, 300, 300], 'medium'), m('itm_1', [500, 500, 900, 900]), m('itm_1', [100, 100, 400, 400])] });
    const out = await matchCounterPhoto(PHOTO, ITEMS, { client });
    expect(out).toHaveLength(1);
    expect(out[0].box).toEqual({ x0: 500, y0: 500, x1: 900, y1: 900 });
  });

  it('asks nothing of Claude when there are no items to look for', async () => {
    const { client, parse } = stub({ matches: [] });
    expect(await matchCounterPhoto(PHOTO, [], { client })).toEqual([]);
    expect(parse).not.toHaveBeenCalled();
  });

  it('throws when Claude returns no structured output', async () => {
    const { client } = stub(null);
    await expect(matchCounterPhoto(PHOTO, ITEMS, { client })).rejects.toThrow();
  });
});
