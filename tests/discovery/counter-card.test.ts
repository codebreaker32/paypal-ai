// The one counter card drawing: full size on /shops/[id]/card (printed alone) and as a miniature in Share, where it must
// neither print alone nor add a second heading, ids or an image to the page's accessibility tree.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CounterCard } from '@/components/dashboard/CounterCard';

const props = {
  name: 'Rosa Bakes',
  coverUrl: '/demo/rosa/cover.webp',
  shopUrl: 'https://shelfie.example/s/rosa',
  doorUrl: 'https://shelfie.example/s/rosa/mcp',
  qr: '<svg data-marker="the-qr" viewBox="0 0 1 1"></svg>',
};
// React puts a preload <link> for the cover before the card; the card itself comes after it.
const render = (extra: { miniature?: boolean } = {}) => renderToStaticMarkup(createElement(CounterCard, { ...props, ...extra })).replace(/^<link[^>]*>/, '');

describe('CounterCard', () => {
  it('draws the QR it is handed, not one of its own', () => {
    expect(render()).toContain('data-marker="the-qr"');
    expect(render({ miniature: true })).toContain('data-marker="the-qr"');
  });

  it('full size: prints alone, is named by its heading, and has the testids and links', () => {
    const html = render();
    expect(html).toMatch(/^<article[^>]*data-print-alone/);
    expect(html).toContain('aria-labelledby="card-shop-name"');
    expect(html).toMatch(/<h2[^>]*id="card-shop-name"/);
    expect(html).toContain('role="img" aria-label="QR code that opens shelfie.example/s/rosa"');
    for (const id of ['card-qr', 'card-shop-url', 'card-door-url']) expect(html).toContain(`data-testid="${id}"`);
  });

  it('miniature: hidden from assistive tech, and it never takes over printing or duplicates an id or testid', () => {
    const html = render({ miniature: true });
    expect(html).toMatch(/^<div[^>]*aria-hidden="true"/);
    expect(html).not.toContain('data-print-alone');
    expect(html).not.toContain('card-shop-name');
    expect(html).not.toContain('<h2');
    expect(html).not.toContain('data-testid');
  });

  it('miniature: still the same card, with the logo scaled to it', () => {
    const html = render({ miniature: true });
    expect(html).toContain('Rosa Bakes');
    expect(html).toContain('Scan for the menu');
    expect(html).toContain('shelfie.example/s/rosa/mcp');
    expect(html).toContain('/demo/rosa/cover.webp');
    expect(html).toMatch(/<svg[^>]*class="[^"]*h-\[5cqw\]/);
    expect(html).not.toMatch(/<svg[^>]*class="[^"]*\bh-6\b/);
  });
});
