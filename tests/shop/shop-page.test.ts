// The public shop page /s/[slug] (spec §10a): what it tells agents in <head>, and whether it says it is taking orders.
// Both follow one rule, `takesOrders` (live, and it can be paid), the same as the JSON-LD OrderAction, /agents.txt and
// /llms.txt and the agent door's create_order.
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
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

describe('shop page "not taking orders" note', () => {
  /** The page's intro (name, about, the note, how to get it) as HTML. */
  const introHtml = async (seed: Seed) => {
    const { nodes } = await pageFor(seed);
    const layout = nodes.find((n) => (n.props as { intro?: ReactNode }).intro !== undefined)!;
    return renderToStaticMarkup((layout.props as { intro: ReactElement }).intro);
  };
  const STILL_ASK = 'You can still read the menu and ask the assistant about it.';

  it('a paused shop says it isn’t taking orders right now', async () => {
    const html = await introHtml({ name: 'Rosa Bakes', status: 'paused' });
    expect(html).toMatch(/role="status"/);
    expect(html).toContain('Not taking orders right now.');
    expect(html).toContain(STILL_ASK);
  });

  it('a live shop with no PayPal email (it refuses every order) says it isn’t taking orders online yet', async () => {
    const html = await introHtml({ name: 'Rosa Bakes', payeeEmail: null });
    expect(html).toMatch(/role="status"/);
    expect(html).toContain('Not taking orders online yet.');
    expect(html).toContain(STILL_ASK);
  });

  it.each([
    ['a live shop with its PayPal email', { name: 'Rosa Bakes' }],
    ['the live demo shop, paid to the platform', { name: 'Marigold Bakehouse' }],
  ] as [string, Seed][])('is not there for %s', async (_label, seed) => {
    const html = await introHtml(seed);
    expect(html).not.toMatch(/role="status"/);
    expect(html).not.toContain('Not taking orders');
  });
});
