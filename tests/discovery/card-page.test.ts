// The counter card page /shops/[id]/card (spec §4, §10a). A draft shop's slug is a throwaway `draft-xxxxxxxx` that first
// publish replaces, so a card printed from a draft would never open the shop: a draft gets no QR, no links and no Print
// button, only the way back to finishing setup. Owner only (requireOwner).
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Shop } from '@/lib/domain/types';

const h = vi.hoisted(() => ({ shop: null as Shop | null, asked: [] as string[] }));

vi.mock('@/lib/auth/owner', () => ({
  getOwnedShop: vi.fn(async () => h.shop),
  requireOwner: vi.fn(async (id: string) => {
    h.asked.push(id);
    if (!h.shop || h.shop.id !== id) throw new Error('NEXT_HTTP_ERROR_FALLBACK;404');
    return h.shop;
  }),
}));

const { createTestDb } = await import('@/lib/db');
const shops = await import('@/lib/db/repos/shops');
const { getConfig } = await import('@/lib/config');
const { seedShop } = await import('../helpers/shop');
const { default: CounterCardPage } = await import('@/app/shops/[id]/(app)/card/page');

async function render(shop: Shop): Promise<string> {
  h.shop = shop;
  const el = (await CounterCardPage({ params: Promise.resolve({ id: shop.id }) } as never)) as ReactElement;
  return renderToStaticMarkup(createElement(() => el));
}

describe('counter card page', () => {
  beforeEach(() => {
    h.shop = null;
    h.asked = [];
  });

  it('a live shop: the QR, its shop link and agent door, and Print', async () => {
    const { shop } = seedShop(createTestDb(), { name: 'Rosa Bakes' });
    const html = await render(shop);
    const shopUrl = `${getConfig().appUrl}/s/rosa-bakes`;
    expect(html).toContain('data-testid="card-qr"');
    expect(html).toContain(shopUrl.replace(/^https?:\/\//, ''));
    expect(html).toContain(`${shopUrl}/mcp`);
    expect(html).toContain('Print card');
    expect(h.asked).toEqual([shop.id]);
  });

  it('a draft shop: no QR, no links, no Print; says the card is ready once the shop is live, and links to setup', async () => {
    const { shop } = shops.create(createTestDb(), { name: 'draft abcdefgh' });
    expect(shop.slug).toMatch(/^draft-/);
    const html = await render(shop);
    expect(html).not.toContain('data-testid="card-qr"');
    expect(html).not.toContain('data-testid="card-shop-url"');
    expect(html).not.toContain('data-testid="card-door-url"');
    expect(html).not.toContain(shop.slug);
    expect(html).not.toContain('Print card');
    expect(html).toContain('Your counter card is ready once your shop is live.');
    expect(html).toMatch(new RegExp(`<a[^>]*href="/shops/${shop.id}/setup"[^>]*>[^<]*Finish setting up`));
    expect(h.asked).toEqual([shop.id]);
  });

  it('is for the owner only: requireOwner turns anyone else away', async () => {
    const { shop } = seedShop(createTestDb(), { name: 'Rosa Bakes' });
    h.shop = null;
    await expect(CounterCardPage({ params: Promise.resolve({ id: shop.id }) } as never)).rejects.toThrow(/404/);
    expect(h.asked).toEqual([shop.id]);
  });
});
