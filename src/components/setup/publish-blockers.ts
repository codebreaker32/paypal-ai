// What stands between the review screen and Publish. The Publish button is disabled exactly when this list is
// not empty, and the publish bar shows the same list ("To publish: …"), so the two can never disagree.

export type PublishBlockerKey = 'items' | 'name' | 'fee' | 'payee';

export interface PublishBlocker {
  key: PublishBlockerKey;
  /** A few words, lower case, to follow "To publish:". */
  label: string;
}

export interface PublishState {
  /** Items that would go to PayPal now. */
  toPublish: number;
  /** Nothing left to send, but items are already in PayPal: the button only opens the shop. */
  finishOnly: boolean;
  /** Items still under "Needs you". */
  needYou: number;
  /** The PayPal email field holds a valid email (or may be empty: the demo shop). */
  payeeReady: boolean;
  /** The shop name field is not blank. */
  nameReady: boolean;
  /** The shipping fee field reads as an amount (always true for pickup only). */
  feeReady: boolean;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Everything missing, in the order the screen shows the fields: the menu first, then the shop details. */
export function publishBlockers(s: PublishState): PublishBlocker[] {
  const out: PublishBlocker[] = [];
  if (s.toPublish === 0 && !s.finishOnly) {
    out.push({
      key: 'items',
      label: s.needYou > 0 ? `fix ${plural(s.needYou, 'item')} under Needs you` : 'give at least one item a price',
    });
  }
  if (!s.nameReady) out.push({ key: 'name', label: 'give your shop a name' });
  if (!s.feeReady) out.push({ key: 'fee', label: 'fix the shipping fee' });
  if (!s.payeeReady) out.push({ key: 'payee', label: 'add your PayPal email' });
  return out;
}

/** The whole list as one sentence, for screen readers and tests: "To publish: add your PayPal email." */
export function blockersSentence(blockers: PublishBlocker[]): string {
  return blockers.length ? `To publish: ${blockers.map((b) => b.label).join(', ')}.` : '';
}
