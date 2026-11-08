// The shell's live values: a tiny external store (never React context), keyed to one shop at a time.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { patchShell, resetShellForTests, seedShell, shellSnapshot, subscribeShell, type ShellValues } from '@/components/app/shell-store';

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
});
