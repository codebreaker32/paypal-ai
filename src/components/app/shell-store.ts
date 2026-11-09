'use client';

// Values the shell chrome shows and the dashboard changes: a small external store read with useSyncExternalStore.
// Not React context on purpose: a context update reaching a pending Suspense boundary is the documented double-panel
// bug (src/components/motion/load-features.ts). An update here re-renders only the components reading it.
import { useSyncExternalStore } from 'react';
import type { ShopStatus } from '@/lib/domain/types';

export interface ShellValues {
  toPrepare: number;
  status: ShopStatus;
  logoUrl: string | null;
  coverUrl: string | null;
  payeeMissing: boolean;
  paypalDown: boolean;
  recoveryUnsaved: boolean;
  /** Only once the seller edits it in Settings: until then the dashboard's own prop is the answer. */
  payeeEmail?: string | null;
}

// Per shop, so a shop reopened from the router's cache still knows what happened to it.
// `stamp`: when these values were last known true, the later of the server's read and the last change here.
const shops = new Map<string, { values: ShellValues; stamp: number }>();
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((fn) => fn());

export function subscribeShell(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** The shop's live values, or `server` (what the page rendered with) until the shop is seeded. */
export function shellSnapshot(shopId: string, server: ShellValues): ShellValues {
  return shops.get(shopId)?.values ?? server;
}

/**
 * Called with what the server read (the shell's mount, or a refresh). `readAt` is when: the router can hand us a payload
 * it kept (a prefetched layout, or the one Back restores), and that must not undo what the seller has done since. A
 * wrong device clock costs little: at worst a kept payload lands or a fresh one waits for the next full load.
 */
export function seedShell(shopId: string, values: ShellValues, readAt?: number): void {
  const held = shops.get(shopId);
  if (held && readAt !== undefined && readAt <= held.stamp) return;
  shops.set(shopId, { values, stamp: readAt ?? Date.now() });
  notify();
}

/** Merges a change. Keeps the same object when nothing changed, so readers don't re-render. */
export function patchShell(shopId: string, patch: Partial<ShellValues>): void {
  const held = shops.get(shopId);
  if (!held) return;
  const changed = (Object.keys(patch) as (keyof ShellValues)[]).some((k) => patch[k] !== held.values[k]);
  if (!changed) return;
  shops.set(shopId, { values: { ...held.values, ...patch }, stamp: Date.now() });
  notify();
}

export function resetShellForTests(): void {
  shops.clear();
  listeners.clear();
}

/** The shell's live values for `shopId`. `server` must be a stable object: it is what SSR and hydration render. */
export function useShellValues(shopId: string, server: ShellValues): ShellValues {
  return useSyncExternalStore(
    subscribeShell,
    () => shellSnapshot(shopId, server),
    () => server,
  );
}
