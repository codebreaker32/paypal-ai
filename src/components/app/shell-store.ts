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
}

let current: { shopId: string; values: ShellValues } | null = null;
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
  return current?.shopId === shopId ? current.values : server;
}

/** Called with what the server just read (the shell's first render, or a refresh). */
export function seedShell(shopId: string, values: ShellValues): void {
  current = { shopId, values };
  notify();
}

/** Merges a change. Keeps the same object when nothing changed, so readers don't re-render. */
export function patchShell(shopId: string, patch: Partial<ShellValues>): void {
  if (current?.shopId !== shopId) return;
  const changed = (Object.keys(patch) as (keyof ShellValues)[]).some((k) => patch[k] !== current!.values[k]);
  if (!changed) return;
  current = { shopId, values: { ...current.values, ...patch } };
  notify();
}

export function resetShellForTests(): void {
  current = null;
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
