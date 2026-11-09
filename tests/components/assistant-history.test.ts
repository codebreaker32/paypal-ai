import { describe, expect, it } from 'vitest';
import { afterHistoryMove, isOwnEntry, withOwnMark, withoutOwnMark, urlWithPanels } from '@/components/shop/assistant-history';

describe('the mark on an entry the assistant pushed', () => {
  it('is added without touching what Next keeps there', () => {
    const state = withOwnMark({ __NA: true, tree: ['x'] });
    expect(state).toMatchObject({ __NA: true, tree: ['x'] });
    expect(isOwnEntry(state)).toBe(true);
  });

  it('can be added to an entry with no state (a section tab)', () => {
    expect(isOwnEntry(withOwnMark(null))).toBe(true);
  });

  it('is absent from entries the page did not push', () => {
    expect(isOwnEntry(null)).toBe(false);
    expect(isOwnEntry({ __NA: true })).toBe(false);
    expect(isOwnEntry('x')).toBe(false);
  });

  it('comes off and leaves the rest', () => {
    const state = withoutOwnMark(withOwnMark({ __NA: true }));
    expect(state).toEqual({ __NA: true });
    expect(isOwnEntry(state)).toBe(false);
  });

  it('leaves an entry with no state as it was, so Next still ignores that entry', () => {
    expect(withoutOwnMark(null)).toBeNull();
  });
});

describe('afterHistoryMove', () => {
  const move = { closing: false, docked: false, inUrl: false, ownMark: false, open: false };

  describe('modal forms follow the URL', () => {
    it('opens on an entry with the param', () => {
      expect(afterHistoryMove({ ...move, inUrl: true })).toEqual({ open: true, ownEntry: false, fixUrl: false });
    });

    it('owns the entry only when this page marked it', () => {
      expect(afterHistoryMove({ ...move, inUrl: true, ownMark: true }).ownEntry).toBe(true);
      expect(afterHistoryMove({ ...move, inUrl: true, ownMark: false }).ownEntry).toBe(false);
    });

    it('closes on an entry without the param, and owns nothing there', () => {
      expect(afterHistoryMove({ ...move, open: true, ownMark: true })).toEqual({ open: false, ownEntry: false, fixUrl: false });
    });
  });

  describe('the dock is not driven by history', () => {
    it('stays closed on an entry with the param, and the entry is rewritten', () => {
      expect(afterHistoryMove({ ...move, docked: true, inUrl: true })).toEqual({ open: false, ownEntry: false, fixUrl: true });
    });

    it('stays open on an entry without the param, and the entry is rewritten', () => {
      expect(afterHistoryMove({ ...move, docked: true, open: true })).toEqual({ open: true, ownEntry: false, fixUrl: true });
    });

    it('rewrites nothing when the entry already agrees', () => {
      expect(afterHistoryMove({ ...move, docked: true, open: true, inUrl: true }).fixUrl).toBe(false);
      expect(afterHistoryMove({ ...move, docked: true }).fixUrl).toBe(false);
    });

    it('never owns an entry, even one marked before the screen grew', () => {
      expect(afterHistoryMove({ ...move, docked: true, open: true, inUrl: true, ownMark: true }).ownEntry).toBe(false);
    });
  });

  describe('a close that went through history.back()', () => {
    it('closes a sheet that has grown into a dock', () => {
      expect(afterHistoryMove({ ...move, closing: true, docked: true, open: true })).toEqual({ open: false, ownEntry: false, fixUrl: false });
    });

    it('closes even if the entry underneath has the param, and cleans that entry', () => {
      expect(afterHistoryMove({ ...move, closing: true, open: true, inUrl: true })).toEqual({ open: false, ownEntry: false, fixUrl: true });
    });
  });
});

describe('urlWithPanels', () => {
  const base = 'https://x.test/s/a?tab=1';
  it('puts back the params of what is showing', () => {
    expect(urlWithPanels(base, { assistant: false, order: '1', item: null }).search).toBe('?tab=1&order=1');
    expect(urlWithPanels(base, { assistant: true, order: null, item: 'itm' }).search).toBe('?tab=1&assistant=1&item=itm');
  });
  it('takes out what the stale URL still says', () => {
    expect(urlWithPanels(`${base}&assistant=1&item=old`, { assistant: false, order: '1', item: null }).search).toBe('?tab=1&order=1');
  });
});
