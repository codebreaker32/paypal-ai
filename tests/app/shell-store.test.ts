// The shell's live values: a tiny external store (never React context), keyed to one shop at a time.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { patchShell, resetShellForTests, seedShell, setRecoveryUnsaved, shellSnapshot, subscribeShell, type ShellValues } from '@/components/app/shell-store';

const base: ShellValues = { toPrepare: 2, status: 'live', logoUrl: null, coverUrl: null, payeeMissing: false, paypalDown: false, recoveryUnsaved: false };

describe('shell store', () => {
  beforeEach(() => resetShellForTests());

  it('falls back to the server values until the shop is seeded', () => {
    expect(shellSnapshot('shp_1', base)).toBe(base);
    const seeded = { ...base, toPrepare: 5 };
    seedShell('shp_1', seeded);
    expect(shellSnapshot('shp_1', base)).toBe(seeded);
  });

  it('never hands one shop another shop\'s values', () => {
    seedShell('shp_1', { ...base, toPrepare: 9 });
    expect(shellSnapshot('shp_2', base)).toBe(base);
  });

  it('merges a patch and notifies listeners', () => {
    seedShell('shp_1', base);
    const fn = vi.fn();
    const stop = subscribeShell(fn);
    patchShell('shp_1', { status: 'paused' });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(shellSnapshot('shp_1', base)).toMatchObject({ status: 'paused', toPrepare: 2 });
    stop();
    patchShell('shp_1', { status: 'live' });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('keeps the same snapshot object when a patch changes nothing', () => {
    seedShell('shp_1', base);
    const before = shellSnapshot('shp_1', base);
    const fn = vi.fn();
    subscribeShell(fn);
    patchShell('shp_1', { status: 'live', toPrepare: 2 });
    expect(shellSnapshot('shp_1', base)).toBe(before);
    expect(fn).not.toHaveBeenCalled();
  });

  it('ignores a patch for a shop that is not the current one', () => {
    seedShell('shp_1', base);
    patchShell('shp_2', { toPrepare: 7 });
    expect(shellSnapshot('shp_1', base).toPrepare).toBe(2);
  });

  describe('a payload the router kept (a prefetched layout, the one Back restores)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(10_000);
    });
    afterEach(() => vi.useRealTimers());

    it('never undoes a change made after the payload was read', () => {
      seedShell('shp_1', base, 9_000);
      vi.setSystemTime(12_000);
      patchShell('shp_1', { status: 'paused' });
      seedShell('shp_1', base, 9_000);
      expect(shellSnapshot('shp_1', base).status).toBe('paused');
      seedShell('shp_1', { ...base, status: 'live', toPrepare: 8 }, 11_000);
      expect(shellSnapshot('shp_1', base)).toMatchObject({ status: 'paused', toPrepare: 2 });
    });

    it('takes a payload read after the last change', () => {
      seedShell('shp_1', base, 9_000);
      vi.setSystemTime(12_000);
      patchShell('shp_1', { status: 'paused' });
      seedShell('shp_1', { ...base, status: 'live', toPrepare: 8 }, 13_000);
      expect(shellSnapshot('shp_1', base)).toMatchObject({ status: 'live', toPrepare: 8 });
    });

    it('does not go back to a payload older than the one it holds', () => {
      seedShell('shp_1', { ...base, toPrepare: 7 }, 9_000);
      seedShell('shp_1', { ...base, toPrepare: 1 }, 8_000);
      expect(shellSnapshot('shp_1', base).toPrepare).toBe(7);
    });

    it('keeps what it held for a shop while another shop was open', () => {
      seedShell('shp_1', base, 9_000);
      patchShell('shp_1', { status: 'paused' });
      seedShell('shp_2', base, 11_000);
      seedShell('shp_1', base, 9_000);
      expect(shellSnapshot('shp_1', base).status).toBe('paused');
      expect(shellSnapshot('shp_2', base).status).toBe('live');
    });

    it('a change that changes nothing is not a change', () => {
      seedShell('shp_1', base, 9_000);
      vi.setSystemTime(12_000);
      patchShell('shp_1', { status: 'live' });
      seedShell('shp_1', { ...base, toPrepare: 4 }, 11_000);
      expect(shellSnapshot('shp_1', base).toPrepare).toBe(4);
    });

    it('holds an edited payee email through a stale seed', () => {
      seedShell('shp_1', { ...base, payeeMissing: true }, 9_000);
      vi.setSystemTime(12_000);
      patchShell('shp_1', { payeeEmail: 'a@example.com', payeeMissing: false });
      seedShell('shp_1', { ...base, payeeMissing: true }, 9_000);
      expect(shellSnapshot('shp_1', base)).toMatchObject({ payeeEmail: 'a@example.com', payeeMissing: false });
    });
  });
});

describe('setRecoveryUnsaved: the recovery key belongs to the account, not to one shop', () => {
  const unsaved: ShellValues = { ...base, recoveryUnsaved: true };

  beforeEach(() => resetShellForTests());

  it('changes every shop this tab already knows and tells the readers', () => {
    seedShell('shp_1', unsaved);
    seedShell('shp_2', unsaved);
    const fn = vi.fn();
    subscribeShell(fn);
    setRecoveryUnsaved(false);
    expect(shellSnapshot('shp_1', base).recoveryUnsaved).toBe(false);
    expect(shellSnapshot('shp_2', base).recoveryUnsaved).toBe(false);
    expect(fn).toHaveBeenCalled();
  });

  it('is not undone by the payload Back restores', () => {
    const readAt = Date.now() - 60_000;
    seedShell('shp_1', unsaved, readAt);
    setRecoveryUnsaved(false);
    seedShell('shp_1', unsaved, readAt);
    expect(shellSnapshot('shp_1', base).recoveryUnsaved).toBe(false);
  });

  it('corrects a kept payload for a shop first opened after the change', () => {
    setRecoveryUnsaved(false);
    seedShell('shp_new', unsaved, Date.now() - 60_000);
    expect(shellSnapshot('shp_new', base)).toMatchObject({ recoveryUnsaved: false, toPrepare: 2 });
  });

  it('believes a server read made after the change', () => {
    setRecoveryUnsaved(false);
    seedShell('shp_new', unsaved, Date.now() + 60_000);
    expect(shellSnapshot('shp_new', base).recoveryUnsaved).toBe(true);
  });

  it('brings the banner back for a new key that is not saved yet', () => {
    seedShell('shp_1', base);
    setRecoveryUnsaved(true);
    expect(shellSnapshot('shp_1', base).recoveryUnsaved).toBe(true);
    seedShell('shp_new', base, Date.now() - 60_000);
    expect(shellSnapshot('shp_new', base).recoveryUnsaved).toBe(true);
  });

  it('forgets the change between tests', () => {
    setRecoveryUnsaved(false);
    resetShellForTests();
    seedShell('shp_1', unsaved, Date.now() - 60_000);
    expect(shellSnapshot('shp_1', base).recoveryUnsaved).toBe(true);
  });
});
