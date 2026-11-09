// The counter card's name scales with its length, so long names stay on the card.
import { describe, expect, it } from 'vitest';
import { cardNameSize } from '@/app/shops/[id]/(app)/card/name-size';

describe('cardNameSize', () => {
  it.each([
    ['Marigold Bakehouse', 'text-[10cqw]'],
    ['x'.repeat(24), 'text-[10cqw]'],
    ['x'.repeat(25), 'text-[7.5cqw]'],
    ['The Corner Bakery and Coffee Shop', 'text-[7.5cqw]'],
    ['x'.repeat(80), 'text-[5.5cqw]'],
    ['x'.repeat(127), 'text-[4.6cqw]'],
  ])('%s', (name, size) => {
    expect(cardNameSize(name)).toBe(size);
  });
});
