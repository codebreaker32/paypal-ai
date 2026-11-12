// The review screen's "To publish:" list and its Publish button come from one function, so they never disagree.
import { describe, expect, it } from 'vitest';
import { blockersSentence, publishBlockers, type PublishState } from '@/components/setup/publish-blockers';

const ready: PublishState = { toPublish: 3, finishOnly: false, needYou: 0, payeeReady: true, nameReady: true, feeReady: true };
const keys = (s: Partial<PublishState>) => publishBlockers({ ...ready, ...s }).map((b) => b.key);

describe('publishBlockers', () => {
  it('nothing is missing when items are ready and the details are filled', () => {
    expect(publishBlockers(ready)).toEqual([]);
    expect(blockersSentence([])).toBe('');
  });

  it('no item to publish: fix the ones under Needs you, or price one', () => {
    expect(publishBlockers({ ...ready, toPublish: 0, needYou: 3 })).toEqual([{ key: 'items', label: 'fix 3 items under Needs you' }]);
    expect(publishBlockers({ ...ready, toPublish: 0, needYou: 1 })[0].label).toBe('fix 1 item under Needs you');
    expect(publishBlockers({ ...ready, toPublish: 0, needYou: 0 })[0].label).toBe('give at least one item a price');
  });

  it('items already in PayPal (finish only) need nothing more from the menu', () => {
    expect(keys({ toPublish: 0, finishOnly: true })).toEqual([]);
  });

  it('items that still need you do not block when others are ready', () => {
    expect(keys({ needYou: 2 })).toEqual([]);
  });

  it('lists every missing detail in screen order', () => {
    expect(keys({ toPublish: 0, payeeReady: false, nameReady: false, feeReady: false })).toEqual(['items', 'name', 'fee', 'payee']);
  });

  it('reads as one sentence', () => {
    const b = publishBlockers({ ...ready, payeeReady: false, feeReady: false });
    expect(blockersSentence(b)).toBe('To publish: fix the shipping fee, add your PayPal email.');
  });
});
