// The storefront as an order source: its reserved name, its shorter approval window and how it reads to the seller.
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type Db } from '@/lib/db';
import * as eventsRepo from '@/lib/db/repos/events';
import { STOREFRONT_AGENT_NAME, approvalMinutes, isStorefrontAgentName } from '@/lib/domain/storefront';
import { createFakePayPal, type FakePayPal } from '@/lib/paypal/fake';
import { OrderError } from '@/lib/orders/errors';
import { receiptView } from '@/lib/orders/receipt';
import { APPROVAL_WINDOW_MS, STOREFRONT_APPROVAL_WINDOW_MS, createOrderForShop, syncOrder, type OrderDeps } from '@/lib/orders/service';
import { actionWords, agentLabel, timelineEntries } from '@/lib/seller/view';
import { statusView } from '@/app/o/[ref]/receipt-status';
import { seedShop, type SeededShop } from '../helpers/shop';

const MIN = 60_000;

describe('isStorefrontAgentName', () => {
  it.each([
    'shelfie-storefront',
    'Shelfie-Storefront',
    '  shelfie-storefront  ',
    'shelfie storefront',
    'shelfie_storefront',
    'shelfie\u0000-storefront\n',
    'shelfie-storefront                                           x',
  ])('reserves %j', (name) => expect(isStorefrontAgentName(name)).toBe(true));

  it.each(['shelfie-assistant', 'claude-desktop', 'storefront', '', null, undefined])('leaves %j alone', (name) =>
    expect(isStorefrontAgentName(name)).toBe(false),
  );
});

describe('orders from the storefront', () => {
  let db: Db;
  let fake: FakePayPal;
  let s: SeededShop;
  let clock: number;
  let deps: OrderDeps;

  beforeEach(() => {
    db = createTestDb();
    fake = createFakePayPal();
    s = seedShop(db);
    clock = Date.parse('2026-11-09T10:00:00.000Z');
    deps = { db, paypal: fake, appUrl: 'http://localhost:3000', now: () => clock };
  });

  const order = (over: Partial<Parameters<typeof createOrderForShop>[2]> = {}) =>
    createOrderForShop(deps, s.shop, {
      lines: [{ itemId: s.item['Almond croissant'].id, quantity: 1 }],
      fulfillment: 'pickup',
      ...over,
    });

  describe('the approval window (SR28)', () => {
    it('is 20 minutes for the storefront and stays 60 for every agent', async () => {
      expect(STOREFRONT_APPROVAL_WINDOW_MS).toBe(20 * MIN);
      expect(APPROVAL_WINDOW_MS).toBe(60 * MIN);
      const shop = await order({ agentName: STOREFRONT_AGENT_NAME });
      expect(Date.parse(shop.expiresAt) - clock).toBe(20 * MIN);
      for (const agentName of ['shelfie-assistant', 'claude-desktop', null]) {
        const agent = await order({ agentName });
        expect(Date.parse(agent.expiresAt) - clock).toBe(60 * MIN);
      }
    });

    it('expires an unapproved storefront order after 20 minutes, not before', async () => {
      const o = await order({ agentName: STOREFRONT_AGENT_NAME });
      clock += 20 * MIN - 1;
      expect((await syncOrder(deps, o.id, 'poller')).status).toBe('awaiting_approval');
      clock += 1;
      expect((await syncOrder(deps, o.id, 'poller')).status).toBe('expired');
    });

    it('frees the buyer\'s open-order slot when the window ends', async () => {
      for (let i = 0; i < 3; i++) await order({ agentName: STOREFRONT_AGENT_NAME, clientKey: 'ip' });
      await expect(order({ agentName: STOREFRONT_AGENT_NAME, clientKey: 'ip' })).rejects.toBeInstanceOf(OrderError);
      clock += 20 * MIN + 1;
      expect((await order({ agentName: STOREFRONT_AGENT_NAME, clientKey: 'ip' })).status).toBe('awaiting_approval');
    });

    it('says the right number of minutes on the receipt', async () => {
      const shop = await order({ agentName: STOREFRONT_AGENT_NAME });
      const agent = await order({ agentName: 'claude-desktop' });
      expect(approvalMinutes(shop.agentName)).toBe(20);
      expect(approvalMinutes(agent.agentName)).toBe(60);
      const waiting = statusView(receiptView(db, shop.id)!, '', null);
      expect(waiting.body).toContain('the link works for 20 minutes');
      expect(statusView(receiptView(db, agent.id)!, '', null).body).toContain('the link works for 60 minutes');
      clock += 20 * MIN;
      await syncOrder(deps, shop.id, 'poller');
      expect(statusView(receiptView(db, shop.id)!, '', null).body).toContain('within 20 minutes');
    });

    it('says the right number of minutes to the seller', async () => {
      const o = await order({ agentName: STOREFRONT_AGENT_NAME });
      clock += 20 * MIN;
      const expired = await syncOrder(deps, o.id, 'poller');
      expect(actionWords(expired)[1]).toContain('within 20 minutes');
      expect(actionWords({ ...expired, agentName: 'claude-desktop' })[1]).toContain('within 60 minutes');
      const texts = timelineEntries(eventsRepo.list(db, o.id), expired).map((e) => e.text);
      expect(texts).toContain('Expired: not approved within 20 minutes');
    });
  });

  describe('a retried request id', () => {
    const NOTE = { agentName: STOREFRONT_AGENT_NAME, clientRequestId: 'request-1' };

    it('returns the stored order when the note is the same', async () => {
      const a = await order({ ...NOTE, buyerNote: 'No nuts please' });
      const b = await order({ ...NOTE, buyerNote: '  No nuts please ' });
      expect(b.id).toBe(a.id);
      expect(fake.calls.filter((c) => c.method === 'createOrder')).toHaveLength(1);
    });

    it.each([
      ['a changed note', 'Actually, extra nuts'],
      ['a removed note', null],
    ])('refuses %s instead of returning an order with the old one (SR27)', async (_what, buyerNote) => {
      await order({ ...NOTE, buyerNote: 'No nuts please' });
      await expect(order({ ...NOTE, buyerNote })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
      expect(fake.calls.filter((c) => c.method === 'createOrder')).toHaveLength(1);
    });

    it('still treats an omitted note as not part of the request (agent retries)', async () => {
      const a = await order({ ...NOTE, buyerNote: 'No nuts please' });
      expect((await order(NOTE)).id).toBe(a.id);
    });
  });
});

describe('how a storefront order reads to the seller', () => {
  it('is "your shop page"', () => {
    expect(agentLabel(STOREFRONT_AGENT_NAME)).toBe('your shop page');
    expect(agentLabel(` ${STOREFRONT_AGENT_NAME} `)).toBe('your shop page');
  });
  it('leaves other agents as they were', () => {
    expect(agentLabel('shelfie-assistant')).toBe('Shelfie Assistant');
    expect(agentLabel('Shelfie-Storefront')).toBe('Shelfie-Storefront');
  });
});
