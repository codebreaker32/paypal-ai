// The public shop page /s/[slug] (spec §10a): what it tells agents in <head>. The agent door is advertised only by a
// shop that takes orders (`takesOrders`: live, and it can be paid), the same rule as the JSON-LD OrderAction and
// /agents.txt and /llms.txt.
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type Database from 'better-sqlite3';

const state = vi.hoisted(() => ({ db: null as unknown as Database.Database }));

vi.mock('@/lib/db', async (orig) => {
  const real = await orig<typeof import('@/lib/db')>();
  return { ...real, getDb: () => state.db };
});

const { createTestDb } = await import('@/lib/db');
const { getConfig } = await import('@/lib/config');
const { seedShop } = await import('../helpers/shop');
const { default: ShopPage } = await import('@/app/s/[slug]/page');

type Seed = Parameters<typeof seedShop>[1];

/** Renders the page's element tree for a fresh shop (no HTML: the tree is enough to see what goes in <head>). */
async function pageFor(seed: Seed): Promise<{ slug: string; nodes: ReactElement[] }> {
  state.db = createTestDb();
  const { shop } = seedShop(state.db, seed);
  const page = (await ShopPage({ params: Promise.resolve({ slug: shop.slug }), searchParams: Promise.resolve({}) } as never)) as ReactElement<{
    children: ReactNode;
  }>;
  const nodes = ([] as ReactNode[]).concat(page.props.children).filter(isValidElement) as ReactElement[];
  return { slug: shop.slug, nodes };
}

const alternateLinks = (nodes: ReactElement[]) =>
  nodes.filter((n) => n.type === 'link' && (n.props as { rel?: string }).rel === 'alternate').map((n) => n.props as Record<string, string>);
const jsonLd = (nodes: ReactElement[]) => nodes.filter((n) => n.type === 'script' && (n.props as { type?: string }).type === 'application/ld+json');

describe('shop page <link rel="alternate"> to the agent door', () => {
  it.each([
    ['a live shop with its PayPal email', { name: 'Rosa Bakes' }],
    ['the live demo shop, paid to the platform', { name: 'Marigold Bakehouse' }],
  ] as [string, Seed][])('is there for %s', async (_label, seed) => {
    const { slug, nodes } = await pageFor(seed);
    expect(alternateLinks(nodes)).toEqual([
      { rel: 'alternate', type: 'application/json', title: 'Agent door (MCP)', href: `${getConfig().appUrl}/s/${slug}/mcp` },
    ]);
    expect(jsonLd(nodes)).toHaveLength(1);
  });

  it.each([
    ['a live shop with no PayPal email (it refuses every order)', { name: 'Rosa Bakes', payeeEmail: null }],
    ['a paused shop', { name: 'Rosa Bakes', status: 'paused' }],
  ] as [string, Seed][])('is left out for %s, which still has its menu as JSON-LD', async (_label, seed) => {
    const { nodes } = await pageFor(seed);
    expect(alternateLinks(nodes)).toEqual([]);
    expect(jsonLd(nodes)).toHaveLength(1);
  });
});
