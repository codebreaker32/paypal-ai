// The review screen's Publish button follows the server's payee rule (spec §8a, `assertPayee`): a shop needs its
// seller's PayPal email to publish, except the demo shop, which may publish without one (it is then paid to the platform).
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }) }));

const { ReviewStep } = await import('@/components/setup/ReviewStep');
const { PAYEE_REQUIRED_MESSAGE } = await import('@/lib/domain/payee');
type Props = Parameters<typeof ReviewStep>[0];

const croissant: Props['items'][number] = {
  id: 'itm_1', shopId: 'shp_1', section: 'Pastries', name: 'Butter croissant', description: null, sourceText: 'Butter croissant 4.25',
  confidence: 'high', kind: 'PHYSICAL', issues: [], issueDetail: null, status: 'draft', soldOut: false, sort: 0,
  paypalProductId: null, publishedAt: null, updatedAt: '2026-11-06T09:00:00.000Z',
  variants: [{ id: 'var_1', itemId: 'itm_1', label: null, priceCents: 425, sort: 0 }],
};

function render(shop: { slug: string; payeeEmail: string | null }): string {
  const props: Props = {
    shopId: 'shp_1',
    photoCount: 1,
    shop: { id: 'shp_1', name: 'Marigold Bakehouse', about: '', pickupNotes: '', fulfillment: 'pickup', shippingFeeCents: 0, kind: 'food', ...shop },
    items: [croissant],
    skipped: [],
    warnings: [],
    nonUsd: false,
    recorded: false,
  };
  return renderToStaticMarkup(createElement(ReviewStep, props));
}

/** The sticky bar's Publish button (its opening tag). */
const publishButton = (html: string) => html.match(/<button[^>]*>(?:(?!<\/button>)[\s\S])*Publish 1 item to PayPal/)![0];
/** The PayPal email input (its tag). */
const payeeInput = (html: string) => html.match(/<input[^>]*type="email"[^>]*>/)![0];

describe('ReviewStep and the PayPal email', () => {
  it('a shop with no PayPal email can’t publish yet, and says why', () => {
    const html = render({ slug: 'draft-abcdefgh', payeeEmail: null });
    expect(publishButton(html)).toMatch(/\bdisabled=""/);
    expect(html).toContain(PAYEE_REQUIRED_MESSAGE);
    expect(payeeInput(html)).toMatch(/\brequired=""/);
  });

  it('a shop with its PayPal email can publish', () => {
    const html = render({ slug: 'draft-abcdefgh', payeeEmail: 'rosa@example.com' });
    expect(publishButton(html)).not.toMatch(/\bdisabled=""/);
    expect(html).not.toContain(PAYEE_REQUIRED_MESSAGE);
  });

  it('the demo shop can publish without one (paid to the platform), and the field is optional', () => {
    const html = render({ slug: 'marigold-bakehouse', payeeEmail: null });
    expect(publishButton(html)).not.toMatch(/\bdisabled=""/);
    expect(html).not.toContain(PAYEE_REQUIRED_MESSAGE);
    expect(payeeInput(html)).not.toMatch(/\brequired=""/);
  });
});
