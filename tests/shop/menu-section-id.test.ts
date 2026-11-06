// The shop menu's section ids back the section tabs and the scroll-spy, so two sections must never share one.
import { describe, expect, it } from 'vitest';
import { sectionId } from '@/components/shop/Menu';

describe('sectionId', () => {
  it('names that slugify alike still get different ids', () => {
    const names = ['Coffee & Tea', 'Coffee/Tea', 'Coffee Tea'];
    const ids = names.map((n, i) => sectionId(n, i));
    expect(new Set(ids).size).toBe(3);
  });

  it('stays readable and a valid fragment, even for a name with no letters', () => {
    expect(sectionId('Pastries', 0)).toMatch(/^section-pastries/);
    expect(sectionId('☕', 2)).toMatch(/^section-[a-z0-9-]+$/);
  });
});
