// The public shop page /s/[slug]: what it tells agents in <head>, and whether it says it is taking orders.
// Both follow one rule, `takesOrders` (live, and it can be paid), the same as the JSON-LD OrderAction, /agents.txt and
// /llms.txt and the agent door's create_order.
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
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
const { ToastProvider } = await import('@/components/ui/toast');
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

describe('shop page assistant starter prompts', () => {
  const starters = async (seed: Seed) => {
    const { nodes } = await pageFor(seed);
    const layout = nodes.find((n) => (n.props as { starters?: string[] }).starters !== undefined)!;
    return (layout.props as { starters: string[] }).starters;
  };
  /** The one starter that asks to buy something: "Two …, shipped to me" or "…, for pickup". */
  const ordering = (prompts: string[]) => prompts.filter((p) => /shipped to me|for pickup/.test(p));

  it.each([
    ['a live shop with its PayPal email', { name: 'Rosa Bakes' }],
    ['the live demo shop, paid to the platform', { name: 'Marigold Bakehouse' }],
  ] as [string, Seed][])('include an order for %s', async (_label, seed) => {
    expect(ordering(await starters(seed))).toHaveLength(1);
  });

  it.each([
    ['a live shop with no PayPal email (it refuses every order)', { name: 'Rosa Bakes', payeeEmail: null }],
    ['a paused shop', { name: 'Rosa Bakes', status: 'paused' }],
  ] as [string, Seed][])('are only questions for %s', async (_label, seed) => {
    const prompts = await starters(seed);
    expect(prompts.length).toBeGreaterThan(0);
    expect(ordering(prompts)).toEqual([]);
  });
});

describe('shop page agent door section', () => {
  /** The page's agent door section as HTML (its copy buttons need the toast provider the root layout mounts). */
  const doorHtml = async (seed: Seed) => {
    const { slug, nodes } = await pageFor(seed);
    const layout = nodes.find((n) => (n.props as { door?: ReactNode }).door !== undefined)!;
    const html = renderToStaticMarkup(createElement(ToastProvider, null, (layout.props as { door: ReactElement }).door));
    return { slug, html: html.replaceAll('<!-- -->', '') };
  };
  const ORDERING = 'place an order through this address';
  const NOT_TAKING = 'This shop isn’t taking orders right now. Any AI assistant that speaks MCP can still read its menu through this address.';

  it.each([
    ['a live shop with its PayPal email', { name: 'Rosa Bakes' }],
    ['the live demo shop, paid to the platform', { name: 'Marigold Bakehouse' }],
  ] as [string, Seed][])('says assistants can order through it for %s', async (_label, seed) => {
    const { slug, html } = await doorHtml(seed);
    expect(html).toContain(ORDERING);
    expect(html).not.toContain(NOT_TAKING);
    expect(html).toContain(`${getConfig().appUrl}/s/${slug}/mcp`);
  });

  // The door still answers questions (get_shop_info, list_products), so the address stays; only ordering is gone.
  it.each([
    ['a live shop with no PayPal email (it refuses every order)', { name: 'Rosa Bakes', payeeEmail: null }],
    ['a paused shop', { name: 'Rosa Bakes', status: 'paused' }],
  ] as [string, Seed][])('keeps its address but says it isn’t taking orders for %s', async (_label, seed) => {
    const { slug, html } = await doorHtml(seed);
    expect(html).toContain(NOT_TAKING);
    expect(html).not.toContain(ORDERING);
    expect(html).not.toContain('approves every payment');
    expect(html).toContain(`${getConfig().appUrl}/s/${slug}/mcp`);
  });
});

describe('shop page assistant card', () => {
  /** The whole layout (intro, menu, door and the assistant card) as HTML, with the console closed. */
  const layoutHtml = async (seed: Seed) => {
    const { nodes } = await pageFor(seed);
    const layout = nodes.find((n) => (n.props as { door?: ReactNode }).door !== undefined)! as ReactElement;
    return renderToStaticMarkup(createElement(ToastProvider, null, layout)).replaceAll('<!-- -->', '');
  };

  it.each([
    ['a live shop with its PayPal email', { name: 'Rosa Bakes' }],
    ['the live demo shop, paid to the platform', { name: 'Marigold Bakehouse' }],
  ] as [string, Seed][])('offers to order for %s', async (_label, seed) => {
    const html = await layoutHtml(seed);
    expect(html).toContain('Order with an assistant');
    expect(html).not.toContain('Ask the assistant');
  });

  it.each([
    ['a live shop with no PayPal email (it refuses every order)', { name: 'Rosa Bakes', payeeEmail: null }],
    ['a paused shop', { name: 'Rosa Bakes', status: 'paused' }],
  ] as [string, Seed][])('offers only questions for %s', async (_label, seed) => {
    const html = await layoutHtml(seed);
    expect(html).toContain('Ask the assistant');
    expect(html).not.toContain('Order with an assistant');
    expect(html).not.toContain('hands payment to PayPal');
  });
});
