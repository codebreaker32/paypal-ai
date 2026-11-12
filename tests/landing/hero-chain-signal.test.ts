// The home chat never opens itself over the hero chain's last steps.
import { describe, expect, it } from 'vitest';
import { chatMayOpen } from '@/components/landing/hero-chain-signal';

const VIEW = { width: 1440, height: 900 };
// The chain at 1440 x 900, at the top of the page: its last two steps sit where the panel would stand.
const AT_TOP = { top: 150, bottom: 440, left: 565, right: 1190 };
const scrolled = (by: number) => ({ ...AT_TOP, top: AT_TOP.top - by, bottom: AT_TOP.bottom - by });

describe('chatMayOpen', () => {
  it('waits while the chain is still playing, even where the panel would not cover it', () => {
    expect(chatMayOpen(AT_TOP, false, VIEW)).toBe(false);
    expect(chatMayOpen({ top: 150, bottom: 440, left: 100, right: 700 }, false, VIEW)).toBe(false);
  });

  it('waits while a finished chain sits under the panel', () => {
    expect(chatMayOpen(AT_TOP, true, VIEW)).toBe(false);
  });

  it('opens once a finished chain sits beside the panel', () => {
    expect(chatMayOpen({ top: 150, bottom: 440, left: 100, right: 900 }, true, VIEW)).toBe(true);
  });

  it('opens once the chain has scrolled away, finished or not', () => {
    expect(chatMayOpen(scrolled(500), false, VIEW)).toBe(true);
    expect(chatMayOpen(scrolled(500), true, VIEW)).toBe(true);
  });

  it('waits while the chain is still partly under the panel after a short scroll', () => {
    expect(chatMayOpen(scrolled(300), true, VIEW)).toBe(false);
  });

  it('opens on a page with no chain, or a hidden one', () => {
    expect(chatMayOpen(null, false, VIEW)).toBe(true);
    expect(chatMayOpen({ top: 0, bottom: 0, left: 0, right: 0 }, false, VIEW)).toBe(true);
  });
});
